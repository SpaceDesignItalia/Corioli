# Installazione su Mac (Apple)

L'app **Corioli** (AppDottori) può essere installata su un computer Mac come applicazione desktop.

## Requisiti

- **macOS** 10.13 (High Sierra) o superiore
- **Node.js** 18 o superiore ([scarica da nodejs.org](https://nodejs.org))

## Opzione A: Installare da un file .dmg già preparato

Se qualcuno ti ha già fornito un file **Corioli-x.x.x.dmg**:

1. Apri il file `.dmg`.
2. Trascina l’icona **Corioli** nella cartella **Applicazioni**.
3. Apri **Applicazioni** e avvia **Corioli**.

La prima volta macOS potrebbe chiedere di confermare che l’app proviene da uno sviluppatore non verificato: vai in **Preferenze di Sistema → Sicurezza e privacy** e clicca su **Apri comunque** per Corioli.

---

## Opzione B: Creare l’installer su un Mac (da sorgente)

Per generare il file `.dmg` (o l’app `.app`) **devi usare un Mac**: la build per macOS va fatta su macOS.

### 1. Clona o copia il progetto sul Mac

Assicurati di avere tutti i file del progetto (ad es. via Git o copia della cartella).

### 2. Installa Node.js

Se non l’hai già fatto, installa Node.js da [nodejs.org](https://nodejs.org) (versione LTS).

### 3. Apri il terminale e vai nella cartella del progetto

```bash
cd /percorso/dove/hai/AppDottori-FE
```

### 4. Installa le dipendenze

```bash
npm install
```

### 5. Crea l’applicazione per Mac

```bash
npm run dist
```

Questo comando:

- compila il frontend (Vite);
- crea il pacchetto per macOS con **electron-builder**.

Alla fine troverai in **`dist-electron/`**:

- **Corioli-x.x.x.dmg** — installer da aprire e trascinare in Applicazioni;
- oppure la cartella **Corioli.app** — app pronta da copiare in Applicazioni.

### 6. Installare l’app

- Se hai il **.dmg**: aprilo e trascina **Corioli** in **Applicazioni**.
- Se hai **Corioli.app**: trascinala nella cartella **Applicazioni**.

Poi apri **Corioli** da **Applicazioni** (o da Spotlight).

---

## Se non hai un Mac

Per ottenere un file `.dmg` senza avere un Mac puoi:

- usare un **Mac in cloud** (es. MacStadium, AWS EC2 Mac, ecc.) e lanciare `npm run dist` da lì;
- oppure usare **GitHub Actions** (o altro CI) con un runner macOS per fare la build in automatico e scaricare l’artefatto `.dmg`.

Se vuoi, posso proporti un esempio di workflow GitHub Actions per buildare automaticamente la versione Mac.
