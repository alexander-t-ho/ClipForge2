const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),

  // Recording control window
  showRecordingControl: () => ipcRenderer.invoke('show-recording-control'),
  closeRecordingControl: () => ipcRenderer.invoke('close-recording-control'),
  sendRecordingControlAction: (action) => ipcRenderer.send('recording-control-action', action),
  onRecordingControlAction: (callback) => {
    ipcRenderer.on('recording-control-action', (event, action) => callback(action));
  },
  updateRecordingTime: (time) => ipcRenderer.send('update-recording-time', time),
  onUpdateRecordingTime: (callback) => {
    ipcRenderer.on('update-recording-time', (event, time) => callback(time));
  },

  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultPath) => ipcRenderer.invoke('save-file-dialog', defaultPath),
  
  // Video processing
  processVideo: (inputPath, outputPath, options) => ipcRenderer.invoke('process-video', inputPath, outputPath, options),
  
  // Progress updates
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (event, progress) => callback(progress));
  },
  
  removeExportProgressListener: () => {
    ipcRenderer.removeAllListeners('export-progress');
  }
});
