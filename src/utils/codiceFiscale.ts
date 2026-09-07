import { decodeFiscalCode } from "codice-fiscale-ts";

export const CF_LENGTH = 16;

/** Lettere che sostituiscono le cifre 0-9 nei codici omocodi. */
const OMOCODIA_LETTERS = "LMNPQRSTUV";
/** Lettere ammesse per il mese di nascita (gennaio → dicembre). */
const MONTH_LETTERS = "ABCDEHLMPRST";

const CF_REGEX = new RegExp(
  `^[A-Z]{6}[0-9${OMOCODIA_LETTERS}]{2}[${MONTH_LETTERS}][0-9${OMOCODIA_LETTERS}]{2}[A-Z][0-9${OMOCODIA_LETTERS}]{3}[A-Z]$`,
);

/** Valori dei caratteri in posizione dispari (1ª, 3ª, …) per il carattere di controllo. */
const ODD_VALUES: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

export function normalizeCodiceFiscale(cf: string): string {
  return cf.replace(/\s/g, "").toUpperCase();
}

/** Solo struttura (lunghezza e tipo dei caratteri), senza carattere di controllo. */
export function isValidCodiceFiscaleFormat(cf: string): boolean {
  return CF_REGEX.test(normalizeCodiceFiscale(cf));
}

/** Valore del carattere in posizione pari (2ª, 4ª, …): cifra o indice della lettera. */
function evenValue(ch: string): number {
  return ch >= "0" && ch <= "9" ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 65;
}

/** Carattere di controllo (CIN) calcolato sui primi 15 caratteri. */
export function codiceFiscaleControlChar(first15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = first15[i];
    // L'indice 0 corrisponde alla 1ª posizione, quindi dispari.
    sum += i % 2 === 0 ? ODD_VALUES[ch] : evenValue(ch);
  }
  return String.fromCharCode(65 + (sum % 26));
}

/** Riporta a cifre le posizioni numeriche sostituite da lettere nei codici omocodi. */
function undoOmocodia(part: string): string {
  return part.replace(/[LMNPQRSTUV]/g, (ch) =>
    String(OMOCODIA_LETTERS.indexOf(ch)),
  );
}

/** Giorno di nascita plausibile (1-31, +40 per le donne). */
function hasPlausibleBirthDay(cf: string): boolean {
  const raw = Number.parseInt(undoOmocodia(cf.slice(9, 11)), 10);
  if (!Number.isFinite(raw)) return false;
  const day = raw > 40 ? raw - 40 : raw;
  return day >= 1 && day <= 31;
}

/**
 * Messaggio d'errore per il codice fiscale digitato, `null` se è corretto.
 * Un valore vuoto non è un errore: il campo è opzionale.
 */
export function codiceFiscaleError(cf: string): string | null {
  const value = normalizeCodiceFiscale(cf);
  if (!value) return null;
  if (/[^A-Z0-9]/.test(value)) {
    return "Il codice fiscale può contenere solo lettere e numeri";
  }
  if (value.length !== CF_LENGTH) {
    return `Il codice fiscale deve avere 16 caratteri (inseriti: ${value.length})`;
  }
  if (!CF_REGEX.test(value)) {
    return "Formato del codice fiscale non valido (esempio: RSSMRA80A01H501U)";
  }
  if (!hasPlausibleBirthDay(value)) {
    return "Codice fiscale non valido: il giorno di nascita non esiste";
  }
  if (codiceFiscaleControlChar(value.slice(0, 15)) !== value[15]) {
    return "Codice fiscale non valido: l'ultimo carattere (di controllo) non corrisponde agli altri 15";
  }
  return null;
}

/** Struttura + carattere di controllo: il CF è certamente ben formato. */
export function isValidCodiceFiscale(cf: string): boolean {
  const value = normalizeCodiceFiscale(cf);
  return value.length === CF_LENGTH && codiceFiscaleError(value) === null;
}

/** Data locale (YYYY-MM-DD) dall'oggetto Date del decoder, senza shift UTC. */
function birthDateToIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DecodedCfFields = {
  dataNascita: string;
  luogoNascita: string;
  sesso: "M" | "F";
};

function inferGenderFromCf(cf: string): "M" | "F" {
  const dayCode = Number.parseInt(undoOmocodia(cf.slice(9, 11)), 10);
  if (Number.isFinite(dayCode) && dayCode > 40) return "F";
  return "M";
}

export async function decodeCfToPatientFields(
  cf: string,
): Promise<DecodedCfFields> {
  const normalized = normalizeCodiceFiscale(cf);
  const data = await decodeFiscalCode(normalized);
  if (!data.birthDate) {
    throw new Error("Impossibile ricavare la data di nascita dal codice fiscale");
  }
  const luogo = (data.birthPlace || "").trim();
  const sesso: "M" | "F" =
    data.gender === "M" || data.gender === "F"
      ? data.gender
      : inferGenderFromCf(normalized);
  return {
    dataNascita: birthDateToIsoLocal(data.birthDate),
    luogoNascita: luogo || "Non specificato",
    sesso,
  };
}
