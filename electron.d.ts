// TypeScript definitions for Electron API exposed via preload
declare global {
    interface Window {
        electron?: {
            onPythonData: (callback: (data: string) => void) => void;
            onPythonError: (callback: (data: string) => void) => void;
            sendToPython: (data: string) => void;
            // Window controls for custom titlebar
            windowMinimize: () => void;
            windowMaximize: () => void;
            windowClose: () => void;
            windowIsMaximized: () => Promise<boolean>;
            // Menu actions
            checkForUpdates: () => void;
            openDevTools: () => void;
            reload: () => void;
            forceReload: () => void;
            toggleFullscreen: () => void;
            zoomIn: () => void;
            zoomOut: () => void;
            zoomReset: () => void;
            openExternal: (url: string) => void;
            getVersion: () => Promise<string>;
            showAbout: () => void;
            // Update events
            onUpdateStatus: (callback: (data: { status: string; info?: any }) => void) => void;
        };
    }
}

export { };
