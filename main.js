const { app, BrowserWindow, ipcMain, screen, WebContentsView } = require('electron');
const path = require('path');

let mainWindow;
let webContentsView;

// Layout constants
const TITLEBAR_HEIGHT = 32;
const HOVER_STRIP_HEIGHT = 50;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: false
    },
    backgroundColor: '#00000000',
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

  // Load the default URL
  webContentsView.webContents.loadURL('https://sigrid.ttt-timer.com');

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
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window shown, bounds:', mainWindow.getBounds());
  });

  // ENABLE DevTools to see renderer errors (comment out for production)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Log any renderer errors to main process console
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Only log warnings and errors
      console.log(`[RENDERER CONSOLE] ${message}`);
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
    webContentsView = null;
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
  console.log('[RENDERER]', message);
});

// IPC handlers for mouse position tracking
let ipcCallCounter = 0;
ipcMain.handle('get-mouse-position', () => {
  try {
    const point = screen.getCursorScreenPoint();
    ipcCallCounter++;
    // Log every 20 calls to show activity without spam
    if (ipcCallCounter % 20 === 0) {
      console.log(`[IPC] Mouse polling active (${ipcCallCounter} calls)`);
    }
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
  console.log('IPC: load-url received:', url);
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