const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'electron-dev';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, // Further reduced for 13-inch MacBook
    height: 700,  // Further reduced for 13-inch MacBook
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    minWidth: 900, // Minimum width for usability
    minHeight: 600,  // Minimum height for usability
    maxWidth: 1200, // Maximum width to prevent overflow
    maxHeight: 800  // Maximum height to prevent overflow
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for screen recording
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    });
    return sources;
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});

// Screen recording functionality - moved to renderer process
ipcMain.handle('start-screen-recording', async (event, sourceId) => {
  try {
    // Send the request to the renderer process
    const result = await event.sender.invoke('start-screen-recording-renderer', sourceId);
    return result;
  } catch (error) {
    console.error('Error starting screen recording:', error);
    throw error;
  }
});

// Webcam recording functionality - moved to renderer process  
ipcMain.handle('start-webcam-recording', async (event, constraints) => {
  try {
    // Send the request to the renderer process
    const result = await event.sender.invoke('start-webcam-recording-renderer', constraints);
    return result;
  } catch (error) {
    console.error('Error starting webcam recording:', error);
    throw error;
  }
});

// File operations
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled) {
      return result.filePaths;
    }
    return [];
  } catch (error) {
    console.error('Error opening file dialog:', error);
    return [];
  }
});

ipcMain.handle('save-file-dialog', async (event, defaultPath) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath || 'exported-video.mp4',
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled) {
      return result.filePath;
    }
    return null;
  } catch (error) {
    console.error('Error opening save dialog:', error);
    return null;
  }
});

// Video processing
ipcMain.handle('process-video', async (event, inputPath, outputPath, options) => {
  return new Promise((resolve, reject) => {
    try {
      let command = ffmpeg(inputPath);
      
      // Apply basic options
      if (options.startTime) {
        command = command.seekInput(options.startTime);
      }
      
      if (options.duration) {
        command = command.duration(options.duration);
      }
      
      if (options.resolution) {
        command = command.size(options.resolution);
      }
      
      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg started:', commandLine);
        })
        .on('progress', (progress) => {
          // Send progress updates to renderer
          mainWindow.webContents.send('export-progress', progress);
        })
        .on('end', () => {
          console.log('FFmpeg finished');
          resolve({ success: true, outputPath });
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    } catch (error) {
      console.error('Error processing video:', error);
      reject(error);
    }
  });
});
