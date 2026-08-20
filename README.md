# Corioli

Applicazione desktop per la gestione di pazienti e visite di uno studio di
ginecologia e ostetricia. I dati clinici restano **in locale** sul computer del
medico: non esiste un archivio pazienti sul server.

- **Interfaccia:** React 18 + TypeScript, NextUI, Tailwind
- **Contenitore:** Electron (Windows via Microsoft Store, macOS, Linux)
- **Archivio:** SQLite locale (`sql.js`) usato come store chiave-valore
- **Referti:** PDF generati con jsPDF (referto ginecologico/ostetrico, ricetta,
  certificato, richiesta di esame)

## Requisiti

Node.js 18+ e npm.

## Comandi

```bash
npm install          # dipendenze
npm run electron:dev # app in sviluppo (Vite + Electron)
npm run dev          # solo interfaccia nel browser, su http://localhost:5173
npm test             # test (vitest)
npm run typecheck    # controllo dei tipi
npm run lint         # eslint
npm run build        # typecheck + build dell'interfaccia
npm run dist         # pacchetto desktop (electron-builder)
```

`npm run build` esegue `tsc --noEmit` prima di Vite: un errore di tipi ferma la build.

## Struttura

```
electron/          processo principale: finestra, archivio SQLite, backup, stampa
  backupFiles.js     scrittura atomica del DB, copie di sicurezza, ripristino
  printFiles.js      PDF di stampa in userData/stampe (mai in %TEMP%)
  appLock.js         PIN, codice di recupero, Windows Hello / Touch ID
src/
  Pages/Dashboard/   home, pazienti, visite, gravidanze, documenti, impostazioni
  components/        componenti condivisi (AppModal, backup, modelli referto)
  services/          accesso ai dati, PDF, import CSV, backup, chat assistenza
  utils/             calcoli clinici (Hadlock, centili, flussimetria) e formati
```

## Dati e backup

Tutto sta in `%APPDATA%/Corioli` (Windows) o `~/Library/Application Support/Corioli` (macOS):

| Percorso | Contenuto |
|----------|-----------|
| `corioli.db` | archivio pazienti, visite, documenti, modelli |
| `corioli.db.bak` | copia dello stato con cui si è aperta la sessione |
| `backups/` | copie automatiche (giornaliera, pre-import, pre-ripristino, manuale) |
| `stampe/` | PDF aperti per la stampa, ripuliti a ogni avvio e chiusura |

Il database viene scritto in modo atomico (file temporaneo + `rename`): una
scrittura interrotta non può corromperlo. All'avvio, se il file principale è
illeggibile, viene messo da parte e si riparte dalla copia `.bak`.

L'export JSON dalle impostazioni resta il backup da **conservare altrove**: le
copie automatiche stanno sullo stesso disco dell'app.

## Test

I test coprono i calcoli clinici (stima del peso fetale, centili di crescita,
flussimetria), le date locali, la validazione dei backup, la migrazione dei dati
demo e i moduli Electron di backup e stampa.

```bash
npm test
```

## Privacy

I dati sanitari non lasciano il computer. Verso il server vanno solo la
telemetria di licenza (dati del medico e conteggi aggregati) e la chat di
assistenza. Stato di conformità e attività aperte: [Corioli-GDPR-backlog.md](Corioli-GDPR-backlog.md).
