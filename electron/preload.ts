import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    onPythonData: (callback: (data: string) => void) => {
        ipcRenderer.on('python-data', (_event, data) => callback(data));
    },
    onPythonError: (callback: (data: string) => void) => {
        ipcRenderer.on('python-error', (_event, data) => callback(data));
    },
    sendToPython: (data: string) => {
        ipcRenderer.send('to-python', data);
    },
    // Window controls for custom titlebar
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    // Menu actions
    checkForUpdates: () => ipcRenderer.send('menu-check-updates'),
    openDevTools: () => ipcRenderer.send('menu-open-devtools'),
    reload: () => ipcRenderer.send('menu-reload'),
    forceReload: () => ipcRenderer.send('menu-force-reload'),
    toggleFullscreen: () => ipcRenderer.send('menu-toggle-fullscreen'),
    zoomIn: () => ipcRenderer.send('menu-zoom-in'),
    zoomOut: () => ipcRenderer.send('menu-zoom-out'),
    zoomReset: () => ipcRenderer.send('menu-zoom-reset'),
    openExternal: (url: string) => ipcRenderer.send('menu-open-external', url),
    getVersion: () => ipcRenderer.invoke('app-get-version'),
    showAbout: () => ipcRenderer.send('menu-show-about'),
    // Update events
    onUpdateStatus: (callback: (data: { status: string; info?: any }) => void) => {
        ipcRenderer.on('update-status', (_event, data) => callback(data));
    },
});
