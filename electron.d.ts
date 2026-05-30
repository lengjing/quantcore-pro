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
            onUpdaterStatus: (handler: (payload: { stage: 'available' | 'ready' | 'error'; version?: string; message?: string }) => void) => () => void;
            // System metrics
            getSystemMetrics: () => Promise<{ memMB: number; cpuPercent: number }>;
            // free-claude-code runtime
            controlFreeClaude: (payload?: {
                provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama';
                action?: 'start' | 'stop' | 'status';
                config?: { provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama'; apiKey?: string; model?: string; port?: number };
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
        };
    }
}

export { };
