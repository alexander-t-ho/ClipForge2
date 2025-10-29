const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Disable telemetry and metrics collection to prevent popup errors
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-ipc-flooding-protection');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-background-mode');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-translate');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('no-first-run');
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('disable-logging');
app.commandLine.appendSwitch('silent');

// Disable telemetry
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_DISABLE_GPU = 'false';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'electron-dev';

let mainWindow;
let recordingControlWindow = null;
let recordingOverlayWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, // Further reduced for 13-inch MacBook
    height: 700,  // Further reduced for 13-inch MacBook
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Disable additional telemetry and metrics
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'VizDisplayCompositor',
      // Enable screen capture and camera access
      enableWebSQL: false
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
  
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
  });

  // Console message handler - show all errors and warnings for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Filter out only specific telemetry messages
    if (message.includes('codemetrics') || message.includes('telemetry')) {
      return;
    }
    
    // Always show errors and warnings
    if (level === 2) { // error
      console.error(`[Console Error]: ${message}`);
    } else if (level === 1) { // warning
      console.warn(`[Console Warning]: ${message}`);
    } else {
      console.log(`[Console]: ${message}`);
    }
  });

  // Handle page errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', errorCode, errorDescription, validatedURL);
  });

  // Handle certificate errors silently
  mainWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // Handle unresponsive pages
  mainWindow.webContents.on('unresponsive', () => {
    console.log('Page became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('Page became responsive again');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
    // Log when page loads
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page finished loading');
      mainWindow.webContents.executeJavaScript(`
        console.log('Window location:', window.location.href);
        console.log('Root element exists:', !!document.getElementById('root'));
        console.log('Root element:', document.getElementById('root'));
        if (typeof React !== 'undefined') {
          console.log('React is available');
        } else {
          console.error('React is NOT available');
        }
      `).catch(err => console.error('JS execution error:', err));
    });
    
    // Log when DOM is ready
    mainWindow.webContents.on('dom-ready', () => {
      console.log('DOM is ready');
    });
    
    // Log any failed navigation
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createRecordingControlWindow() {
  if (recordingControlWindow) {
    recordingControlWindow.focus();
    return recordingControlWindow;
  }

  recordingControlWindow = new BrowserWindow({
    width: 400,
    height: 90,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the recording control HTML
  recordingControlWindow.loadFile(path.join(__dirname, 'recording-control.html'));

  recordingControlWindow.on('closed', () => {
    recordingControlWindow = null;
  });

  return recordingControlWindow;
}

function createRecordingOverlayWindow(displayId) {
  // Close existing overlay if it exists
  if (recordingOverlayWindow) {
    recordingOverlayWindow.close();
    recordingOverlayWindow = null;
  }

  // Get all displays
  const displays = screen.getAllDisplays();
  
  // Find the display by ID or use primary display
  let targetDisplay = displays[0];
  if (displayId) {
    const foundDisplay = displays.find(d => d.id === displayId);
    if (foundDisplay) {
      targetDisplay = foundDisplay;
    }
  }

  const { x, y, width, height } = targetDisplay.bounds;

  // Create a transparent overlay window with just a red border
  recordingOverlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    clickThrough: true, // Allow clicks to pass through
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Create HTML content for red border overlay
  const overlayHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 100vw;
          height: 100vh;
          background: transparent;
          border: 4px solid #ff0000;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
          pointer-events: none;
        }
      </style>
    </head>
    <body></body>
    </html>
  `;

  recordingOverlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHTML)}`);
  recordingOverlayWindow.show();

  recordingOverlayWindow.on('closed', () => {
    recordingOverlayWindow = null;
  });

  return recordingOverlayWindow;
}

// Global error handling to prevent popups
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

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
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });

    console.log('desktopCapturer returned', sources.length, 'sources');

    // Convert sources to plain objects without thumbnails (thumbnails can cause IPC issues)
    const simpleSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      appIcon: null // Don't send thumbnail data through IPC
    }));

    console.log('Returning sources:', simpleSources);
    return simpleSources;
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});

// Recording control window handlers
ipcMain.handle('show-recording-control', () => {
  const window = createRecordingControlWindow();
  return true;
});

ipcMain.handle('close-recording-control', () => {
  if (recordingControlWindow) {
    recordingControlWindow.close();
    recordingControlWindow = null;
  }
  return true;
});

// Recording overlay window handlers
ipcMain.handle('show-recording-overlay', (event, displayId) => {
  try {
    createRecordingOverlayWindow(displayId);
    return true;
  } catch (error) {
    console.error('Error creating recording overlay:', error);
    return false;
  }
});

ipcMain.handle('close-recording-overlay', () => {
  if (recordingOverlayWindow) {
    recordingOverlayWindow.close();
    recordingOverlayWindow = null;
  }
  return true;
});

// Forward recording control events to main window
ipcMain.on('recording-control-action', (event, action) => {
  if (mainWindow) {
    mainWindow.webContents.send('recording-control-action', action);
  }
});

// Update recording time in control window
ipcMain.on('update-recording-time', (event, time) => {
  if (recordingControlWindow) {
    recordingControlWindow.webContents.send('update-recording-time', time);
  }
});

// Screen recording and webcam recording are handled directly in preload.js via getUserMedia
// No IPC handlers needed - the renderer process calls getUserMedia directly with Electron-specific constraints

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
