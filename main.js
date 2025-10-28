const { app, BrowserWindow } = require('electron');
const path = require('path');

// Enable @electron/remote for window controls
// Note: You need to install @electron/remote first:
// npm install @electron/remote
let remoteMain;
try {
  remoteMain = require('@electron/remote/main');
  remoteMain.initialize();
} catch (err) {
  console.log('@electron/remote not installed - window controls may not work');
  console.log('Run: npm install @electron/remote');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      nodeIntegrationInSubFrames: false
    },
    backgroundColor: '#00000000',
    show: false // Don't show until ready
  });

  // Enable remote for this window if available
  if (remoteMain) {
    remoteMain.enable(mainWindow.webContents);
  }

  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development (comment out for production)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Handle window maximize state
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });
}

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
