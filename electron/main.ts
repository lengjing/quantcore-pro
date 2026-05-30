import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import dotenv from 'dotenv';

type FreeClaudeProviderId =
    | 'nvidia_nim'
    | 'open_router'
    | 'deepseek'
    | 'mistral'
    | 'mistral_codestral'
    | 'opencode'
    | 'opencode_go'
    | 'wafer'
    | 'kimi'
    | 'cerebras'
    | 'groq'
    | 'fireworks'
    | 'zai'
    | 'lmstudio'
    | 'llamacpp'
    | 'ollama';

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

if (!app.isPackaged) {
    loadDotEnvFiles();
}

const isDev = !app.isPackaged;
const DEV_PORT = process.env.VITE_PORT || process.env.VITE_DEV_PORT || '5173';
const FREE_CLAUDE_PORT = Number(process.env.FREE_CLAUDE_PORT || process.env.PORT || 8082);

const PROVIDER_CREDENTIAL_ENV: Record<FreeClaudeProviderId, string | null> = {
    nvidia_nim: 'NVIDIA_NIM_API_KEY',
    open_router: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    mistral_codestral: 'CODESTRAL_API_KEY',
    opencode: 'OPENCODE_API_KEY',
    opencode_go: 'OPENCODE_API_KEY',
    wafer: 'WAFER_API_KEY',
    kimi: 'KIMI_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
    groq: 'GROQ_API_KEY',
    fireworks: 'FIREWORKS_API_KEY',
    zai: 'ZAI_API_KEY',
    lmstudio: null,
    llamacpp: null,
    ollama: null,
};

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
let pendingUpdateVersion: string | null = null;

type FreeClaudeControlAction = 'start' | 'stop' | 'status';

interface FreeClaudeConfig {
    provider: FreeClaudeProviderId;
    apiKey: string;
    model: string;
    port: number;
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

function resolveProviderKey(provider: FreeClaudeProviderId, explicit?: string): string {
    if (explicit && explicit.trim()) {
        return explicit.trim();
    }

    const credentialEnv = PROVIDER_CREDENTIAL_ENV[provider];
    if (credentialEnv) {
        const envValue = process.env[credentialEnv];
        if (envValue && envValue.trim()) {
            return envValue.trim();
        }
    }

    if (provider === 'deepseek') {
        return resolveDeepSeekKey(explicit);
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

function normalizeModelRef(provider: FreeClaudeProviderId, model?: string): string {
    const trimmed = (model || '').trim();
    if (!trimmed) {
        return `${provider}/local-model`;
    }
    return trimmed.includes('/') ? trimmed : `${provider}/${trimmed}`;
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

async function ensureFreeClaudeServer(config?: Partial<FreeClaudeConfig>): Promise<void> {
    const resolved: FreeClaudeConfig = {
        provider: config?.provider ?? 'deepseek',
        apiKey: config?.apiKey ?? '',
        model: config?.model ?? 'deepseek/deepseek-chat',
        port: Number(config?.port ?? FREE_CLAUDE_PORT),
    };
    const port = resolved.port;
    const provider = resolved.provider;
    const model = normalizeModelRef(provider, resolved.model);
    const apiKey = resolveProviderKey(provider, resolved.apiKey);

    if (!apiKey && PROVIDER_CREDENTIAL_ENV[provider]) {
        throw new Error(`${PROVIDER_CREDENTIAL_ENV[provider]} is missing (set env or put key in test file)`);
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
        ...(PROVIDER_CREDENTIAL_ENV[provider] ? { [PROVIDER_CREDENTIAL_ENV[provider] as string]: apiKey } : {}),
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

// ── Trading Python backend (:5000) ───────────────────────────────────────────

const TRADING_BACKEND_PORT = Number(process.env.TRADING_BACKEND_PORT || 5000);

interface TradingBackendState {
    process: ChildProcessWithoutNullStreams | null;
    running: boolean;
    port: number;
    output: string[];
    lastError: string | null;
}

const tradingBackendState: TradingBackendState = {
    process: null,
    running: false,
    port: TRADING_BACKEND_PORT,
    output: [],
    lastError: null,
};

function pushTradingBackendLog(line: string) {
    tradingBackendState.output.push(line);
    if (tradingBackendState.output.length > 250) {
        tradingBackendState.output = tradingBackendState.output.slice(-250);
    }
    console.log(`[trading-backend] ${line}`);
}

function tradingBackendBaseUrl(): string {
    return `http://127.0.0.1:${tradingBackendState.port}`;
}

function getBundledPythonRuntimeRoot(): string {
    return path.join(process.resourcesPath, 'python-runtime');
}

function getDevPythonRuntimeRoot(): string {
    return path.join(getProjectRoot(), 'runtime', 'python');
}

function resolveEmbeddedPythonBin(runtimeRoot: string): string | null {
    const winBin = path.join(runtimeRoot, 'venv', 'Scripts', 'python.exe');
    const unixBin = path.join(runtimeRoot, 'venv', 'bin', 'python3');
    if (process.platform === 'win32' && fs.existsSync(winBin)) {
        return winBin;
    }
    if (fs.existsSync(unixBin)) {
        return unixBin;
    }
    return null;
}

function resolveTradingBackendLaunch(): { command: string; args: string[]; cwd: string } {
    const devRuntime = getDevPythonRuntimeRoot();
    const bundledRuntime = getBundledPythonRuntimeRoot();
    const useBundled = !isDev && fs.existsSync(bundledRuntime);

    if (useBundled) {
        const pythonBin = resolveEmbeddedPythonBin(bundledRuntime);
        const appCwd = path.join(bundledRuntime, 'app');
        if (!pythonBin || !fs.existsSync(appCwd)) {
            throw new Error(`Bundled Python runtime incomplete: ${bundledRuntime}`);
        }
        return {
            command: pythonBin,
            args: ['main.py'],
            cwd: appCwd,
        };
    }

    const devPython = resolveEmbeddedPythonBin(devRuntime);
    const devAppCwd = path.join(getProjectRoot(), 'python');
    if (devPython && fs.existsSync(devAppCwd)) {
        return {
            command: devPython,
            args: ['main.py'],
            cwd: devAppCwd,
        };
    }

    const fallbackPython = process.platform === 'win32' ? 'python' : 'python3';
    if (!fs.existsSync(devAppCwd)) {
        throw new Error(`Trading backend source not found: ${devAppCwd}`);
    }
    return {
        command: fallbackPython,
        args: ['main.py'],
        cwd: devAppCwd,
    };
}

async function waitForTradingBackendReady(timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${tradingBackendBaseUrl()}/health`);
            if (res.ok) {
                return;
            }
        } catch {
            // ignore until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Trading backend did not become ready in time');
}

function stopTradingBackendServer(): { ok: boolean; message: string } {
    if (!tradingBackendState.process) {
        tradingBackendState.running = false;
        return { ok: true, message: 'Trading backend is not running' };
    }

    try {
        tradingBackendState.process.kill();
    } catch {
        // ignore kill errors
    }

    tradingBackendState.process = null;
    tradingBackendState.running = false;
    return { ok: true, message: 'Trading backend stopped' };
}

async function ensureTradingBackendServer(): Promise<void> {
    if (tradingBackendState.running && tradingBackendState.process) {
        return;
    }

    stopTradingBackendServer();

    const launch = resolveTradingBackendLaunch();
    const env = {
        ...process.env,
        TRADING_BACKEND_PORT: String(tradingBackendState.port),
        TRADING_BACKEND_HOST: '127.0.0.1',
    };

    pushTradingBackendLog(`starting with ${launch.command} ${launch.args.join(' ')} cwd=${launch.cwd}`);

    const child = spawn(launch.command, launch.args, {
        cwd: launch.cwd,
        env,
        shell: false,
        windowsHide: true,
    });

    tradingBackendState.process = child;
    tradingBackendState.running = true;
    tradingBackendState.lastError = null;

    child.stdout.on('data', (chunk) => {
        pushTradingBackendLog(`[stdout] ${String(chunk).trim()}`);
    });
    child.stderr.on('data', (chunk) => {
        pushTradingBackendLog(`[stderr] ${String(chunk).trim()}`);
    });
    child.on('exit', (code, signal) => {
        tradingBackendState.running = false;
        tradingBackendState.process = null;
        const reason = `exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
        tradingBackendState.lastError = reason;
        pushTradingBackendLog(`[exit] ${reason}`);
    });

    await waitForTradingBackendReady();
    pushTradingBackendLog(`ready at ${tradingBackendBaseUrl()}`);
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
    mainWindow?.webContents.send('updater-status', {
        stage: 'available',
        version: info.version,
    });
});
autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateVersion = info.version;
    mainWindow?.webContents.send('updater-status', {
        stage: 'ready',
        version: info.version,
    });
});
autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('updater-status', {
        stage: 'error',
        message: err.message,
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
ipcMain.on('window-close', () => {
    if (pendingUpdateVersion) {
        autoUpdater.quitAndInstall(true, true);
        return;
    }
    mainWindow?.close();
});
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
        autoUpdater.checkForUpdates();
    }
});
ipcMain.on('menu-restart-to-update', () => {
    if (pendingUpdateVersion) {
        autoUpdater.quitAndInstall(true, true);
    } else {
        autoUpdater.checkForUpdates();
    }
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
    ensureTradingBackendServer().catch((error) => {
        tradingBackendState.lastError = error instanceof Error ? error.message : String(error);
        pushTradingBackendLog(`startup failed: ${tradingBackendState.lastError}`);
    });
    // Auto-check for updates in production
    if (!isDev) {
        setTimeout(() => autoUpdater.checkForUpdates(), 5000);
    }
});

app.on('window-all-closed', () => {
    stopFreeClaudeServer();
    stopTradingBackendServer();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
