const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  openSystemPreferences: () => ipcRenderer.invoke('open-system-preferences'),

  // Recording control window
  showRecordingControl: () => ipcRenderer.invoke('show-recording-control'),
  closeRecordingControl: () => ipcRenderer.invoke('close-recording-control'),
  
  // Recording overlay window
  showRecordingOverlay: (displayId, windowBounds = null) => ipcRenderer.invoke('show-recording-overlay', displayId, windowBounds),
  closeRecordingOverlay: () => ipcRenderer.invoke('close-recording-overlay'),
  
  // Webcam preview window
  showWebcamPreviewWindow: () => ipcRenderer.invoke('show-webcam-preview-window'),
  closeWebcamPreviewWindow: () => ipcRenderer.invoke('close-webcam-preview-window'),
  sendWebcamFrame: (dataUrl) => ipcRenderer.send('webcam-frame', dataUrl),
  onWebcamFrame: (callback) => {
    ipcRenderer.on('webcam-frame', (event, dataUrl) => callback(dataUrl));
  },
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
  exportVideo: (clips) => ipcRenderer.invoke('export-video', clips),
  
  // Progress updates
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (event, progress) => callback(progress));
  },
  
  removeExportProgressListener: () => {
    ipcRenderer.removeAllListeners('export-progress');
  }
});
