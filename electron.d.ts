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
            // free-claude-code runtime
            controlFreeClaude: (payload?: {
                action?: 'start' | 'stop' | 'status';
                config?: { apiKey?: string; model?: string; port?: number };
            }) => Promise<{
                ok: boolean;
                running: boolean;
                baseUrl: string;
                model: string;
                apiKeyMasked: string;
                output: string[];
                error: string | null;
                message?: string;
            }>;
            chatWithFreeClaude: (payload: {
                messages: Array<{ role: 'user' | 'assistant'; content: string }>;
                config?: { apiKey?: string; model?: string; port?: number };
                maxTokens?: number;
                temperature?: number;
            }) => Promise<{
                ok: boolean;
                message: string;
                raw: unknown;
                model: string;
            }>;
        };
    }
}

export { };
