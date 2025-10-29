const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // Titlebar visibility
  notifyTitlebarVisibility: (isVisible) => ipcRenderer.send('titlebar-visibility-changed', isVisible),
  onTitlebarToggle: (callback) => ipcRenderer.on('titlebar-toggle', callback),
  
  // Custom window resizing
  resizeWindow: (direction, deltaX, deltaY) => 
    ipcRenderer.send('window-resize', { direction, deltaX, deltaY }),
  
  // Mousewheel scrolling
  scrollWindow: (deltaY) => ipcRenderer.send('window-scroll', deltaY),
  
  // Logging
  logToMain: (message) => ipcRenderer.send('renderer-log', message),
  
  // Mouse position and window bounds
  getMousePosition: () => ipcRenderer.invoke('get-mouse-position'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  
  // URL management
  loadURL: (url) => ipcRenderer.send('load-url', url),
  getCurrentURL: () => ipcRenderer.invoke('get-current-url'),
  
  // Settings
  openSettings: () => ipcRenderer.send('open-settings'),
  
  // Team management
  onTeamUpdated: (callback) => ipcRenderer.on('team-updated', (event, team) => callback(team)),
  
  // Transparency management - receives PERCENTAGE (5-100)
  onTransparencyChanged: (callback) => ipcRenderer.on('transparency-changed', (event, opacityPercent) => callback(opacityPercent))
});