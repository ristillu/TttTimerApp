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

// Helper function to get opacity from React app with retry logic
async function getOpacityFromReactApp(maxAttempts = 10, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[TRANSPARENCY] Attempt ${attempt}/${maxAttempts} to get opacity from React app...`);
      
      if (!webContentsView || !webContentsView.webContents) {
        console.log('[TRANSPARENCY] WebContentsView not ready yet');
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      const opacity = await webContentsView.webContents.executeJavaScript(`
        (function() {
          if (window.TTTTimerAPI && typeof window.TTTTimerAPI.getOpacity === 'function') {
            const value = window.TTTTimerAPI.getOpacity();
            console.log('[TTTTimerAPI] getOpacity() returned:', value);
            return value;
          } else {
            console.log('[TTTTimerAPI] API not ready yet');
            return null;
          }
        })()
      `);

      if (opacity !== null && opacity !== undefined && !isNaN(opacity)) {
        console.log(`[TRANSPARENCY] ✅ Successfully got opacity: ${opacity}`);
        return opacity;
      } else {
        console.log(`[TRANSPARENCY] ⚠️ Invalid opacity value: ${opacity}`);
      }
    } catch (err) {
      console.error(`[TRANSPARENCY] ❌ Attempt ${attempt} error:`, err);
    }

    // Wait before next attempt (except on last attempt)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log('[TRANSPARENCY] ⛔ All attempts failed, using default: 0.15');
  return 0.15; // Default fallback
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

  // Create WebContentsView with transparent background
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      transparent: true  // Enable transparency for WebContentsView
    }
  });

  console.log('[WEBVIEW] WebContentsView created with transparent background');

  // Set transparent background color
  webContentsView.setBackgroundColor('#00000000');
  console.log('[WEBVIEW] Background color set to #00000000 (fully transparent)');

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
  webContentsView.webContents.loadURL('http://localhost:3000');
  //webContentsView.webContents.loadURL('https://sigrid.ttt-timer.com');

  // MINIMAL CSS injection - only hide scrollbars and make base containers transparent
  // DO NOT override the React app's rgba backgrounds!
  webContentsView.webContents.on('did-finish-load', () => {
    console.log('[WEBVIEW] Page loaded, injecting minimal CSS');
    
    webContentsView.webContents.insertCSS(`
      /* ===== HIDE SCROLLBARS (but keep scrolling functional) ===== */
      
      ::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        background: transparent;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: transparent;
      }
      
      * {
        scrollbar-width: none;
      }
      
      * {
        -ms-overflow-style: none;
      }
      
      html, body {
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      /* ===== TRANSPARENT BASE CONTAINERS ONLY ===== */
      
      html {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      body {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      #root {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      html::before,
      html::after,
      body::before,
      body::after,
      #root::before,
      #root::after {
        background: transparent !important;
        background-color: transparent !important;
      }
    `).then(() => {
      console.log('[WEBVIEW] Minimal CSS injected successfully');
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

  // Re-inject CSS on navigation
  webContentsView.webContents.on('did-navigate', () => {
    console.log('[WEBVIEW] Navigation detected, re-injecting CSS');
    webContentsView.webContents.insertCSS(`
      ::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        background: transparent;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: transparent;
      }
      
      * {
        scrollbar-width: none;
      }
      
      * {
        -ms-overflow-style: none;
      }
      
      html, body {
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      html {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      body {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      #root {
        background: transparent !important;
        background-color: transparent !important;
      }
      
      html::before,
      html::after,
      body::before,
      body::after,
      #root::before,
      #root::after {
        background: transparent !important;
        background-color: transparent !important;
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
  return 'http://localhost:3000';
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

// Helper function to notify main window of transparency changes
function notifyTransparencyChange(opacity) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('transparency-changed', opacity);
    console.log(`[TRANSPARENCY] 📤 Notified main window of opacity change: ${opacity}`);
  }
}

// Get initial transparency with retry logic
ipcMain.handle('get-initial-transparency', async (event) => {
  console.log('[TRANSPARENCY] 📞 Received request for initial transparency');
  const opacity = await getOpacityFromReactApp();
  console.log(`[TRANSPARENCY] 📤 Returning opacity: ${opacity}`);
  return opacity;
});

// Transparency management - communicate with WebContentsView's TTTTimerAPI
ipcMain.handle('get-current-transparency', async (event) => {
  const opacity = await getOpacityFromReactApp();
  return (opacity * 100).toString(); // Convert 0-1 to percentage string
});

ipcMain.on('set-transparency', (event, transparencyPercent) => {
  if (webContentsView && webContentsView.webContents) {
    const opacity = parseFloat(transparencyPercent) / 100; // Convert percentage to 0-1
    console.log(`[TRANSPARENCY] 📝 Setting opacity to ${opacity} (${transparencyPercent}%)`);
    
    webContentsView.webContents.executeJavaScript(`
      (function() {
        if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
          return window.TTTTimerAPI.setOpacity(${opacity});
        }
        return false;
      })()
    `).then(success => {
      if (success) {
        console.log(`[TRANSPARENCY] ✅ Successfully set opacity to ${opacity}`);
        // Notify main window (index.html) to update hover strip
        notifyTransparencyChange(opacity);
      } else {
        console.error('[TRANSPARENCY] ❌ Failed to set opacity - API not available');
      }
    }).catch(err => {
      console.error('[TRANSPARENCY] ❌ Error setting opacity:', err);
    });
  }
});

ipcMain.on('save-transparency', (event, transparencyPercent) => {
  console.log('[SETTINGS] 💾 Transparency value saved:', transparencyPercent + '%');
  const opacity = parseFloat(transparencyPercent) / 100;
  
  if (webContentsView && webContentsView.webContents) {
    webContentsView.webContents.executeJavaScript(`
      (function() {
        if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
          return window.TTTTimerAPI.setOpacity(${opacity});
        }
        return false;
      })()
    `).then(success => {
      if (success) {
        console.log(`[TRANSPARENCY] ✅ Successfully saved opacity to ${opacity}`);
        // Notify main window (index.html) to update hover strip
        notifyTransparencyChange(opacity);
      }
    }).catch(err => {
      console.error('[TRANSPARENCY] ❌ Error saving opacity:', err);
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