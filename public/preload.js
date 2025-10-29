const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  startScreenRecording: async (sourceId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        }
      });
      
      // Validate the stream
      if (!stream || !stream.getVideoTracks().length) {
        throw new Error('No video tracks available in the stream');
      }
      
      return stream;
    } catch (error) {
      console.error('Error starting screen recording:', error);
      throw error;
    }
  },
  
  // Webcam capture
  startWebcamRecording: async (constraints) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Validate the stream
      if (!stream || !stream.getVideoTracks().length) {
        throw new Error('No video tracks available in the webcam stream');
      }
      
      return stream;
    } catch (error) {
      console.error('Error starting webcam recording:', error);
      throw error;
    }
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
