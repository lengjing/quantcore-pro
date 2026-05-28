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
    // System metrics
    getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
    // free-claude-code runtime
    controlFreeClaude: (payload?: {
        provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama';
        action?: 'start' | 'stop' | 'status';
        config?: { provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama'; apiKey?: string; model?: string; port?: number };
    }) => ipcRenderer.invoke('free-claude-control', payload),
    chatWithFreeClaude: (payload: {
        provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama';
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        config?: { provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama'; apiKey?: string; model?: string; port?: number };
        maxTokens?: number;
        temperature?: number;
    }) => ipcRenderer.invoke('free-claude-chat', payload),
    chatWithFreeClaudeStream: (payload: {
        provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama';
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        config?: { provider?: 'nvidia_nim' | 'open_router' | 'deepseek' | 'mistral' | 'mistral_codestral' | 'opencode' | 'opencode_go' | 'wafer' | 'kimi' | 'cerebras' | 'groq' | 'fireworks' | 'zai' | 'lmstudio' | 'llamacpp' | 'ollama'; apiKey?: string; model?: string; port?: number };
        maxTokens?: number;
        temperature?: number;
    }, handlers?: {
        onDelta?: (delta: string, fullText: string) => void;
    }) => {
        const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        return new Promise<{ ok: boolean; message: string; raw: unknown; model: string }>((resolve, reject) => {
            const cleanup = () => {
                ipcRenderer.removeListener('free-claude-chat-stream-delta', onDelta);
                ipcRenderer.removeListener('free-claude-chat-stream-done', onDone);
                ipcRenderer.removeListener('free-claude-chat-stream-error', onError);
            };

            const onDelta = (_event: Electron.IpcRendererEvent, data: { requestId: string; delta: string; message: string }) => {
                if (data.requestId !== requestId) return;
                handlers?.onDelta?.(data.delta, data.message);
            };
            const onDone = (_event: Electron.IpcRendererEvent, data: { requestId: string; ok: boolean; message: string; raw: unknown; model: string }) => {
                if (data.requestId !== requestId) return;
                cleanup();
                resolve({ ok: data.ok, message: data.message, raw: data.raw, model: data.model });
            };
            const onError = (_event: Electron.IpcRendererEvent, data: { requestId: string; error: string }) => {
                if (data.requestId !== requestId) return;
                cleanup();
                reject(new Error(data.error));
            };

            ipcRenderer.on('free-claude-chat-stream-delta', onDelta);
            ipcRenderer.on('free-claude-chat-stream-done', onDone);
            ipcRenderer.on('free-claude-chat-stream-error', onError);
            ipcRenderer.send('free-claude-chat-stream', { ...payload, requestId });
        });
    },
});
