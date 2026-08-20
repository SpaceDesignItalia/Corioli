/** Limiti e validazione input condivisi tra i form. */
import { todayIsoDate } from "./dateUtils";

export const MAX_OBSTETRIC_COUNT = 50;
export const MIN_HEIGHT_CM = 50;
export const MAX_HEIGHT_CM = 250;
export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 200;
export const MIN_BIRTH_YEAR = 1900;

/** Data odierna (fuso locale). Ri-esportata da `dateUtils` per i form che la usano. */
export { todayIsoDate };

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function clampObstetricCount(value: number): number {
  return clampInt(value, 0, MAX_OBSTETRIC_COUNT);
}

export function clampHeightCm(value: number): number {
  return clampInt(value, MIN_HEIGHT_CM, MAX_HEIGHT_CM);
}

/** Consente solo cifre mentre si digita l'altezza in cm. */
export function isValidHeightInputDraft(s: string): boolean {
  return s === "" || /^\d*$/.test(s);
}

/** Parsing live: non limita il range (evita salti a 50 cm al primo tasto). */
export function parseHeightFieldLive(s: string): number | "incomplete" {
  const t = s.trim();
  if (t === "") return "incomplete";
  const n = parseInt(t, 10);
  if (!Number.isFinite(n)) return "incomplete";
  return n;
}

/** Valore al blur: vuoto → undefined, altrimenti numero senza clamp. */
export function parseHeightFieldBlur(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function clampWeightKg(value: number): number {
  return Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, Math.round(value * 10) / 10));
}

/** Consente cifre e un separatore decimale mentre si digita. */
export function isValidWeightInputDraft(s: string): boolean {
  return s === "" || /^\d*[.,]?\d*$/.test(s);
}

/** Parsing live: non arrotonda né limita il range (evita salti a 30 kg al primo tasto). */
export function parseWeightFieldLive(s: string): number | "incomplete" {
  const t = s.trim().replace(",", ".");
  if (t === "" || t === ".") return "incomplete";
  if (t.endsWith(".")) return "incomplete";
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return "incomplete";
  return n;
}

/** Valore finale al blur: vuoto → 0, altrimenti clamp nel range consentito. */
export function parseWeightFieldBlur(s: string): number {
  const t = s.trim().replace(",", ".");
  if (t === "" || t === ".") return 0;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return clampWeightKg(n);
}

export function parseOptionalHeight(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < MIN_HEIGHT_CM || n > MAX_HEIGHT_CM) return undefined;
  return n;
}

export function validateBirthDate(iso: string): string | null {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Data di nascita non valida";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Data di nascita non valida";
  if (iso > todayIsoDate()) return "La data di nascita non può essere nel futuro";
  if (d.getFullYear() < MIN_BIRTH_YEAR) {
    return `Anno di nascita troppo remoto (minimo ${MIN_BIRTH_YEAR})`;
  }
  return null;
}

export function validateVisitDate(iso: string): string | null {
  if (!iso) return "Data visita obbligatoria";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Data visita non valida";
  if (iso > todayIsoDate()) return "La data visita non può essere nel futuro";
  return null;
}

export function validateOptionalIsoDate(
  iso: string | undefined,
  label = "Data",
): string | null {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${label} non valida`;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `${label} non valida`;
  return null;
}

export function validatePastOrSameDate(
  iso: string | undefined,
  label = "Data",
): string | null {
  const formatErr = validateOptionalIsoDate(iso, label);
  if (formatErr) return formatErr;
  if (!iso) return null;
  if (iso > todayIsoDate()) return `${label} non può essere nel futuro`;
  return null;
}

export function validateDateNotAfter(
  iso: string | undefined,
  maxIso: string,
  label: string,
): string | null {
  if (!iso) return null;
  if (iso > maxIso) return `${label} non può essere successiva alla data visita`;
  return null;
}

export type GpaAnamnesiFields = {
  gravidanze: number;
  parti: number;
  partiSpontanei?: number;
  partiCesarei?: number;
  aborti: number;
  abortiSpontanei?: number;
  ivg?: number;
};

export function ginecologiaAnamnesiErrors(g: GpaAnamnesiFields): string[] {
  const gravidanze = g.gravidanze ?? 0;
  const parti = g.parti ?? 0;
  const ps = g.partiSpontanei ?? 0;
  const tc = g.partiCesarei ?? 0;
  const aborti = g.aborti ?? 0;
  const as = g.abortiSpontanei ?? 0;
  const ivg = g.ivg ?? 0;
  const errors: string[] = [];

  if (gravidanze > MAX_OBSTETRIC_COUNT) {
    errors.push(`Gravidanze: massimo ${MAX_OBSTETRIC_COUNT}`);
  }
  if (parti > MAX_OBSTETRIC_COUNT) errors.push(`Parti: massimo ${MAX_OBSTETRIC_COUNT}`);
  if (aborti > MAX_OBSTETRIC_COUNT) errors.push(`Aborti: massimo ${MAX_OBSTETRIC_COUNT}`);
  if (parti > gravidanze) errors.push("Parti non può superare Gravidanze");
  if (parti + aborti > gravidanze) errors.push("Parti + Aborti non può superare Gravidanze");
  if (ps + tc > parti && (ps > 0 || tc > 0)) errors.push("PS + TC non può superare Parti");
  if (as + ivg > aborti && (as > 0 || ivg > 0)) {
    errors.push("AS + IVG non può superare Aborti");
  }
  if (gravidanze < 0 || parti < 0 || aborti < 0 || as < 0 || ivg < 0) {
    errors.push("I conteggi ostetrici non possono essere negativi");
  }
  return errors;
}

export function ostetriciaAnamnesiErrors(o: {
  gravidanzePrec: number;
  partiPrec: number;
  partiPrecSpontanei?: number;
  partiPrecCesarei?: number;
  abortiPrec: number;
  abortiPrecSpontanei?: number;
  ivgPrec?: number;
}): string[] {
  return ginecologiaAnamnesiErrors({
    gravidanze: o.gravidanzePrec ?? 0,
    parti: o.partiPrec ?? 0,
    partiSpontanei: o.partiPrecSpontanei,
    partiCesarei: o.partiPrecCesarei,
    aborti: o.abortiPrec ?? 0,
    abortiSpontanei: o.abortiPrecSpontanei,
    ivg: o.ivgPrec,
  }).map((e) => e.replace("Gravidanze", "Gravidanze prec.").replace("Parti", "Parti prec."));
}

export function validateObstetricWeights(
  pesoPre?: number,
  pesoAttuale?: number,
): string | null {
  if (pesoPre != null && pesoPre > 0 && (pesoPre < MIN_WEIGHT_KG || pesoPre > MAX_WEIGHT_KG)) {
    return `Peso pre-gravidanza fuori range (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg)`;
  }
  if (
    pesoAttuale != null &&
    pesoAttuale > 0 &&
    (pesoAttuale < MIN_WEIGHT_KG || pesoAttuale > MAX_WEIGHT_KG)
  ) {
    return `Peso attuale fuori range (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg)`;
  }
  return null;
}

export const OBSTETRIC_COUNT_FIELDS = new Set([
  "gravidanze",
  "parti",
  "aborti",
  "partiSpontanei",
  "partiCesarei",
  "abortiSpontanei",
  "ivg",
  "gravidanzePrec",
  "partiPrec",
  "abortiPrec",
  "partiPrecSpontanei",
  "partiPrecCesarei",
  "abortiPrecSpontanei",
  "ivgPrec",
]);
