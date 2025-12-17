import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    onPythonData: (callback: (data: string) => void) => {
        ipcRenderer.on('python-data', (_event, data) => callback(data));
    },
    onPythonError: (callback: (data: string) => void) => {
        ipcRenderer.on('python-error', (_event, data) => callback(data));
    },
    sendToPython: (data: string) => {
        ipcRenderer.send('to-python', data);
    }
});
