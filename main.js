const { app, BrowserWindow, ipcMain, screen, WebContentsView } = require('electron');
const path = require('path');

let mainWindow;
let webContentsView;


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
    show: false // Don't show until ready
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

  // Position the view below the titlebar (32px)
  const bounds = mainWindow.getBounds();
  webContentsView.setBounds({
    x: 0,
    y: 32,
    width: bounds.width,
    height: bounds.height - 32
  });

  // Load the default URL
  webContentsView.webContents.loadURL('https://sigrid.ttt-timer.com');

  // Update view size when window is resized
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    webContentsView.setBounds({
      x: 0,
      y: 32,
      width: bounds.width,
      height: bounds.height - 32
    });
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development (comment out for production)
  // mainWindow.webContents.openDevTools();
  // webContentsView.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
    webContentsView = null;
  });

  // Handle window maximize state
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
    // Update view bounds
    const bounds = mainWindow.getBounds();
    webContentsView.setBounds({
      x: 0,
      y: 32,
      width: bounds.width,
      height: bounds.height - 32
    });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
    // Update view bounds
    const bounds = mainWindow.getBounds();
    webContentsView.setBounds({
      x: 0,
      y: 32,
      width: bounds.width,
      height: bounds.height - 32
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

// IPC handlers for mouse position tracking
ipcMain.handle('get-mouse-position', () => {
  const point = screen.getCursorScreenPoint();
  return { x: point.x, y: point.y };
});

ipcMain.handle('get-window-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return null;
});

// IPC handler for loading URL in WebContentsView
ipcMain.on('load-url', (event, url) => {
  if (webContentsView && webContentsView.webContents) {
    webContentsView.webContents.loadURL(url);
  }
});

// IPC handler to get current URL
ipcMain.handle('get-current-url', () => {
  if (webContentsView && webContentsView.webContents) {
    return webContentsView.webContents.getURL();
  }
  return 'https://sigrid.ttt-timer.com';
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS applications stay active until user quits with Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

// Security recommendations
app.on('web-contents-created', (event, contents) => {
  // Disable navigation to external sites
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow file protocol for app files
    if (parsedUrl.protocol === 'file:') {
      return;
    }
    
    // Prevent navigation in main window (webview handles external URLs)
    event.preventDefault();
  });

  // Prevent new window creation
  contents.setWindowOpenHandler(({ url }) => {
    // Open links in default browser instead of new window
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});