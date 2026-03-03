const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Store library data in userData directory
const userDataPath = app.getPath('userData');
const libraryPath = path.join(userDataPath, 'library.json');
const filesDir = path.join(userDataPath, 'files');

// Ensure the files directory exists
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir, { recursive: true });
}

function getLibrary() {
  try {
    if (fs.existsSync(libraryPath)) {
      const data = fs.readFileSync(libraryPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading library:', err);
  }
  return { rootFiles: [], folders: [] };
}

function saveLibrary(library) {
  try {
    fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2));
  } catch (err) {
    console.error('Error saving library:', err);
  }
}

function isFileInLibrary(library, filePath) {
  if (library.rootFiles.includes(filePath)) return true;
  return library.folders.some(folder => folder.files.includes(filePath));
}

function addFileToLibrary(filePath) {
  const library = getLibrary();
  // If the file is already in the library (root or any folder), don't move it
  if (isFileInLibrary(library, filePath)) {
    return library;
  }
  // Add to top of root
  library.rootFiles.unshift(filePath);
  // Limit root to 50
  if (library.rootFiles.length > 50) library.rootFiles = library.rootFiles.slice(0, 50);
  saveLibrary(library);
  return library;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#111113'
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:state-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:state-changed', false);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window control IPC
ipcMain.handle('window:minimize', () => mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow.close());
ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());

// File IPC
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSX Files', extensions: ['jsx', 'js'] }]
  });
  if (!canceled && filePaths.length > 0) {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const library = addFileToLibrary(filePath);
    return { filePath, fileName, content, library };
  }
  return null;
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    // addFileToLibrary only adds if the file isn't already tracked
    const library = addFileToLibrary(filePath);
    return { filePath, fileName, content, library };
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

// Library IPC
ipcMain.handle('library:get', () => getLibrary());

ipcMain.handle('library:removeFile', (event, filePath) => {
  const library = getLibrary();
  library.rootFiles = library.rootFiles.filter(f => f !== filePath);
  library.folders.forEach(folder => {
    folder.files = folder.files.filter(f => f !== filePath);
  });
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:addFolder', (event, name) => {
  const library = getLibrary();
  library.folders.push({ id: generateId(), name, files: [] });
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:renameFolder', (event, folderId, newName) => {
  const library = getLibrary();
  const folder = library.folders.find(f => f.id === folderId);
  if (folder) folder.name = newName;
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:deleteFolder', (event, folderId, mode) => {
  const library = getLibrary();
  const folder = library.folders.find(f => f.id === folderId);
  if (!folder) return library;

  if (mode === 'keep-files') {
    // Move files to root
    library.rootFiles = [...folder.files, ...library.rootFiles];
  }
  // mode === 'delete-all' just drops the files

  library.folders = library.folders.filter(f => f.id !== folderId);
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:moveFileToFolder', (event, filePath, folderId) => {
  const library = getLibrary();
  // Remove from root
  library.rootFiles = library.rootFiles.filter(f => f !== filePath);
  // Remove from all folders
  library.folders.forEach(folder => {
    folder.files = folder.files.filter(f => f !== filePath);
  });
  if (folderId === 'root') {
    library.rootFiles.unshift(filePath);
  } else {
    const folder = library.folders.find(f => f.id === folderId);
    if (folder) folder.files.push(filePath);
  }
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:reorderFolder', (event, folderId, targetIndex) => {
  const library = getLibrary();
  const currentIndex = library.folders.findIndex(f => f.id === folderId);
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= library.folders.length) return library;
  const [folder] = library.folders.splice(currentIndex, 1);
  library.folders.splice(targetIndex, 0, folder);
  saveLibrary(library);
  return library;
});

ipcMain.handle('library:saveFile', (event, originalPath) => {
  const fileName = path.basename(originalPath);
  // Generate a unique name if file already exists
  let destName = fileName;
  let destPath = path.join(filesDir, destName);
  let counter = 1;
  while (fs.existsSync(destPath)) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    destName = `${base}_${counter}${ext}`;
    destPath = path.join(filesDir, destName);
    counter++;
  }
  fs.copyFileSync(originalPath, destPath);

  // Update library: replace the original path with the new local path
  const library = getLibrary();
  library.rootFiles = library.rootFiles.map(f => f === originalPath ? destPath : f);
  library.folders.forEach(folder => {
    folder.files = folder.files.map(f => f === originalPath ? destPath : f);
  });
  saveLibrary(library);
  return { newPath: destPath, library };
});

ipcMain.handle('library:isFileSaved', (event, filePath) => {
  return filePath.startsWith(filesDir);
});
