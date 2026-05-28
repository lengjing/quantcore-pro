import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import dotenv from 'dotenv';

function loadDotEnvFiles() {
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '..', '.env'),
        path.resolve(path.dirname(process.execPath), '.env'),
        path.resolve(process.resourcesPath || '', '.env'),
    ].filter(Boolean);

    for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath, override: false });
        }
    }
}

loadDotEnvFiles();

const isDev = !app.isPackaged;
const DEV_PORT = process.env.VITE_PORT || process.env.VITE_DEV_PORT || '5173';
const FREE_CLAUDE_PORT = Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082);

// Read publish URL from package.json to keep a single source of truth
function readPublishUrl(): string {
    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const publish = pkg?.build?.publish;
        if (typeof publish === 'object' && publish.url) return publish.url;
    } catch { /* ignore */ }
    return '';
}

let mainWindow: BrowserWindow | null = null;

type FreeClaudeControlAction = 'start' | 'stop' | 'status';

interface FreeClaudeConfig {
    apiKey?: string;
    model?: string;
    port?: number;
}

interface FreeClaudeState {
    process: ChildProcessWithoutNullStreams | null;
    running: boolean;
    port: number;
    model: string;
    apiKeyMasked: string;
    output: string[];
    lastError: string | null;
}

const freeClaudeState: FreeClaudeState = {
    process: null,
    running: false,
    port: 8082,
    model: 'deepseek/deepseek-chat',
    apiKeyMasked: '',
    output: [],
    lastError: null,
};

function pushFreeClaudeLog(line: string) {
    freeClaudeState.output.push(line);
    if (freeClaudeState.output.length > 250) {
        freeClaudeState.output = freeClaudeState.output.slice(-250);
    }
}

function maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

function getProjectRoot(): string {
    return path.resolve(__dirname, '..');
}

function getBundledFreeClaudeExePath(): string {
    return path.join(process.resourcesPath, 'free-claude-code', 'free-claude-proxy.exe');
}

function resolveDeepSeekKey(explicit?: string): string {
    if (explicit && explicit.trim()) {
        return explicit.trim();
    }
    const envCandidates = [
        process.env.DEEPSEEK_API_KEY,
        process.env.OPENAI_API_KEY,
    ];
    for (const candidate of envCandidates) {
        if (candidate && candidate.trim()) {
            return candidate.trim();
        }
    }
    const keyFile = path.join(getProjectRoot(), 'test');
    if (fs.existsSync(keyFile)) {
        const content = fs.readFileSync(keyFile, 'utf-8').trim();
        if (content) {
            return content;
        }
    }
    return '';
}

function freeClaudeBaseUrl(): string {
    return `http://127.0.0.1:${freeClaudeState.port}`;
}

async function waitForFreeClaudeReady(timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${freeClaudeBaseUrl()}/health`, {
                headers: { 'x-api-key': 'freecc' },
            });
            if (res.ok) {
                return;
            }
        } catch {
            // ignore until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('free-claude-code server did not become ready in time');
}

function stopFreeClaudeServer(): { ok: boolean; message: string } {
    if (!freeClaudeState.process) {
        freeClaudeState.running = false;
        return { ok: true, message: 'free-claude-code is not running' };
    }

    try {
        freeClaudeState.process.kill();
    } catch {
        // ignore kill errors
    }

    freeClaudeState.process = null;
    freeClaudeState.running = false;
    return { ok: true, message: 'free-claude-code stopped' };
}

async function ensureFreeClaudeServer(config?: FreeClaudeConfig): Promise<void> {
    const port = Number(config?.port ?? FREE_CLAUDE_PORT);
    const model = (config?.model?.trim() || 'deepseek/deepseek-chat').trim();
    const apiKey = resolveDeepSeekKey(config?.apiKey);

    if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY is missing (set env or put key in test file)');
    }

    const needsRestart = !freeClaudeState.running
        || freeClaudeState.port !== port
        || freeClaudeState.model !== model
        || !freeClaudeState.process;

    if (!needsRestart) {
        return;
    }

    stopFreeClaudeServer();

    const root = getProjectRoot();
    const bundledExe = getBundledFreeClaudeExePath();
    const useBundledExe = !isDev && fs.existsSync(bundledExe);

    let serverCwd = path.join(root, 'packages', 'free-claude-code');
    let command = 'py';
    let args = ['-3.10', 'server.py'];

    if (useBundledExe) {
        serverCwd = path.dirname(bundledExe);
        command = bundledExe;
        args = [];
    } else {
        const serverScript = path.join(serverCwd, 'server.py');
        if (!fs.existsSync(serverScript)) {
            throw new Error(
                `free-claude-code runtime not found. Checked exe=${bundledExe} and script=${serverScript}`,
            );
        }
    }

    const env = {
        ...process.env,
        DEEPSEEK_API_KEY: apiKey,
        MODEL: model,
        PORT: String(port),
        ANTHROPIC_AUTH_TOKEN: 'freecc',
    };

    const child = spawn(command, args, {
        cwd: serverCwd,
        env,
        shell: false,
        windowsHide: true,
    });

    freeClaudeState.process = child;
    freeClaudeState.running = true;
    freeClaudeState.port = port;
    freeClaudeState.model = model;
    freeClaudeState.apiKeyMasked = maskKey(apiKey);
    freeClaudeState.lastError = null;
    pushFreeClaudeLog(
        `[boot] starting free-claude-code on ${freeClaudeBaseUrl()} with model=${model} mode=${useBundledExe ? 'bundled' : 'python'}`,
    );

    child.stdout.on('data', (chunk) => {
        pushFreeClaudeLog(`[stdout] ${String(chunk).trim()}`);
    });
    child.stderr.on('data', (chunk) => {
        pushFreeClaudeLog(`[stderr] ${String(chunk).trim()}`);
    });
    child.on('exit', (code, signal) => {
        freeClaudeState.running = false;
        freeClaudeState.process = null;
        const reason = `free-claude-code exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
        freeClaudeState.lastError = reason;
        pushFreeClaudeLog(`[exit] ${reason}`);
    });

    await waitForFreeClaudeReady();
}

function extractMessageText(payload: unknown): string {
    const data = payload as {
        content?: Array<{ type?: string; text?: string }>;
        error?: { message?: string };
    };
    const textParts = (data?.content || [])
        .filter((part) => part?.type === 'text' && typeof part?.text === 'string')
        .map((part) => part.text || '');

    if (textParts.length > 0) {
        return textParts.join('\n').trim();
    }

    if (data?.error?.message) {
        throw new Error(data.error.message);
    }

    return '';
}

function extractMessageTextFromSse(raw: string): string {
    const pieces: string[] = [];
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
        if (!line.startsWith('data:')) {
            continue;
        }
        const jsonPart = line.slice(5).trim();
        if (!jsonPart || jsonPart === '[DONE]') {
            continue;
        }
        try {
            const event = JSON.parse(jsonPart) as {
                type?: string;
                delta?: { type?: string; text?: string };
                content_block?: { type?: string; text?: string };
            };
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
                pieces.push(event.delta.text);
            } else if (event.type === 'content_block_start' && event.content_block?.type === 'text' && event.content_block.text) {
                pieces.push(event.content_block.text);
            }
        } catch {
            // ignore malformed SSE data lines
        }
    }

    return pieces.join('').trim();
}

ipcMain.handle('free-claude-control', async (_event, payload?: { action?: FreeClaudeControlAction; config?: FreeClaudeConfig }) => {
    const action = payload?.action || 'status';

    if (action === 'start') {
        try {
            await ensureFreeClaudeServer(payload?.config);
            return {
                ok: true,
                running: freeClaudeState.running,
                baseUrl: freeClaudeBaseUrl(),
                model: freeClaudeState.model,
                apiKeyMasked: freeClaudeState.apiKeyMasked,
                output: freeClaudeState.output.slice(-40),
                error: null,
            };
        } catch (error) {
            freeClaudeState.lastError = error instanceof Error ? error.message : String(error);
            return {
                ok: false,
                running: freeClaudeState.running,
                baseUrl: freeClaudeBaseUrl(),
                model: freeClaudeState.model,
                apiKeyMasked: freeClaudeState.apiKeyMasked,
                output: freeClaudeState.output.slice(-40),
                error: freeClaudeState.lastError,
            };
        }
    }

    if (action === 'stop') {
        const result = stopFreeClaudeServer();
        return {
            ok: result.ok,
            running: freeClaudeState.running,
            baseUrl: freeClaudeBaseUrl(),
            model: freeClaudeState.model,
            apiKeyMasked: freeClaudeState.apiKeyMasked,
            output: freeClaudeState.output.slice(-40),
            error: freeClaudeState.lastError,
            message: result.message,
        };
    }

    return {
        ok: true,
        running: freeClaudeState.running,
        baseUrl: freeClaudeBaseUrl(),
        model: freeClaudeState.model,
        apiKeyMasked: freeClaudeState.apiKeyMasked,
        output: freeClaudeState.output.slice(-40),
        error: freeClaudeState.lastError,
    };
});

ipcMain.handle(
    'free-claude-chat',
    async (
        _event,
        payload: {
            messages: Array<{ role: 'user' | 'assistant'; content: string }>;
            config?: FreeClaudeConfig;
            maxTokens?: number;
            temperature?: number;
        },
    ) => {
        await ensureFreeClaudeServer(payload?.config);

        const response = await fetch(`${freeClaudeBaseUrl()}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'freecc',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: payload?.config?.model || freeClaudeState.model || 'deepseek/deepseek-chat',
                max_tokens: payload?.maxTokens ?? 1024,
                temperature: payload?.temperature ?? 0.2,
                stream: false,
                messages: payload.messages || [],
            }),
        });

        const raw = await response.text();
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // ignore JSON parse error and use text fallback
        }

        if (!response.ok) {
            const errText = (parsed as { error?: { message?: string } })?.error?.message || raw || `HTTP ${response.status}`;
            throw new Error(errText);
        }

        let text = '';
        if (parsed) {
            text = extractMessageText(parsed);
        }
        if (!text) {
            text = extractMessageTextFromSse(raw);
        }
        if (!text && !parsed) {
            text = raw;
        }
        return {
            ok: true,
            message: text || 'Empty response from free-claude-code',
            raw: parsed || raw,
            model: payload?.config?.model || freeClaudeState.model,
        };
    },
);

// ── Auto-updater configuration ──────────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

if (!isDev) {
    const publishUrl = readPublishUrl();
    if (publishUrl) {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: publishUrl,
        });
    }
}

autoUpdater.on('update-available', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available and will be downloaded in the background.`,
        buttons: ['OK'],
    });
});
autoUpdater.on('update-downloaded', (info) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded. Restart to apply the update.`,
        buttons: ['Restart Now', 'Later'],
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});
autoUpdater.on('error', (err) => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Error',
        message: `Failed to check for updates: ${err.message}`,
        buttons: ['OK'],
    });
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        icon: path.join(__dirname, isDev ? '../public/logo.png' : '../dist/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        backgroundColor: '#000000',
        show: false, // Don't show until ready-to-show
    });

    if (isDev) {
        mainWindow.loadURL(`http://localhost:${DEV_PORT}`);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── Window control IPC handlers ──────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

// ── Menu action IPC handlers ────────────────────────────────────────────────
ipcMain.on('menu-check-updates', () => {
    if (isDev) {
        if (!mainWindow) return;
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Check for Updates',
            message: 'You are using the latest version.',
            buttons: ['OK'],
        });
    } else {
        autoUpdater.checkForUpdatesAndNotify();
    }
});
ipcMain.on('menu-restart-to-update', () => {
    autoUpdater.quitAndInstall();
});
ipcMain.on('menu-open-devtools', () => mainWindow?.webContents.toggleDevTools());
ipcMain.on('menu-reload', () => mainWindow?.reload());
ipcMain.on('menu-force-reload', () => mainWindow?.webContents.reloadIgnoringCache());
ipcMain.on('menu-toggle-fullscreen', () => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()));
ipcMain.on('menu-zoom-in', () => {
    if (mainWindow) {
        const zoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(zoom + 0.5);
    }
});
ipcMain.on('menu-zoom-out', () => {
    if (mainWindow) {
        const zoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(zoom - 0.5);
    }
});
ipcMain.on('menu-zoom-reset', () => mainWindow?.webContents.setZoomLevel(0));
ipcMain.on('menu-open-external', (_e, url: string) => shell.openExternal(url));
ipcMain.handle('app-get-version', () => app.getVersion());
ipcMain.on('menu-show-about', () => {
    if (!mainWindow) return;
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About QuantCore Pro',
        message: 'QuantCore Pro',
        detail: `Version: ${app.getVersion()}\n\nProfessional Quantitative Trading Terminal\n\n© ${new Date().getFullYear()} QuantCore`,
        icon: path.join(__dirname, isDev ? '../public/logo.png' : '../dist/logo.png'),
    });
});

// ── System metrics IPC ──────────────────────────────────────────────────────
function getInitialCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        idle += cpu.times.idle;
        total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }
    return { idle, total };
}

let prevCpuTimes = getInitialCpuTimes();

function getCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        idle += cpu.times.idle;
        total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }
    const idleDiff = idle - prevCpuTimes.idle;
    const totalDiff = total - prevCpuTimes.total;
    prevCpuTimes = { idle, total };
    return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
}

ipcMain.handle('get-system-metrics', () => {
    const memUsed = process.memoryUsage().rss;
    const cpuPercent = getCpuUsage();
    return {
        memMB: Math.round(memUsed / 1024 / 1024),
        cpuPercent,
    };
});

app.on('ready', () => {
    createWindow();
    // Auto-check for updates in production
    if (!isDev) {
        setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
    }
});

app.on('window-all-closed', () => {
    stopFreeClaudeServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
