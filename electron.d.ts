// TypeScript definitions for Electron API exposed via preload
declare global {
    interface Window {
        electron?: {
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
            restartToUpdate: () => void;
            // System metrics
            getSystemMetrics: () => Promise<{ memMB: number; cpuPercent: number }>;
        };
    }
}

export { };
