const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the Electron API safely through contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Window control functions
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // Custom resize for transparent window
  resizeWindow: (direction, deltaX, deltaY) => {
    ipcRenderer.send('window-resize', { direction, deltaX, deltaY });
  },
  
  // Titlebar visibility notification - CRITICAL for draggable titlebar
  notifyTitlebarVisibility: (isVisible) => {
    ipcRenderer.send('titlebar-visibility-changed', isVisible);
  },
  
  // Mousewheel scrolling
  scrollWindow: (deltaY) => {
    ipcRenderer.send('window-scroll', deltaY);
  },
  
  // Mouse position checking
  getMousePosition: () => ipcRenderer.invoke('get-mouse-position'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  
  // WebContentsView URL control
  loadURL: (url) => ipcRenderer.send('load-url', url),
  getCurrentURL: () => ipcRenderer.invoke('get-current-url'),
  
  // Console logging to main process (for terminal visibility)
  logToMain: (message) => ipcRenderer.send('renderer-log', message),
  
  // Titlebar toggle listener (receives commands from main process)
  onTitlebarToggle: (callback) => {
    // Remove any existing listeners first to avoid duplicates
    ipcRenderer.removeAllListeners('titlebar-toggle');
    // Add the new listener
    ipcRenderer.on('titlebar-toggle', () => {
      callback();
    });
  },
  
  // Settings window control
  openSettings: () => ipcRenderer.send('open-settings'),
  
  // Team update listener (from settings window)
  onTeamUpdated: (callback) => {
    ipcRenderer.on('team-updated', (event, team) => {
      callback(team);
    });
  },
  
  // Original IPC methods
  send: (channel, data) => {
    // Whitelist channels
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['fromMain', 'window-maximized', 'window-unmaximized'];
    if (validChannels.includes(channel)) {
      // Strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});