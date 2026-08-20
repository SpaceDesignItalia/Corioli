import fs from "fs";
import path from "path";

/**
 * File PDF generati per la stampa.
 *
 * Non stanno più in `%TEMP%`: sono referti, ricette e certificati con dati
 * sanitari, e la cartella temporanea di sistema è condivisa e raramente svuotata.
 * Vivono in una sottocartella dell'app, ripulita all'avvio e alla chiusura.
 *
 * Non vengono più cancellati a tempo: il vecchio `setTimeout` a 60 secondi
 * faceva sparire il file mentre il medico stava ancora scegliendo la stampante.
 */

const PRINT_FILE_PREFIX = "Corioli_stampa_";

/** Nome file per la stampa corrente. Il timestamp evita collisioni tra stampe ravvicinate. */
export function printFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `_${String(now.getMilliseconds()).padStart(3, "0")}`;
  return `${PRINT_FILE_PREFIX}${stamp}.pdf`;
}

/** True se il file appartiene a questa funzione (mai cancellare altro). */
export function isPrintFileName(name) {
  return (
    typeof name === "string" &&
    name.startsWith(PRINT_FILE_PREFIX) &&
    name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Scrive il PDF nella cartella di stampa e ne restituisce il percorso.
 * Lancia se il base64 non è valido: il chiamante deve gestirlo.
 */
export function writePrintFile(printDir, pdfBase64, now = new Date()) {
  if (typeof pdfBase64 !== "string" || pdfBase64.length === 0) {
    throw new Error("PDF non valido.");
  }
  fs.mkdirSync(printDir, { recursive: true });
  const filePath = path.join(printDir, printFileName(now));
  fs.writeFileSync(filePath, Buffer.from(pdfBase64, "base64"));
  return filePath;
}

/**
 * Cancella i PDF di stampa rimasti (crash, chiusura forzata, stampa annullata).
 * Restituisce i nomi rimossi. Non tocca file estranei alla cartella.
 */
export function cleanupPrintDir(printDir) {
  if (!fs.existsSync(printDir)) return [];
  const removed = [];
  for (const name of fs.readdirSync(printDir)) {
    if (!isPrintFileName(name)) continue;
    try {
      fs.unlinkSync(path.join(printDir, name));
      removed.push(name);
    } catch (e) {
      // file ancora aperto dal visualizzatore PDF: verrà rimosso al prossimo avvio
      console.error("Pulizia stampe:", e?.message || e);
    }
  }
  return removed;
}
