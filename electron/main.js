import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let kvReady = null;

async function getKv() {
  if (kvReady) return kvReady;
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  const dbPath = path.join(app.getPath('userData'), 'corioli.db');
  let db;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
  }
  db.run('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT);');
  function persist() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
  kvReady = { db, persist };
  return kvReady;
}

async function kvGet(key) {
  const { db } = await getKv();
  const stmt = db.prepare('SELECT value FROM kv_store WHERE key = ?');
  stmt.bind([key]);
  let value = null;
  if (stmt.step()) value = stmt.get()[0];
  stmt.free();
  return value;
}

async function kvSet(key, value) {
  const { db, persist } = await getKv();
  db.run(
    'INSERT INTO kv_store (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value ?? '')]
  );
  persist();
}

async function kvRemove(key) {
  const { db, persist } = await getKv();
  db.run('DELETE FROM kv_store WHERE key = ?', [key]);
  persist();
}

async function kvClearAppDottori() {
  const { db, persist } = await getKv();
  db.run("DELETE FROM kv_store WHERE key LIKE 'AppDottori_%'");
  persist();
}

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

// Key-value storage API for renderer (backed by SQLite .db file)
ipcMain.handle('kv:get', async (_event, key) => {
  if (typeof key !== 'string') return null;
  try {
    return await kvGet(key);
  } catch (e) {
    console.error('Errore kv:get', e);
    return null;
  }
});

ipcMain.handle('kv:set', async (_event, key, value) => {
  if (typeof key !== 'string') return;
  try {
    await kvSet(key, String(value ?? ''));
  } catch (e) {
    console.error('Errore kv:set', e);
  }
});

ipcMain.handle('kv:remove', async (_event, key) => {
  if (typeof key !== 'string') return;
  try {
    await kvRemove(key);
  } catch (e) {
    console.error('Errore kv:remove', e);
  }
});

ipcMain.handle('kv:clearAppDottori', async () => {
  try {
    await kvClearAppDottori();
  } catch (e) {
    console.error('Errore kv:clearAppDottori', e);
  }
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
