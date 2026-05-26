import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

const isDev = !app.isPackaged;
const DEV_PORT = process.env.DEV_PORT || '5173';

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcess | null = null;

// ── Auto-updater configuration ──────────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

if (!isDev) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://pub-8a0bf3b6674f429abf20220dbbd6acc7.r2.dev',
    });
}

function sendUpdateStatus(status: string, info?: any) {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status, info });
    }
}

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', info));
autoUpdater.on('update-not-available', (info) => sendUpdateStatus('not-available', info));
autoUpdater.on('download-progress', (progress) => sendUpdateStatus('downloading', progress));
autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', info);
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
autoUpdater.on('error', (err) => sendUpdateStatus('error', err.message));

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

async function waitForServer(url: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch (err) {
            // Server not ready yet, continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Server start timeout');
}

function startPythonProcess() {
    let pythonExecutable = 'python'; // Default to system python in dev

    if (isDev) {
        const scriptPath = path.join(__dirname, '../python/main.py');
        console.log(`Starting Flask server from: ${scriptPath}`);
        pythonProcess = spawn(pythonExecutable, [scriptPath]);
    } else {
        const exePath = path.join(process.resourcesPath, 'python_dist', 'main.exe');
        console.log(`Starting Python server from: ${exePath}`);
        pythonProcess = spawn(exePath);
    }

    if (pythonProcess) {
        pythonProcess.stdout?.on('data', (data) => {
            console.log(`Python stdout: ${data}`);
            if (mainWindow) {
                mainWindow.webContents.send('python-data', data.toString());
            }
        });

        pythonProcess.stderr?.on('data', (data) => {
            console.error(`Python stderr: ${data}`);
            if (mainWindow) {
                mainWindow.webContents.send('python-error', data.toString());
            }
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
        });

        // Wait for Flask server to be ready
        waitForServer('http://localhost:5000/health', 30000)
            .then(() => {
                console.log('Flask server is ready!');
                if (mainWindow) {
                    mainWindow.webContents.send('python-ready', { status: 'ready' });
                }
            })
            .catch((err) => {
                console.error('Flask server failed to start:', err);
            });
    }
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
    sendUpdateStatus('checking');
    if (isDev) {
        // In dev mode, simulate a quick check and report no updates
        setTimeout(() => sendUpdateStatus('not-available'), 1000);
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
let prevCpuTimes: { idle: number; total: number } | null = null;

function getCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        idle += cpu.times.idle;
        total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }
    if (prevCpuTimes) {
        const idleDiff = idle - prevCpuTimes.idle;
        const totalDiff = total - prevCpuTimes.total;
        prevCpuTimes = { idle, total };
        return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
    }
    prevCpuTimes = { idle, total };
    return 0;
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
    startPythonProcess();
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

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});
