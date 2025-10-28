const { app, BrowserWindow, ipcMain, screen, WebContentsView } = require('electron');
const path = require('path');

let mainWindow;
let settingsWindow = null;
let webContentsView;

// Layout constants
const TITLEBAR_HEIGHT = 32;
const HOVER_STRIP_HEIGHT = 50;

// Track titlebar visibility state
let titlebarVisible = false;

// CRITICAL: Define updateWebViewBounds at module scope so IPC handler can access it
function updateWebViewBounds(isTitlebarVisible) {
  if (!mainWindow || !webContentsView) return;
  
  const bounds = mainWindow.getBounds();
  const yOffset = isTitlebarVisible ? TITLEBAR_HEIGHT : 0;
  const availableHeight = bounds.height - yOffset - HOVER_STRIP_HEIGHT;
  
  webContentsView.setBounds({
    x: 0,
    y: yOffset,
    width: bounds.width,
    height: availableHeight
  });
  
  console.log(`[WEBVIEW] Bounds set - y: ${yOffset}, height: ${availableHeight}, titlebar: ${isTitlebarVisible}`);
}

function createWindow() {
  // Transparent frameless windows for overlay effect
  mainWindow = new BrowserWindow({
    width: 800,
    height: 1000,
    minWidth: 300,
    minHeight: 600,
    frame: false,
    transparent: true,  // Main window transparent
    resizable: false,   // Custom resize handles
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: false
    },
    show: false
  });

  // Load HTML
  const debugMode = process.env.DEBUG === 'true';
  if (debugMode) {
    mainWindow.loadFile('index-debug.html');
    console.log('Loading in DEBUG mode');
  } else {
    mainWindow.loadFile('index.html');
  }

  // Create WebContentsView
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  console.log('[WEBVIEW] WebContentsView created');

  // Add view to window
  mainWindow.contentView.addChildView(webContentsView);

  // Initial position - titlebar hidden
  updateWebViewBounds(false);

  // Context menu handlers
  webContentsView.webContents.on('context-menu', (event, params) => {
    console.log('[MAIN] Context menu from WebContentsView');
    event.preventDefault();
    mainWindow.webContents.send('titlebar-toggle');
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    console.log('[MAIN] Context menu from main window');
    event.preventDefault();
    mainWindow.webContents.send('titlebar-toggle');
  });

  // Load default URL
  webContentsView.webContents.loadURL('https://sigrid.ttt-timer.com');

  // MINIMAL CSS injection - only page background, leave content alone
  webContentsView.webContents.on('did-finish-load', () => {
    console.log('[WEBVIEW] Page loaded, injecting minimal transparent background CSS');
    
    // ONLY target the body background, nothing else
    // Let the website keep all its own styling for content
    webContentsView.webContents.insertCSS(`
      body {
        background: transparent !important;
      }
    `).then(() => {
      console.log('[WEBVIEW] Minimal CSS injected - body background only');
      console.log('[WEBVIEW] Website content keeps original styling');
    }).catch(err => {
      console.error('[WEBVIEW] Failed to inject CSS:', err);
    });

    // Apply saved settings
    if (mainWindow && mainWindow.webContents) {
      // Apply zoom
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('zoom-level') || '100'
      `).then((zoomPercent) => {
        const zoomFactor = parseFloat(zoomPercent) / 100;
        webContentsView.webContents.setZoomFactor(zoomFactor);
        console.log(`[ZOOM] Applied: ${zoomPercent}%`);
      });
    }
  });

  // Re-inject CSS on navigation (minimal)
  webContentsView.webContents.on('did-navigate', () => {
    console.log('[WEBVIEW] Navigation detected, re-injecting minimal CSS');
    webContentsView.webContents.insertCSS(`
      body {
        background: transparent !important;
      }
    `).catch(err => {
      console.error('[WEBVIEW] Failed to re-inject CSS on navigation:', err);
    });
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const bounds = mainWindow.getBounds();
    console.log(`[WINDOW] Initial size: ${bounds.width} x ${bounds.height}`);
  });

  // DevTools (comment out for production)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', function () {
    mainWindow = null;
    webContentsView = null;
    if (settingsWindow) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });
}

// IPC handler for titlebar visibility - CRITICAL FIX
ipcMain.on('titlebar-visibility-changed', (event, isVisible) => {
  console.log(`[TITLEBAR] IPC received - visibility: ${isVisible}`);
  titlebarVisible = isVisible;
  
  // Call updateWebViewBounds IMMEDIATELY
  updateWebViewBounds(isVisible);
  
  console.log(`[TITLEBAR] WebView bounds updated, titlebar ${isVisible ? 'ACCESSIBLE' : 'HIDDEN'}`);
});

// Create settings window
function createSettingsWindow() {
  if (settingsWindow) {
    console.log('[SETTINGS] Window already open, focusing');
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
    console.log('[SETTINGS] Window shown');
  });

  settingsWindow.on('closed', () => {
    console.log('[SETTINGS] Window closed');
    settingsWindow = null;
  });
}

// Window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
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
  if (mainWindow) mainWindow.close();
});

// Custom window resizing
ipcMain.on('window-resize', (event, { direction, deltaX, deltaY }) => {
  if (!mainWindow) return;

  const bounds = mainWindow.getBounds();
  const newBounds = { ...bounds };

  // Calculate new bounds
  switch (direction) {
    case 'n':
      newBounds.y += deltaY;
      newBounds.height -= deltaY;
      break;
    case 's':
      newBounds.height += deltaY;
      break;
    case 'e':
      newBounds.width += deltaX;
      break;
    case 'w':
      newBounds.x += deltaX;
      newBounds.width -= deltaX;
      break;
    case 'ne':
      newBounds.y += deltaY;
      newBounds.height -= deltaY;
      newBounds.width += deltaX;
      break;
    case 'nw':
      newBounds.y += deltaY;
      newBounds.height -= deltaY;
      newBounds.x += deltaX;
      newBounds.width -= deltaX;
      break;
    case 'se':
      newBounds.height += deltaY;
      newBounds.width += deltaX;
      break;
    case 'sw':
      newBounds.height += deltaY;
      newBounds.x += deltaX;
      newBounds.width -= deltaX;
      break;
  }

  // Apply minimum size
  if (newBounds.width < 300) newBounds.width = 300;
  if (newBounds.height < 600) newBounds.height = 600;

  // Adjust position for minimum size
  if (direction.includes('w') && newBounds.width === 300) {
    newBounds.x = bounds.x + bounds.width - 300;
  }
  if (direction.includes('n') && newBounds.height === 600) {
    newBounds.y = bounds.y + bounds.height - 600;
  }

  // Apply new bounds
  mainWindow.setBounds(newBounds);

  // Update WebContentsView
  updateWebViewBounds(titlebarVisible);
});

// Mousewheel scrolling
ipcMain.on('window-scroll', (event, deltaY) => {
  if (webContentsView && webContentsView.webContents) {
    webContentsView.webContents.executeJavaScript(`
      window.scrollBy(0, ${deltaY});
    `).catch(err => {
      console.error('[SCROLL] Error:', err);
    });
  }
});

// Renderer logs
ipcMain.on('renderer-log', (event, message) => {
  console.log(message);
});

// Mouse position
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
      return mainWindow.getBounds();
    }
    return null;
  } catch (err) {
    console.error('Error getting window bounds:', err);
    return null;
  }
});

// URL management
ipcMain.on('load-url', (event, url) => {
  console.log('[URL] Loading:', url);
  if (webContentsView && webContentsView.webContents) {
    webContentsView.webContents.loadURL(url);
  }
});

ipcMain.handle('get-current-url', () => {
  if (webContentsView && webContentsView.webContents) {
    return webContentsView.webContents.getURL();
  }
  return 'https://sigrid.ttt-timer.com';
});

// Settings
ipcMain.on('open-settings', () => {
  console.log('[SETTINGS] Opening');
  createSettingsWindow();
});

ipcMain.on('close-settings-window', () => {
  console.log('[SETTINGS] Closing');
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
});

// Team management
ipcMain.handle('get-current-team', (event) => {
  if (mainWindow && mainWindow.webContents) {
    return mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('selected-team') || 'sigrid'
    `);
  }
  return 'sigrid';
});

ipcMain.on('save-team', (event, team) => {
  console.log('[SETTINGS] Saving team:', team);
  
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('selected-team', '${team}');
    `).then(() => {
      console.log('[SETTINGS] Team saved');
      mainWindow.webContents.send('team-updated', team);
    });
  }
});

// Zoom management
ipcMain.handle('get-current-zoom', (event) => {
  if (mainWindow && mainWindow.webContents) {
    return mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('zoom-level') || '100'
    `);
  }
  return '100';
});

ipcMain.on('set-zoom-level', (event, zoomPercent) => {
  if (webContentsView && webContentsView.webContents) {
    const zoomFactor = parseFloat(zoomPercent) / 100;
    webContentsView.webContents.setZoomFactor(zoomFactor);
    console.log(`[ZOOM] Set to ${zoomPercent}%`);
  }
});

ipcMain.on('save-zoom', (event, zoomPercent) => {
  console.log('[SETTINGS] Saving zoom:', zoomPercent + '%');
  
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('zoom-level', '${zoomPercent}');
    `).then(() => {
      console.log('[SETTINGS] Zoom saved');
    });
  }
});

// Transparency management - CSS handles minimal background transparency
ipcMain.handle('get-current-transparency', (event) => {
  return '100';
});

ipcMain.on('set-transparency', (event, transparencyPercent) => {
  console.log(`[TRANSPARENCY] Slider at ${transparencyPercent}% (only body background is transparent)`);
});

ipcMain.on('save-transparency', (event, transparencyPercent) => {
  console.log('[SETTINGS] Transparency value saved:', transparencyPercent + '%');
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

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol === 'file:') return;
    event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});