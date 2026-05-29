# Microsoft Store (Windows)

Corioli su Windows è distribuito solo come pacchetto **AppX/MSIX** sul Microsoft Store.

- Il pacchetto è firmato da **Microsoft** in fase di certificazione.
- Non serve un certificato code signing EV/OV separato per gli utenti Store.
- Non è più presente `electron-updater` né installer NSIS/MSI nel progetto.

Build: `npm run dist:appx` → upload su Partner Center.
