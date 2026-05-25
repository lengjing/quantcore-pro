import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcess | null = null;

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
        mainWindow.loadURL('http://localhost:5173');
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

app.on('ready', () => {
    createWindow();
    startPythonProcess();
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
