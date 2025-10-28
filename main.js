const { app, BrowserWindow, ipcMain, screen, WebContentsView } = require('electron');
const path = require('path');

let mainWindow;
let settingsWindow = null;
let webContentsView;

// Layout constants
const TITLEBAR_HEIGHT = 32;
const HOVER_STRIP_HEIGHT = 50;

function createWindow() {
  // Note: Transparent frameless windows on Windows don't show resize borders
  // If resizing doesn't work, set transparent: false and backgroundColor: '#ffffff'
  mainWindow = new BrowserWindow({
    width: 800,
    height: 1000,
    minWidth: 300,
    minHeight: 600,
    frame: false,
    transparent: true,  // Changed from true to enable visible resize borders
    resizable: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: false
    },
    backgroundColor: '#ffffff',  // Changed from transparent to white
    show: false
  });

  // Load debug version if DEBUG environment variable is set
  const debugMode = process.env.DEBUG === 'true';
  if (debugMode) {
    mainWindow.loadFile('index-debug.html');
    console.log('Loading in DEBUG mode');
  } else {
    mainWindow.loadFile('index.html');
  }

  // Create WebContentsView for the embedded browser
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Add the view to the window
  mainWindow.contentView.addChildView(webContentsView);

  // Position the view between titlebar and hover strip
  const bounds = mainWindow.getBounds();
  const webviewHeight = bounds.height - TITLEBAR_HEIGHT - HOVER_STRIP_HEIGHT;
  webContentsView.setBounds({
    x: 0,
    y: TITLEBAR_HEIGHT,
    width: bounds.width,
    height: webviewHeight
  });

  console.log('WebContentsView positioned at:', {
    x: 0,
    y: TITLEBAR_HEIGHT,
    width: bounds.width,
    height: webviewHeight,
    note: 'Between titlebar (32px) and hover strip (50px)'
  });

  // CRITICAL: Intercept context menu from WebContentsView
  webContentsView.webContents.on('context-menu', (event, params) => {
    console.log('[MAIN] Context menu event from WebContentsView at:', params.x, params.y);
    event.preventDefault(); // Prevent default context menu
    
    // Send IPC to renderer to toggle titlebar
    console.log('[MAIN] Sending titlebar-toggle command to renderer');
    mainWindow.webContents.send('titlebar-toggle');
  });

  // Also intercept context menu from main window (for clicks on HTML areas)
  mainWindow.webContents.on('context-menu', (event, params) => {
    console.log('[MAIN] Context menu event from main window at:', params.x, params.y);
    event.preventDefault(); // Prevent default context menu
    
    // Send IPC to renderer to toggle titlebar
    console.log('[MAIN] Sending titlebar-toggle command to renderer');
    mainWindow.webContents.send('titlebar-toggle');
  });

  // Load default URL (will be overridden by saved team preference in renderer)
  webContentsView.webContents.loadURL('https://sigrid.ttt-timer.com');

  // Apply saved zoom level when webContentsView finishes loading
  webContentsView.webContents.on('did-finish-load', () => {
    if (mainWindow && mainWindow.webContents) {
      // Apply saved zoom level
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('zoom-level') || '100'
      `).then((zoomPercent) => {
        const zoomFactor = parseFloat(zoomPercent) / 100;
        webContentsView.webContents.setZoomFactor(zoomFactor);
        console.log(`[ZOOM] Applied saved zoom level: ${zoomPercent}% (factor: ${zoomFactor})`);
      });

      // Apply saved transparency level
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('transparency-level') || '100'
      `).then((transparencyPercent) => {
        const opacity = parseFloat(transparencyPercent) / 100;
        
        // Call the website's API methods if they exist
        webContentsView.webContents.executeJavaScript(`
          (function() {
            try {
              if (window.TTTTimerAPI && typeof window.TTTTimerAPI.setOpacity === 'function') {
                window.TTTTimerAPI.setOpacity(${opacity});
                console.log('[TTTTimerAPI] setOpacity(${opacity}) applied on load');
              }
              if (window.TTTTimerAPI && typeof window.TTTTimerAPI.setBackgroundOpacity === 'function') {
                window.TTTTimerAPI.setBackgroundOpacity(${opacity});
                console.log('[TTTTimerAPI] setBackgroundOpacity(${opacity}) applied on load');
              }
            } catch (err) {
              console.error('[TTTTimerAPI] Error applying saved transparency:', err);
            }
          })();
        `).catch(err => {
          console.error('[TRANSPARENCY] Error executing transparency script on load:', err);
        });
        
        console.log(`[TRANSPARENCY] Applied saved transparency: ${transparencyPercent}% (opacity: ${opacity})`);
      });
    }
  });

  // Update view size when window is resized
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    const webviewHeight = bounds.height - TITLEBAR_HEIGHT - HOVER_STRIP_HEIGHT;
    webContentsView.setBounds({
      x: 0,
      y: TITLEBAR_HEIGHT,
      width: bounds.width,
      height: webviewHeight
    });
    
    // Log current window size for user to determine preferred size
    console.log(`[WINDOW SIZE] Current: ${bounds.width} x ${bounds.height}`);
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const bounds = mainWindow.getBounds();
    console.log(`[WINDOW SIZE] Initial: ${bounds.width} x ${bounds.height}`);
  });

  // ENABLE DevTools to see renderer errors (comment out for production)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', function () {
    mainWindow = null;
    webContentsView = null;
    // Close settings window if open
    if (settingsWindow) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  // Handle window maximize state
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
    const bounds = mainWindow.getBounds();
    const webviewHeight = bounds.height - TITLEBAR_HEIGHT - HOVER_STRIP_HEIGHT;
    webContentsView.setBounds({
      x: 0,
      y: TITLEBAR_HEIGHT,
      width: bounds.width,
      height: webviewHeight
    });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
    const bounds = mainWindow.getBounds();
    const webviewHeight = bounds.height - TITLEBAR_HEIGHT - HOVER_STRIP_HEIGHT;
    webContentsView.setBounds({
      x: 0,
      y: TITLEBAR_HEIGHT,
      width: bounds.width,
      height: webviewHeight
    });
  });
}

// Create settings window
function createSettingsWindow() {
  // If settings window already exists, focus it
  if (settingsWindow) {
    console.log('[SETTINGS] Settings window already open, focusing');
    settingsWindow.focus();
    return;
  }

  console.log('[SETTINGS] Creating settings window');
  settingsWindow = new BrowserWindow({
    width: 550,
    height: 500,
    minWidth: 450,
    minHeight: 400,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#ffffff',
    show: false
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    console.log('[SETTINGS] Settings window shown');
  });

  settingsWindow.on('closed', () => {
    console.log('[SETTINGS] Settings window closed');
    settingsWindow = null;
  });

  // Enable DevTools for settings window (optional)
  // settingsWindow.webContents.openDevTools({ mode: 'detach' });
}

// IPC handlers for window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-toggle-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// IPC handler for renderer console logs (forward to terminal)
ipcMain.on('renderer-log', (event, message) => {
  console.log(message);
});

// IPC handlers for mouse position tracking
ipcMain.handle('get-mouse-position', () => {
  try {
    const point = screen.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  } catch (err) {
    console.error('Error getting mouse position:', err);
    return null;
  }
});

ipcMain.handle('get-window-bounds', () => {
  try {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      return bounds;
    }
    return null;
  } catch (err) {
    console.error('Error getting window bounds:', err);
    return null;
  }
});

// IPC handler for loading URL in WebContentsView
ipcMain.on('load-url', (event, url) => {
  console.log('[SETTINGS] Loading URL:', url);
  if (webContentsView && webContentsView.webContents) {
    webContentsView.webContents.loadURL(url);
  }
});

// IPC handler to get current URL
ipcMain.handle('get-current-url', () => {
  if (webContentsView && webContentsView.webContents) {
    const url = webContentsView.webContents.getURL();
    return url;
  }
  return 'https://sigrid.ttt-timer.com';
});

// IPC handler to open settings window
ipcMain.on('open-settings', () => {
  console.log('[SETTINGS] Opening settings window');
  createSettingsWindow();
});

// IPC handler to close settings window
ipcMain.on('close-settings-window', () => {
  console.log('[SETTINGS] Closing settings window');
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
});

// IPC handler to get current team from main window
ipcMain.handle('get-current-team', (event) => {
  // The team is stored in localStorage of the main window
  // We need to execute JavaScript in the main window to get it
  if (mainWindow && mainWindow.webContents) {
    return mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('selected-team') || 'sigrid'
    `);
  }
  return 'sigrid';
});

// IPC handler to save team (from settings window)
ipcMain.on('save-team', (event, team) => {
  console.log('[SETTINGS] Saving team:', team);
  
  // Save to main window's localStorage
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('selected-team', '${team}');
    `).then(() => {
      console.log('[SETTINGS] Team saved to localStorage');
      
      // Notify main window to update
      mainWindow.webContents.send('team-updated', team);
    });
  }
});

// IPC handler to get current zoom level from main window
ipcMain.handle('get-current-zoom', (event) => {
  if (mainWindow && mainWindow.webContents) {
    return mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('zoom-level') || '100'
    `);
  }
  return '100';
});

// IPC handler to set zoom level on webContentsView
ipcMain.on('set-zoom-level', (event, zoomPercent) => {
  if (webContentsView && webContentsView.webContents) {
    // Convert percentage to zoom factor (100% = 1.0, 200% = 2.0, etc)
    const zoomFactor = parseFloat(zoomPercent) / 100;
    webContentsView.webContents.setZoomFactor(zoomFactor);
    console.log(`[SETTINGS] Zoom level set to ${zoomPercent}% (factor: ${zoomFactor})`);
  }
});

// IPC handler to save zoom level (from settings window)
ipcMain.on('save-zoom', (event, zoomPercent) => {
  console.log('[SETTINGS] Saving zoom level:', zoomPercent + '%');
  
  // Save to main window's localStorage
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('zoom-level', '${zoomPercent}');
    `).then(() => {
      console.log('[SETTINGS] Zoom level saved to localStorage');
    });
  }
});

// IPC handler to get current transparency from main window
ipcMain.handle('get-current-transparency', (event) => {
  if (mainWindow && mainWindow.webContents) {
    return mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('transparency-level') || '100'
    `);
  }
  return '100';
});

// IPC handler to set transparency on webContentsView
ipcMain.on('set-transparency', (event, transparencyPercent) => {
  if (webContentsView && webContentsView.webContents) {
    const opacity = parseFloat(transparencyPercent) / 100;
    
    // Call the website's API methods if they exist
    webContentsView.webContents.executeJavaScript(`
      (function() {
        try {
          if (window.TTTTimerAPI && typeof window.TTTTimerAPI.setOpacity === 'function') {
            window.TTTTimerAPI.setOpacity(${opacity});
            console.log('[TTTTimerAPI] setOpacity(${opacity}) called');
          }
          if (window.TTTTimerAPI && typeof window.TTTTimerAPI.setBackgroundOpacity === 'function') {
            window.TTTTimerAPI.setBackgroundOpacity(${opacity});
            console.log('[TTTTimerAPI] setBackgroundOpacity(${opacity}) called');
          }
        } catch (err) {
          console.error('[TTTTimerAPI] Error setting transparency:', err);
        }
      })();
    `).catch(err => {
      console.error('[SETTINGS] Error executing transparency script:', err);
    });
    
    console.log(`[SETTINGS] Transparency set to ${transparencyPercent}% (opacity: ${opacity})`);
  }
});

// IPC handler to save transparency level (from settings window)
ipcMain.on('save-transparency', (event, transparencyPercent) => {
  console.log('[SETTINGS] Saving transparency level:', transparencyPercent + '%');
  
  // Save to main window's localStorage
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('transparency-level', '${transparencyPercent}');
    `).then(() => {
      console.log('[SETTINGS] Transparency level saved to localStorage');
    });
  }
});

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Security recommendations
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.protocol === 'file:') {
      return;
    }
    
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});