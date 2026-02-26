const { contextBridge, ipcRenderer } = require('electron');

// Espone API sicure al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Funzioni per export/import dati
  exportData: () => ipcRenderer.send('export-data'),
  importData: () => ipcRenderer.send('import-data'),

  // Apri PDF in app predefinita per stampa (salva in temp e apre con Chrome/altro)
  openPdfForPrint: (pdfBase64) => ipcRenderer.invoke('open-pdf-for-print', pdfBase64),

  // Storage key-value (SQLite .db)
  kvGet: (key) => ipcRenderer.invoke('kv:get', key),
  kvSet: (key, value) => ipcRenderer.invoke('kv:set', key, value),
  kvRemove: (key) => ipcRenderer.invoke('kv:remove', key),
  kvClearAppDottori: () => ipcRenderer.invoke('kv:clearAppDottori'),

  // Listener per eventi
  onExportData: (callback) => ipcRenderer.on('export-data', callback),
  onImportData: (callback) => ipcRenderer.on('import-data', callback),

  // Rimuovi listener
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Auto-update (GitHub Releases)
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterQuitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
  onUpdaterChecking: (callback) => ipcRenderer.on('updater:checking', callback),
  onUpdaterAvailable: (callback) => ipcRenderer.on('updater:available', (_e, info) => callback(info)),
  onUpdaterNotAvailable: (callback) => ipcRenderer.on('updater:not-available', (_e, info) => callback(info)),
  onUpdaterProgress: (callback) => ipcRenderer.on('updater:progress', (_e, progress) => callback(progress)),
  onUpdaterDownloaded: (callback) => ipcRenderer.on('updater:downloaded', (_e, info) => callback(info)),
  onUpdaterError: (callback) => ipcRenderer.on('updater:error', (_e, message) => callback(message)),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
});