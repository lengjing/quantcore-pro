import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
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
    restartToUpdate: () => ipcRenderer.send('menu-restart-to-update'),
    onUpdaterStatus: (handler: (payload: { stage: 'available' | 'ready' | 'error'; version?: string; message?: string }) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, payload: { stage: 'available' | 'ready' | 'error'; version?: string; message?: string }) => {
            handler(payload);
        };
        ipcRenderer.on('updater-status', listener);
        return () => {
            ipcRenderer.removeListener('updater-status', listener);
        };
    },
    // System metrics
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    // free-claude-code runtime
    controlFreeClaude: (payload?: {
        provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama';
        action?: 'start' | 'stop' | 'status';
        config?: { provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama'; apiKey?: string; model?: string; port?: number };
    }) => ipcRenderer.invoke('free-claude-control', payload),
});
