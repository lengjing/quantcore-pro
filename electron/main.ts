import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const isDev = !app.isPackaged;

// Read port from .env file (VITE_DEV_PORT), fallback to 5173
function readDevPort(): string {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^VITE_DEV_PORT\s*=\s*(\d+)/m);
        if (match) return match[1];
    } catch { /* ignore */ }
    return '5173';
}
const DEV_PORT = readDevPort();

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
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
