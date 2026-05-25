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
        };
    }
}

export { };
