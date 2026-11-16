import { storageService } from "../services/StorageServiceFallback";
import type { AppData } from "../types/Storage";

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ISTANTE = /^\d{4}-\d{2}-\d{2}T/;
const GIORNO = 86_400_000;

/** Le immagini ecografiche del seed, salvate una volta sola e richiamate per chiave. */
let immagini: Record<string, string> = {};

/**
 * Sposta tutte le date del seed in avanti, in modo che l'ultima giornata di
 * lavoro dell'archivio sia "oggi": gravidanze in corso, visite recenti e
 * scadenze sono sempre credibili, qualunque sia il giorno in cui si apre la demo.
 */
function spostaDate<T>(valore: T, giorni: number, chiave?: string): T {
  if (Array.isArray(valore)) return valore.map((x) => spostaDate(x, giorni, chiave)) as T;
  if (valore && typeof valore === "object") {
    return Object.fromEntries(
      Object.entries(valore).map(([k, v]) => [k, spostaDate(v, giorni, k)]),
    ) as T;
  }
  if (typeof valore === "string" && chiave !== "dataNascita") {
    if (SOLO_DATA.test(valore)) {
      const d = new Date(`${valore}T12:00:00Z`);
      return new Date(d.getTime() + giorni * GIORNO).toISOString().slice(0, 10) as T;
    }
    if (valore.startsWith("demo-img:")) return (immagini[valore] ?? valore) as T;
    if (ISTANTE.test(valore)) {
      return new Date(new Date(valore).getTime() + giorni * GIORNO).toISOString() as T;
    }
  }
  return valore;
}

/** Carica i pazienti di prova nella memoria volatile. */
export async function prepareDemo(): Promise<void> {
  try {
    const grezzo = (await import("./seed.json")).default as unknown as AppData & {
      refDate: string;
      immagini?: Record<string, string>;
    };
    const oggi = new Date();
    const oggiLocale = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const rif = Date.parse(`${grezzo.refDate}T00:00:00Z`);
    const giorni = Math.round((oggiLocale - rif) / GIORNO);
    const { refDate: _rif, immagini: elenco, ...dati } = grezzo;
    void _rif;
    immagini = elenco ?? {};
    await storageService.importData(spostaDate(dati, giorni) as AppData, "replace");
  } catch (error) {
    console.error("Dati di prova non caricati:", error);
  }
}
