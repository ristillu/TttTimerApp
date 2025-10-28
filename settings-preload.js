const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the settings window
contextBridge.exposeInMainWorld('electronAPI', {
  // Get current team from main window
  getCurrentTeam: () => ipcRenderer.invoke('get-current-team'),
  
  // Save team selection
  saveTeam: (team) => ipcRenderer.send('save-team', team),
  
  // Get current zoom level
  getCurrentZoom: () => ipcRenderer.invoke('get-current-zoom'),
  
  // Set zoom level (for immediate preview)
  setZoomLevel: (zoomPercent) => ipcRenderer.send('set-zoom-level', zoomPercent),
  
  // Save zoom level
  saveZoom: (zoomPercent) => ipcRenderer.send('save-zoom', zoomPercent),
  
  // Get current transparency
  getCurrentTransparency: () => ipcRenderer.invoke('get-current-transparency'),
  
  // Set transparency (for immediate preview)
  setTransparency: (transparencyPercent) => ipcRenderer.send('set-transparency', transparencyPercent),
  
  // Save transparency
  saveTransparency: (transparencyPercent) => ipcRenderer.send('save-transparency', transparencyPercent),
  
  // Close settings window
  closeSettingsWindow: () => ipcRenderer.send('close-settings-window')
});