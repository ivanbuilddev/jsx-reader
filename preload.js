const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onWindowStateChanged: (callback) => ipcRenderer.on('window:state-changed', (_, isMaximized) => callback(isMaximized)),

    // File operations
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

    // Library operations
    getLibrary: () => ipcRenderer.invoke('library:get'),
    removeFile: (filePath) => ipcRenderer.invoke('library:removeFile', filePath),
    addFolder: (name) => ipcRenderer.invoke('library:addFolder', name),
    renameFolder: (folderId, newName) => ipcRenderer.invoke('library:renameFolder', folderId, newName),
    deleteFolder: (folderId, mode) => ipcRenderer.invoke('library:deleteFolder', folderId, mode),
    moveFileToFolder: (filePath, folderId) => ipcRenderer.invoke('library:moveFileToFolder', filePath, folderId),
    reorderFolder: (folderId, targetIndex) => ipcRenderer.invoke('library:reorderFolder', folderId, targetIndex),
    saveFile: (filePath) => ipcRenderer.invoke('library:saveFile', filePath),
    isFileSaved: (filePath) => ipcRenderer.invoke('library:isFileSaved', filePath),

    // Utils
    getPathForFile: (file) => webUtils.getPathForFile(file),
});
