import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      spellcheck: true,
      preload: preloadPath
    },
    icon: path.join(__dirname, '../public/dottoressa.png'),
    show: false
  });

  // Correttore ortografico: italiano e inglese (da impostare subito)
  mainWindow.webContents.session.setSpellCheckerLanguages(['it', 'en']);

  // Menu contestuale: suggerimenti ortografici + Taglia/Copia/Incolla
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuTemplate = [];
    const suggestions = params.dictionarySuggestions || [];
    const misspelledWord = params.misspelledWord || '';

    // Suggerimenti correzione ortografica (es. "Sostituisci con 'ciao'")
    if (suggestions.length > 0) {
      suggestions.forEach((word) => {
        menuTemplate.push({
          label: `Sostituisci con "${word}"`,
          click: () => mainWindow.webContents.replaceMisspelling(word)
        });
      });
    }
    if (misspelledWord) {
      menuTemplate.push({
        label: 'Aggiungi al dizionario',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(misspelledWord)
      });
    }
    if (menuTemplate.length > 0) {
      menuTemplate.push({ type: 'separator' });
    }

    if (params.isEditable) {
      menuTemplate.push(
        { label: 'Annulla', role: 'undo' },
        { label: 'Ripristina', role: 'redo' },
        { type: 'separator' },
        { label: 'Taglia', role: 'cut' },
        { label: 'Copia', role: 'copy' },
        { label: 'Incolla', role: 'paste' },
        { type: 'separator' },
        { label: 'Seleziona tutto', role: 'selectAll' }
      );
    } else if (params.selectionText) {
      menuTemplate.push(
        { label: 'Copia', role: 'copy' },
        { type: 'separator' },
        { label: 'Seleziona tutto', role: 'selectAll' }
      );
    }

    if (menuTemplate.length > 0) {
      const contextMenu = Menu.buildFromTemplate(menuTemplate);
      contextMenu.popup(mainWindow);
    }
  });

  // Carica l'app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath, { hash: '/' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    app.quit();
  });

  // Previeni navigazione a file locali - forza uso di React Router
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.protocol === 'file:') {
      event.preventDefault();
      console.log('Blocked file navigation to:', navigationUrl);
    }
  });

  // Previeni apertura di nuove finestre
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('Blocked window open to:', url);
    return { action: 'deny' };
  });
}

// Apri PDF in app predefinita (es. Chrome) per stampa
ipcMain.handle('open-pdf-for-print', async (_event, pdfBase64) => {
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return;
  const tempDir = app.getPath('temp');
  const tempPath = path.join(tempDir, `AppDottori_stampa_${Date.now()}.pdf`);
  const buffer = Buffer.from(pdfBase64, 'base64');
  fs.writeFileSync(tempPath, buffer);
  try {
    const err = await shell.openPath(tempPath);
    if (err) console.error('Errore apertura PDF:', err);
  } catch (e) {
    console.error('Errore apertura PDF:', e);
  }
  setTimeout(() => {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }, 60000);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
