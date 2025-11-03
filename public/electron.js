const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, shell } = require('electron');
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
let webcamPreviewWindow = null;

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
  console.log('isDev:', isDev);
  console.log('__dirname:', __dirname);
  
  mainWindow.loadURL(startUrl).catch(err => {
    console.error('Failed to load URL:', err);
    console.error('Error details:', err.message);
    console.error('Stack trace:', err.stack);
    
    // Fallback: try to load a simple HTML page
    console.log('Attempting fallback...');
    const fallbackHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>ClipForge2 - Loading Error</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #1a1a1a; 
              color: white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
            }
            .container { text-align: center; padding: 20px; }
            h1 { color: #4a9eff; }
            .error { color: #ff6b6b; margin: 20px 0; }
            .info { color: #888; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎬 ClipForge2</h1>
            <div class="error">Failed to load the application</div>
            <div class="info">Please check the console for error details</div>
            <div class="info">URL: ${startUrl}</div>
          </div>
        </body>
      </html>
    `;
    
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
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

function createRecordingOverlayWindow(displayId, windowBounds = null) {
  // Close existing overlay if it exists
  if (recordingOverlayWindow) {
    recordingOverlayWindow.close();
    recordingOverlayWindow = null;
  }

  let x, y, width, height;

  if (windowBounds) {
    // Use specific window bounds for window recording
    console.log('Creating overlay for specific window:', windowBounds);
    x = windowBounds.x;
    y = windowBounds.y;
    width = windowBounds.width;
    height = windowBounds.height;
  } else {
    // Use display bounds for screen recording
    const displays = screen.getAllDisplays();
    console.log('Available displays:', displays.map(d => ({ id: d.id, bounds: d.bounds })));
    console.log('Requested display_id:', displayId, 'type:', typeof displayId);

    // Find the display by ID or use primary display
    let targetDisplay = null;

    if (displayId) {
      // Try exact match first
      targetDisplay = displays.find(d => d.id === displayId);

      // If no exact match, try converting types
      if (!targetDisplay) {
        targetDisplay = displays.find(d => d.id.toString() === displayId.toString());
      }

      // If still no match, try parsing the display_id if it's in format like "screen:1234:0"
      if (!targetDisplay && typeof displayId === 'string') {
        const parts = displayId.split(':');
        if (parts.length > 1) {
          const numericId = parseInt(parts[1], 10);
          targetDisplay = displays.find(d => d.id === numericId);
        }
      }
    }

    // Fall back to primary display if no match found
    if (!targetDisplay) {
      console.log('No matching display found, using primary display');
      targetDisplay = screen.getPrimaryDisplay();
    }

    // Use workArea to exclude menu bar and dock on macOS
    const workArea = targetDisplay.workArea;
    x = workArea.x;
    y = workArea.y;
    width = workArea.width;
    height = workArea.height;
  }
  console.log('Creating overlay:', {
    displayId,
    windowBounds,
    bounds: { x, y, width, height }
  });

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Make the window click-through so users can interact with the screen
  recordingOverlayWindow.setIgnoreMouseEvents(true);

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

function createWebcamPreviewWindow() {
  // Close existing webcam preview if it exists
  if (webcamPreviewWindow) {
    webcamPreviewWindow.close();
    webcamPreviewWindow = null;
  }

  // Create webcam preview window
  webcamPreviewWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    movable: true,
    focusable: true,
    title: 'Webcam Preview',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  //Enable logging for preview window
  webcamPreviewWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level === 2) { // error
      console.error(`[Preview Console Error]: ${message}`);
    } else if (level === 1) { // warning
      console.warn(`[Preview Console Warning]: ${message}`);
    } else {
      console.log(`[Preview Console]: ${message}`);
    }
  });

  // Load the webcam preview HTML file
  webcamPreviewWindow.loadFile(path.join(__dirname, 'webcam-preview.html'));
  webcamPreviewWindow.show();

  webcamPreviewWindow.on('closed', () => {
    webcamPreviewWindow = null;
  });

  return webcamPreviewWindow;
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
      thumbnailSize: { width: 300, height: 200 }
    });

    console.log('desktopCapturer returned', sources.length, 'sources');

    // Convert sources to plain objects with thumbnail data URLs
    const simpleSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));

    console.log('Returning sources:', simpleSources.length, 'sources with thumbnails');
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
ipcMain.handle('show-recording-overlay', (event, displayId, windowBounds = null) => {
  try {
    createRecordingOverlayWindow(displayId, windowBounds);
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

// Webcam preview window handlers
ipcMain.handle('show-webcam-preview-window', () => {
  try {
    createWebcamPreviewWindow();
    return true;
  } catch (error) {
    console.error('Error creating webcam preview window:', error);
    return false;
  }
});

ipcMain.handle('close-webcam-preview-window', () => {
  if (webcamPreviewWindow) {
    webcamPreviewWindow.close();
    webcamPreviewWindow = null;
  }
  return true;
});

// Send webcam frame to preview window
ipcMain.on('webcam-frame', (event, dataUrl) => {
  console.log('Received webcam frame in main process, size:', dataUrl ? dataUrl.length : 'null');
  if (webcamPreviewWindow && !webcamPreviewWindow.isDestroyed()) {
    webcamPreviewWindow.webContents.send('webcam-frame', dataUrl);
    console.log('Sent webcam frame to preview window');
  } else {
    console.log('Preview window not available or destroyed');
  }
});

// Open System Preferences for screen recording permission
ipcMain.handle('open-system-preferences', () => {
  try {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    return true;
  } catch (error) {
    console.error('Error opening System Preferences:', error);
    return false;
  }
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

// Video export
ipcMain.handle('export-video', async (event, clips) => {
  try {
    if (!clips || clips.length === 0) {
      throw new Error('No clips to export');
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'exported-video.mp4',
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, message: 'Export cancelled' };
    }

    const outputPath = result.filePath;
    
    // For now, if there's only one clip, just copy it
    if (clips.length === 1) {
      const clip = clips[0];
      const inputPath = clip.file.path || URL.createObjectURL(clip.file);
      
      // Use FFmpeg to process the video
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg started:', commandLine);
          })
          .on('progress', (progress) => {
            mainWindow.webContents.send('export-progress', progress);
          })
          .on('end', () => {
            console.log('Export finished');
            resolve({ success: true, outputPath });
          })
          .on('error', (err) => {
            console.error('Export error:', err);
            reject(err);
          })
          .run();
      });
    } else {
      // Multiple clips - concatenate them
      // This is a simplified version - in a real app you'd want more sophisticated editing
      const inputPath = clips[0].file.path || URL.createObjectURL(clips[0].file);
      
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('FFmpeg started:', commandLine);
          })
          .on('progress', (progress) => {
            mainWindow.webContents.send('export-progress', progress);
          })
          .on('end', () => {
            console.log('Export finished');
            resolve({ success: true, outputPath });
          })
          .on('error', (err) => {
            console.error('Export error:', err);
            reject(err);
          })
          .run();
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, message: error.message };
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
