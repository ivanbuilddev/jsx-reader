document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const btnOpen = document.getElementById('btn-open');
    const btnOpenHeader = document.getElementById('btn-open-header');
    const dropZone = document.getElementById('drop-zone');
    const emptyState = document.getElementById('empty-state');
    const renderContainer = document.getElementById('render-container');
    const reactRoot = document.getElementById('react-root');
    const currentFileName = document.getElementById('current-file-name');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const sidebarContent = document.getElementById('sidebar-content');
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnExpandSidebar = document.getElementById('btn-expand-sidebar');
    const btnAddFolder = document.getElementById('btn-add-folder');

    // Window controls
    const btnMinimize = document.getElementById('btn-minimize');
    const btnMaximize = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    // Delete folder dialog (keep the dialog only for delete confirmation)
    const deleteFolderDialog = document.getElementById('delete-folder-dialog');
    const deleteFolderText = document.getElementById('delete-folder-text');
    const deleteFolderCancel = document.getElementById('delete-folder-cancel');
    const deleteFolderKeep = document.getElementById('delete-folder-keep');
    const deleteFolderAll = document.getElementById('delete-folder-all');

    // State
    let currentFilePath = null;
    let expandedFolders = new Set();
    let inlineEditingFolderId = null; // folder id currently being renamed inline

    // ===== WINDOW CONTROLS =====
    btnMinimize.addEventListener('click', () => window.electronAPI.minimize());
    btnMaximize.addEventListener('click', () => window.electronAPI.maximize());
    btnClose.addEventListener('click', () => window.electronAPI.closeWindow());
    window.electronAPI.onWindowStateChanged(() => { });

    // ===== SIDEBAR TOGGLE =====
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        btnExpandSidebar.classList.remove('hidden');
    });

    btnExpandSidebar.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        btnExpandSidebar.classList.add('hidden');
    });

    // ===== INLINE FOLDER CREATION =====
    btnAddFolder.addEventListener('click', async () => {
        // Create the folder immediately with a temp name, then show inline rename
        const library = await window.electronAPI.addFolder('');
        const newFolder = library.folders[library.folders.length - 1];
        expandedFolders.add(newFolder.id);
        inlineEditingFolderId = newFolder.id;
        renderLibrary(library);
    });

    // ===== DELETE FOLDER DIALOG =====
    let pendingDeleteFolderId = null;

    deleteFolderCancel.addEventListener('click', () => deleteFolderDialog.close());

    deleteFolderKeep.addEventListener('click', async () => {
        if (pendingDeleteFolderId) {
            const library = await window.electronAPI.deleteFolder(pendingDeleteFolderId, 'keep-files');
            renderLibrary(library);
        }
        deleteFolderDialog.close();
    });

    deleteFolderAll.addEventListener('click', async () => {
        if (pendingDeleteFolderId) {
            const library = await window.electronAPI.deleteFolder(pendingDeleteFolderId, 'delete-all');
            renderLibrary(library);
        }
        deleteFolderDialog.close();
    });

    // ===== LOAD LIBRARY =====
    loadLibrary();

    async function loadLibrary() {
        const library = await window.electronAPI.getLibrary();
        renderLibrary(library);
    }

    // ===== RENDER LIBRARY =====
    function renderLibrary(library) {
        sidebarContent.innerHTML = '';

        // Render folders
        if (library.folders && library.folders.length > 0) {
            library.folders.forEach(folder => {
                const folderEl = createFolderElement(folder);
                sidebarContent.appendChild(folderEl);
            });

            // Always show an "Ungrouped" droppable area when folders exist
            const ungroupedSection = document.createElement('div');
            ungroupedSection.className = 'ungrouped-section';

            const label = document.createElement('div');
            label.className = 'sidebar-section-label';
            label.textContent = 'Ungrouped';
            ungroupedSection.appendChild(label);

            // Drop zone for moving files back to root
            ungroupedSection.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                ungroupedSection.classList.add('drop-target');
            });
            ungroupedSection.addEventListener('dragleave', (e) => {
                if (!ungroupedSection.contains(e.relatedTarget)) {
                    ungroupedSection.classList.remove('drop-target');
                }
            });
            ungroupedSection.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                ungroupedSection.classList.remove('drop-target');
                const draggedFile = e.dataTransfer.getData('text/plain');
                if (draggedFile) {
                    const lib = await window.electronAPI.moveFileToFolder(draggedFile, 'root');
                    renderLibrary(lib);
                }
            });

            if (library.rootFiles && library.rootFiles.length > 0) {
                library.rootFiles.forEach(filePath => {
                    const fileEl = createFileElement(filePath);
                    ungroupedSection.appendChild(fileEl);
                });
            }
            sidebarContent.appendChild(ungroupedSection);
        } else if (library.rootFiles && library.rootFiles.length > 0) {
            // No folders, just render root files directly
            library.rootFiles.forEach(filePath => {
                const fileEl = createFileElement(filePath);
                sidebarContent.appendChild(fileEl);
            });
        }

        // Empty state
        if ((!library.rootFiles || library.rootFiles.length === 0) && (!library.folders || library.folders.length === 0)) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding: 20px 14px; text-align: center; color: var(--text-muted); font-size: 12px;';
            empty.textContent = 'No files yet';
            sidebarContent.appendChild(empty);
        }
    }

    function createFolderElement(folder) {
        const isOpen = expandedFolders.has(folder.id);
        const isEditing = inlineEditingFolderId === folder.id;
        const wrapper = document.createElement('div');
        wrapper.className = 'folder-item';

        // Header
        const header = document.createElement('div');
        header.className = 'folder-header';

        if (isEditing) {
            // Inline edit mode: show an input instead of the folder name
            header.innerHTML = `
                <span class="folder-chevron open">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <span class="folder-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </span>
                <input type="text" class="folder-inline-input" value="${escapeHtml(folder.name)}" placeholder="Folder name" autocomplete="off" />
            `;

            const input = header.querySelector('.folder-inline-input');

            // Confirm on Enter or blur
            const confirmRename = async () => {
                const name = input.value.trim();
                inlineEditingFolderId = null;
                if (name) {
                    const library = await window.electronAPI.renameFolder(folder.id, name);
                    renderLibrary(library);
                } else {
                    // If empty name, delete the folder (it was just created with no name)
                    const library = await window.electronAPI.deleteFolder(folder.id, 'keep-files');
                    renderLibrary(library);
                }
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmRename();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    inlineEditingFolderId = null;
                    // If folder has empty name (just created), remove it
                    if (!folder.name) {
                        window.electronAPI.deleteFolder(folder.id, 'keep-files').then(lib => renderLibrary(lib));
                    } else {
                        loadLibrary();
                    }
                }
            });

            input.addEventListener('blur', () => {
                // Small delay to avoid conflicts with click events
                setTimeout(() => {
                    if (inlineEditingFolderId === folder.id) {
                        confirmRename();
                    }
                }, 100);
            });

            // Prevent click on header from toggling folder
            header.addEventListener('click', (e) => e.stopPropagation());

            wrapper.appendChild(header);

            // Focus input after DOM attachment
            requestAnimationFrame(() => {
                input.focus();
                input.select();
            });
        } else {
            // Normal display mode
            header.innerHTML = `
                <span class="folder-chevron ${isOpen ? 'open' : ''}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
                <span class="folder-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </span>
                <span class="folder-name">${escapeHtml(folder.name || 'Untitled')}</span>
                <span class="folder-actions">
                    <button class="folder-action-btn" data-action="rename" title="Rename">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button class="folder-action-btn danger" data-action="delete" title="Delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </span>
            `;

            // Toggle folder open/close
            header.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                if (isOpen) {
                    expandedFolders.delete(folder.id);
                } else {
                    expandedFolders.add(folder.id);
                }
                loadLibrary();
            });

            // Rename (inline)
            header.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
                e.stopPropagation();
                inlineEditingFolderId = folder.id;
                loadLibrary();
            });

            // Delete
            header.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                pendingDeleteFolderId = folder.id;
                deleteFolderText.textContent = folder.files.length > 0
                    ? `"${folder.name}" contains ${folder.files.length} file(s). What would you like to do?`
                    : `Delete the folder "${folder.name}"?`;
                if (folder.files.length === 0) {
                    deleteFolderKeep.classList.add('hidden');
                } else {
                    deleteFolderKeep.classList.remove('hidden');
                }
                deleteFolderDialog.showModal();
            });

            wrapper.appendChild(header);
        }

        // Children (files inside folder)
        const children = document.createElement('div');
        children.className = `folder-children ${isOpen || isEditing ? '' : 'collapsed'}`;
        folder.files.forEach(filePath => {
            const fileEl = createFileElement(filePath, folder.id);
            children.appendChild(fileEl);
        });
        wrapper.appendChild(children);

        // === FOLDER DRAGGING (reorder) ===
        if (!isEditing) {
            wrapper.draggable = true;
            wrapper.dataset.folderId = folder.id;

            wrapper.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/folder-id', folder.id);
                e.dataTransfer.effectAllowed = 'move';
                wrapper.classList.add('folder-dragging');
            });

            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('folder-dragging');
                clearAllDropIndicators();
            });
        }

        // === DROP ZONE (for files AND folder reorder) ===
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const draggingFolderId = e.dataTransfer.types.includes('application/folder-id');
            const draggingFile = e.dataTransfer.types.includes('text/plain') && !draggingFolderId;

            if (draggingFolderId) {
                // Show drop indicator line above or below
                const rect = wrapper.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                clearAllDropIndicators();
                if (e.clientY < midY) {
                    wrapper.classList.add('drop-above');
                } else {
                    wrapper.classList.add('drop-below');
                }
            } else if (draggingFile) {
                header.style.background = 'var(--accent-dim)';
            }
        });

        wrapper.addEventListener('dragleave', (e) => {
            // Only clear if leaving the wrapper entirely
            if (!wrapper.contains(e.relatedTarget)) {
                wrapper.classList.remove('drop-above', 'drop-below');
                header.style.background = '';
            }
        });

        wrapper.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearAllDropIndicators();
            header.style.background = '';

            const draggedFolderId = e.dataTransfer.getData('application/folder-id');
            const draggedFile = e.dataTransfer.getData('text/plain');

            if (draggedFolderId && draggedFolderId !== folder.id) {
                // Reorder folders
                const rect = wrapper.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const allFolderItems = [...sidebarContent.querySelectorAll('.folder-item[data-folder-id]')];
                let targetIndex = allFolderItems.findIndex(el => el.dataset.folderId === folder.id);
                if (e.clientY >= midY) targetIndex += 1;
                // Adjust if dragging from above
                const sourceIndex = allFolderItems.findIndex(el => el.dataset.folderId === draggedFolderId);
                if (sourceIndex < targetIndex) targetIndex -= 1;
                if (targetIndex < 0) targetIndex = 0;
                const library = await window.electronAPI.reorderFolder(draggedFolderId, targetIndex);
                renderLibrary(library);
            } else if (draggedFile) {
                // Move file into folder
                const library = await window.electronAPI.moveFileToFolder(draggedFile, folder.id);
                renderLibrary(library);
            }
        });

        return wrapper;
    }

    function clearAllDropIndicators() {
        sidebarContent.querySelectorAll('.drop-above, .drop-below').forEach(el => {
            el.classList.remove('drop-above', 'drop-below');
        });
    }

    function createFileElement(filePath, folderId) {
        const fileName = filePath.split(/[/\\]/).pop();
        const el = document.createElement('div');
        el.className = 'file-item' + (filePath === currentFilePath ? ' active' : '');
        el.title = filePath;
        el.draggable = true;
        el.innerHTML = `
            <span class="file-item-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <span class="file-item-name">${escapeHtml(fileName)}</span>
            <button class="file-item-remove" title="Remove from library">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        el.addEventListener('click', (e) => {
            if (e.target.closest('.file-item-remove')) return;
            openFileByPath(filePath);
        });

        el.querySelector('.file-item-remove').addEventListener('click', async (e) => {
            e.stopPropagation();
            const library = await window.electronAPI.removeFile(filePath);
            renderLibrary(library);
        });

        // Drag start for reorganizing
        el.addEventListener('dragstart', (e) => {
            e.stopPropagation(); // Prevent parent folder from capturing the drag
            e.dataTransfer.setData('text/plain', filePath);
            e.dataTransfer.effectAllowed = 'move';
        });

        return el;
    }

    // ===== FILE OPERATIONS =====
    async function openFileByPath(filePath) {
        try {
            const result = await window.electronAPI.readFile(filePath);
            handleFileOpened(result);
        } catch (err) {
            // File may have been moved/deleted - remove from library and show error
            showError(`Could not open file: ${filePath}\nThe file may have been moved or deleted.`);
            const library = await window.electronAPI.removeFile(filePath);
            renderLibrary(library);
        }
    }

    async function handleFileOpened(result) {
        const { filePath, fileName, content, library } = result;
        currentFilePath = filePath;
        currentFileName.textContent = fileName;
        renderLibrary(library);
        renderJSX(content);
        updateSaveButton(filePath);
    }

    async function updateSaveButton(filePath) {
        const btnSave = document.getElementById('btn-save-file');
        if (!btnSave) return;
        const isSaved = await window.electronAPI.isFileSaved(filePath);
        if (isSaved) {
            btnSave.classList.add('hidden');
        } else {
            btnSave.classList.remove('hidden');
        }
    }

    btnOpen.addEventListener('click', async () => {
        const result = await window.electronAPI.openFile();
        if (result) handleFileOpened(result);
    });

    if (btnOpenHeader) {
        btnOpenHeader.addEventListener('click', async () => {
            const result = await window.electronAPI.openFile();
            if (result) handleFileOpened(result);
        });
    }

    // Save file button
    const btnSaveFile = document.getElementById('btn-save-file');
    if (btnSaveFile) {
        btnSaveFile.addEventListener('click', async () => {
            if (!currentFilePath) return;
            try {
                const { newPath, library } = await window.electronAPI.saveFile(currentFilePath);
                currentFilePath = newPath;
                renderLibrary(library);
                updateSaveButton(newPath);
            } catch (err) {
                console.error('Failed to save file:', err);
            }
        });
    }

    // ===== DRAG & DROP (external files) =====
    // Prevent default on document level but do NOT stopPropagation
    // so the dropZone listeners still receive the events
    document.addEventListener('dragover', (e) => { e.preventDefault(); });
    document.addEventListener('drop', (e) => { e.preventDefault(); });

    const dropOverlay = document.getElementById('drop-overlay');

    function showDropOverlay() {
        // Determine which area to cover
        const isRenderVisible = !renderContainer.classList.contains('hidden');
        let targetEl;
        if (isRenderVisible) {
            targetEl = reactRoot;
        } else {
            targetEl = emptyState;
        }
        const parentRect = dropZone.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        dropOverlay.style.top = (targetRect.top - parentRect.top + 8) + 'px';
        dropOverlay.style.left = '8px';
        dropOverlay.style.right = '8px';
        dropOverlay.style.bottom = (parentRect.bottom - targetRect.bottom + 8) + 'px';
        dropOverlay.classList.add('visible');
        dropZone.classList.add('drag-over');
    }

    function hideDropOverlay() {
        dropOverlay.classList.remove('visible');
        dropZone.classList.remove('drag-over');
    }

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only show drag-over for external files, not internal sidebar drags
        if (e.dataTransfer.types.includes('Files')) {
            showDropOverlay();
        }
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only hide if actually leaving the dropzone
        if (!dropZone.contains(e.relatedTarget)) {
            hideDropOverlay();
        }
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideDropOverlay();

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Use Electron's webUtils to get the real file path (file.path is deprecated)
            let filePath = '';
            try {
                filePath = window.electronAPI.getPathForFile(file);
            } catch (err) {
                filePath = file.path || '';
            }
            const fileName = file.name || '';
            const isJsx = filePath.endsWith('.jsx') || filePath.endsWith('.js') ||
                fileName.endsWith('.jsx') || fileName.endsWith('.js');
            if (filePath && isJsx) {
                openFileByPath(filePath);
            } else if (!filePath) {
                showError('Could not read the file path. Try using the Browse Files button instead.');
            } else {
                showError(`Please drop a .jsx or .js file (received: ${fileName})`);
            }
        }
    });

    // ===== RENDERING =====
    function showError(message) {
        emptyState.classList.add('hidden');
        renderContainer.classList.remove('hidden');
        reactRoot.innerHTML = '';
        errorContainer.classList.remove('hidden');
        errorMessage.textContent = message;
    }

    function renderJSX(code) {
        emptyState.classList.add('hidden');
        renderContainer.classList.remove('hidden');
        errorContainer.classList.add('hidden');

        try {
            ReactDOM.unmountComponentAtNode(reactRoot);
            reactRoot.innerHTML = '';

            // Strip React import statements (AI-generated files assume bundler environment)
            let cleanCode = code.replace(/import\s+.*?from\s+['"]react['"];?/g, '');

            // Transpile
            const transpiled = Babel.transform(cleanCode, {
                presets: ['env', 'react']
            }).code;

            const module = { exports: {} };
            const exports = module.exports;

            function require(name) {
                if (name === 'react') return React;
                if (name === 'react-dom') return ReactDOM;
                return {};
            }

            const funcArgs = ['React', 'ReactDOM', 'require', 'module', 'exports', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 'useReducer'];
            const func = new Function(...funcArgs, transpiled);
            func(React, ReactDOM, require, module, exports, React.useState, React.useEffect, React.useRef, React.useCallback, React.useMemo, React.useContext, React.useReducer);

            let ComponentToRender = module.exports.default || module.exports;

            if (typeof ComponentToRender === 'function') {
                ReactDOM.render(React.createElement(ComponentToRender), reactRoot);
            } else if (React.isValidElement(ComponentToRender)) {
                ReactDOM.render(ComponentToRender, reactRoot);
            } else {
                if (reactRoot.innerHTML === '') {
                    showError('The file did not export a React component (e.g. `export default MyComponent;`) and did not render anything.');
                }
            }
        } catch (err) {
            console.error(err);
            showError(err.toString());
        }
    }

    // ===== UTILS =====
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
