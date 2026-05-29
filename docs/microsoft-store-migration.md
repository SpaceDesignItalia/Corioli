# Distribuzione e aggiornamenti Corioli

## Canale ufficiale Windows: Microsoft Store

- **Build:** `npm run build` → `npm run dist:appx`
- **Pubblicazione:** caricare il `.appx` su Microsoft Partner Center
- **Aggiornamenti utente:** solo tramite Store (automatici o da “Download e aggiornamenti”)

L’app **non** usa più `electron-updater` né release GitHub per Windows.

## macOS

- Build: `electron-builder --mac` (dmg/zip), artifact manuali o workflow CI senza auto-update in-app.

## Utenti con vecchio installer (GitHub / setup)

Non ricevono più aggiornamenti automatici dall’app. Devono:

1. Backup JSON da Impostazioni
2. Installare Corioli dal Microsoft Store
3. Ripristinare il backup se necessario
4. Disinstallare la vecchia versione

## Riferimenti codice

- Versione app: `electron/preload.js` → `getAppVersion`
- UI versione + testo Store: `Settings.tsx`
- Target Windows in `package.json`: solo `appx`
