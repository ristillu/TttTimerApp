const { app, BrowserWindow, ipcMain, screen, WebContentsView } = require('electron');
const path = require('path');

let mainWindow;
let settingsWindow = null;
let webContentsView;

// Layout constants
const TITLEBAR_HEIGHT = 32;
const HOVER_STRIP_HEIGHT = 50;
const VERTICAL_STRIP_WIDTH = 16;

// Track titlebar visibility state
let titlebarVisible = false;

// CRITICAL: Define updateWebViewBounds at module scope so IPC handler can access it
function updateWebViewBounds(isTitlebarVisible) {
  if (!mainWindow || !webContentsView) return;
  
  const bounds = mainWindow.getBounds();
  const yOffset = isTitlebarVisible ? TITLEBAR_HEIGHT : 0;
  const availableHeight = bounds.height - yOffset - HOVER_STRIP_HEIGHT;
  const availableWidth = bounds.width - (VERTICAL_STRIP_WIDTH * 2);
  
  webContentsView.setBounds({
    x: VERTICAL_STRIP_WIDTH,
    y: yOffset,
    width: availableWidth,
    height: availableHeight
  });
  
  console.log(`[WEBVIEW] Bounds set - x: ${VERTICAL_STRIP_WIDTH}, y: ${yOffset}, width: ${availableWidth}, height: ${availableHeight}, titlebar: ${isTitlebarVisible}`);
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
        console.log(`[TRANSPARENCY] Successfully got opacity: ${opacity}`);
        return opacity;
      } else {
        console.log(`[TRANSPARENCY] Invalid opacity value: ${opacity}`);
      }
    } catch (err) {
      console.error(`[TRANSPARENCY] Attempt ${attempt} error:`, err);
    }

    // Wait before next attempt (except on last attempt)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log('[TRANSPARENCY] All attempts failed, using default: 0.2');
  return 0.2; // Default fallback
}

function createWindow() {
  // Get saved window bounds from localStorage
  let windowBounds = {
    width: 800,
    height: 1000,
    x: undefined,
    y: undefined
  };

  // Transparent frameless windows for overlay effect
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
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
      contextIsolation: false,  // Disable to allow DevTools access to window.TTTTimerAPI
      transparent: true  // Enable transparency for WebContentsView
    }
  });

  console.log('[WEBVIEW] WebContentsView created with transparent background');

  // Set transparent background color
  webContentsView.setBackgroundColor('#00000000');
  console.log('[WEBVIEW] Background color set to #00000000 (fully transparent)');

  // Add view to window
  mainWindow.contentView.addChildView(webContentsView);

  // Initial position - titlebar hidden, accounting for vertical strips
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
      
      // Apply transparency
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('transparency-level') || '100'
      `).then((transparencyPercent) => {
        console.log(`[TRANSPARENCY] Applying saved transparency: ${transparencyPercent}%`);
        const opacity = parseFloat(transparencyPercent) / 100;
        
        // Wait a bit for React app to initialize
        setTimeout(() => {
          if (webContentsView && webContentsView.webContents) {
            webContentsView.webContents.executeJavaScript(`
              (function() {
                console.log('[INIT] Attempting to apply saved transparency: ${opacity}');
                if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
                  const result = window.TTTTimerAPI.setOpacity(${opacity});
                  console.log('[INIT] Applied transparency:', result);
                  return result;
                } else {
                  console.log('[INIT] TTTTimerAPI not ready yet, will retry');
                  return false;
                }
              })()
            `).then(success => {
              if (success) {
                console.log('[TRANSPARENCY] Successfully applied saved transparency on load');
                notifyTransparencyChange(transparencyPercent);
              } else {
                // Retry if API not ready
                console.log('[TRANSPARENCY] Retrying transparency application...');
                setTimeout(() => {
                  if (webContentsView && webContentsView.webContents) {
                    webContentsView.webContents.executeJavaScript(`
                      (function() {
                        if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
                          return window.TTTTimerAPI.setOpacity(${opacity});
                        }
                        return false;
                      })()
                    `).then(retrySuccess => {
                      if (retrySuccess) {
                        console.log('[TRANSPARENCY] Successfully applied transparency on retry');
                        notifyTransparencyChange(transparencyPercent);
                      }
                    });
                  }
                }, 1000);
              }
            }).catch(err => {
              console.error('[TRANSPARENCY] Error applying saved transparency:', err);
            });
          }
        }, 500); // Wait 500ms for React app to initialize
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
    // Load saved window bounds
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const saved = localStorage.getItem('window-bounds');
          if (saved) {
            const bounds = JSON.parse(saved);
            console.log('[WINDOW] Loaded saved bounds:', bounds);
            return bounds;
          }
        } catch (err) {
          console.error('[WINDOW] Error loading saved bounds:', err);
        }
        return null;
      })()
    `).then((savedBounds) => {
      if (savedBounds && savedBounds.width && savedBounds.height) {
        console.log('[WINDOW] Applying saved bounds:', savedBounds);
        mainWindow.setBounds({
          x: savedBounds.x,
          y: savedBounds.y,
          width: savedBounds.width,
          height: savedBounds.height
        });
        // Update WebContentsView with new bounds
        updateWebViewBounds(titlebarVisible);
      }
      
      mainWindow.show();
      const bounds = mainWindow.getBounds();
      console.log(`[WINDOW] Final size: ${bounds.width} x ${bounds.height}`);
    }).catch(err => {
      console.error('[WINDOW] Error applying saved bounds:', err);
      mainWindow.show();
    });
    
    // Force a repaint after showing to ensure dragging works
    setTimeout(() => {
      const currentBounds = mainWindow.getBounds();
      mainWindow.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width: currentBounds.width,
        height: currentBounds.height
      });
      console.log('[WINDOW] Forced repaint for drag functionality');
    }, 100);
  });

  // DevTools keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 or Ctrl+Shift+I for main window DevTools
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
    // Ctrl+Shift+J for WebContentsView DevTools (React app)
    if (input.control && input.shift && input.key === 'J') {
      if (webContentsView && webContentsView.webContents) {
        webContentsView.webContents.openDevTools({ mode: 'detach' });
      }
      event.preventDefault();
    }
  });

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

// Force repaint handler
ipcMain.on('force-repaint', () => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    console.log('[WINDOW] Forced repaint via IPC');
  }
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
    width: 400,
    height: 500,
    minWidth: 350,
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
    backgroundColor: '#121212',
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

  // Save bounds to localStorage
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      (function() {
        try {
          const bounds = {
            x: ${newBounds.x},
            y: ${newBounds.y},
            width: ${newBounds.width},
            height: ${newBounds.height}
          };
          localStorage.setItem('window-bounds', JSON.stringify(bounds));
          console.log('[WINDOW] Saved bounds:', bounds);
        } catch (err) {
          console.error('[WINDOW] Error saving bounds:', err);
        }
      })()
    `).catch(err => {
      console.error('[WINDOW] Error executing save bounds script:', err);
    });
  }
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

// FIXED: Get actual current URL from WebContentsView
ipcMain.handle('get-current-url', () => {
  if (webContentsView && webContentsView.webContents) {
    const currentUrl = webContentsView.webContents.getURL();
    console.log('[URL] Current URL:', currentUrl);
    return currentUrl;
  }
  console.log('[URL] WebContentsView not available, returning default');
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
      
      // Get current transparency setting before team change
      mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('transparency-level') || '100'
      `).then((savedTransparency) => {
        console.log('[SETTINGS] Current transparency:', savedTransparency + '%');
        
        // Send team-updated event
        mainWindow.webContents.send('team-updated', team);
        
        // Set up one-time listener to apply transparency after new page loads
        const applyTransparency = () => {
          console.log('[SETTINGS] New team page loaded, applying transparency');
          
          // Wait a bit for React app to initialize
          setTimeout(() => {
            if (webContentsView && webContentsView.webContents) {
              const opacity = parseFloat(savedTransparency) / 100;
              webContentsView.webContents.executeJavaScript(`
                (function() {
                  console.log('[TEAM-SWITCH] Attempting to apply saved transparency: ${opacity}');
                  if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
                    const result = window.TTTTimerAPI.setOpacity(${opacity});
                    console.log('[TEAM-SWITCH] Applied transparency:', result);
                    return result;
                  } else {
                    console.log('[TEAM-SWITCH] TTTTimerAPI not ready yet, retrying...');
                    return false;
                  }
                })()
              `).then(success => {
                if (success) {
                  console.log('[SETTINGS] Successfully applied transparency to new team');
                  // Notify main window strips
                  notifyTransparencyChange(savedTransparency);
                } else {
                  // Retry if API not ready
                  console.log('[SETTINGS] Retrying transparency application...');
                  setTimeout(() => {
                    if (webContentsView && webContentsView.webContents) {
                      webContentsView.webContents.executeJavaScript(`
                        (function() {
                          if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
                            return window.TTTTimerAPI.setOpacity(${opacity});
                          }
                          return false;
                        })()
                      `).then(retrySuccess => {
                        if (retrySuccess) {
                          console.log('[SETTINGS] Successfully applied transparency on retry');
                          notifyTransparencyChange(savedTransparency);
                        } else {
                          console.error('[SETTINGS] Failed to apply transparency after retry');
                        }
                      });
                    }
                  }, 1000);
                }
              }).catch(err => {
                console.error('[SETTINGS] Error applying transparency:', err);
              });
            }
          }, 500); // Wait 500ms for React app to initialize
        };
        
        // Listen for page load on WebContentsView
        if (webContentsView && webContentsView.webContents) {
          webContentsView.webContents.once('did-finish-load', applyTransparency);
        }
      });
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

// CRITICAL: Helper function to notify main window of transparency changes
// Send as PERCENTAGE (5-100) not opacity (0-1)
function notifyTransparencyChange(opacityPercent) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('transparency-changed', opacityPercent);
    console.log(`[TRANSPARENCY] Notified main window of ${opacityPercent}% opacity`);
  }
}

// Get initial transparency with retry logic
ipcMain.handle('get-initial-transparency', async (event) => {
  console.log('[TRANSPARENCY] Received request for initial transparency');
  const opacity = await getOpacityFromReactApp();
  console.log(`[TRANSPARENCY] Returning opacity: ${opacity}`);
  return opacity;
});

// Debug helper: Check if TTTTimerAPI is available
ipcMain.handle('check-api-available', async (event) => {
  if (!webContentsView || !webContentsView.webContents) {
    return { available: false, error: 'WebContentsView not ready' };
  }
  
  try {
    const result = await webContentsView.webContents.executeJavaScript(`
      (function() {
        const hasAPI = typeof window.TTTTimerAPI !== 'undefined';
        const hasSetOpacity = hasAPI && typeof window.TTTTimerAPI.setOpacity === 'function';
        const hasGetOpacity = hasAPI && typeof window.TTTTimerAPI.getOpacity === 'function';
        const currentOpacity = hasGetOpacity ? window.TTTTimerAPI.getOpacity() : null;
        
        return {
          available: hasAPI,
          hasSetOpacity: hasSetOpacity,
          hasGetOpacity: hasGetOpacity,
          currentOpacity: currentOpacity,
          windowKeys: Object.keys(window).filter(k => k.includes('TTT')),
          url: window.location.href
        };
      })()
    `);
    
    console.log('[DEBUG] API Check Result:', result);
    return result;
  } catch (err) {
    console.error('[DEBUG] Error checking API:', err);
    return { available: false, error: err.message };
  }
});

// Transparency management - communicate with WebContentsView's TTTTimerAPI
ipcMain.handle('get-current-transparency', async (event) => {
  // First try to get from Electron's localStorage (master source of truth)
  if (mainWindow && mainWindow.webContents) {
    try {
      const savedTransparency = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('transparency-level') || null
      `);
      if (savedTransparency) {
        console.log('[TRANSPARENCY] Retrieved from Electron localStorage:', savedTransparency + '%');
        return savedTransparency;
      }
    } catch (err) {
      console.error('[TRANSPARENCY] Error reading from Electron localStorage:', err);
    }
  }
  
  // Fallback: try to get from React app
  const opacity = await getOpacityFromReactApp();
  return (opacity * 100).toString(); // Convert 0-1 to percentage string
});

ipcMain.on('set-transparency', (event, transparencyPercent) => {
  if (webContentsView && webContentsView.webContents) {
    const opacity = parseFloat(transparencyPercent) / 100; // Convert percentage to 0-1
    console.log(`[TRANSPARENCY] Setting React app opacity to ${opacity} (${transparencyPercent}%)`);
    
    // Save to Electron app's localStorage for persistence
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.executeJavaScript(`
        localStorage.setItem('transparency-level', '${transparencyPercent}');
      `).catch(err => {
        console.error('[TRANSPARENCY] Error saving to Electron localStorage:', err);
      });
    }
    
    webContentsView.webContents.executeJavaScript(`
      (function() {
        if (window.TTTTimerAPI && window.TTTTimerAPI.setOpacity) {
          return window.TTTTimerAPI.setOpacity(${opacity});
        }
        return false;
      })()
    `).then(success => {
      if (success) {
        console.log(`[TRANSPARENCY] Successfully set React app opacity to ${opacity}`);
        // CRITICAL: Notify main window with PERCENTAGE not opacity
        notifyTransparencyChange(transparencyPercent);
      } else {
        console.error('[TRANSPARENCY] Failed to set opacity - API not available');
      }
    }).catch(err => {
      console.error('[TRANSPARENCY] Error setting opacity:', err);
    });
  }
});

ipcMain.on('save-transparency', (event, transparencyPercent) => {
  console.log('[SETTINGS] Transparency value saved:', transparencyPercent + '%');
  const opacity = parseFloat(transparencyPercent) / 100;
  
  // Save to Electron app's localStorage
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`
      localStorage.setItem('transparency-level', '${transparencyPercent}');
      console.log('[SETTINGS] Saved transparency to Electron localStorage: ${transparencyPercent}%');
    `).catch(err => {
      console.error('[SETTINGS] Error saving transparency to localStorage:', err);
    });
  }
  
  // Apply to React app
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
        console.log(`[TRANSPARENCY] Successfully saved opacity to ${opacity}`);
        // CRITICAL: Notify main window with PERCENTAGE not opacity
        notifyTransparencyChange(transparencyPercent);
      }
    }).catch(err => {
      console.error('[TRANSPARENCY] Error saving opacity:', err);
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