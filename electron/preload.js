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
});