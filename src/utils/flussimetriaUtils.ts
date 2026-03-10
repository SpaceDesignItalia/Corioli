/**
 * Utility per la flussimetria Doppler arteria ombelicale:
 * - barra grafica percentile ⊢—◆—⊣ (5°–95°)
 * - testi esplicativi in parole semplici
 * - calcolo percentili PI e IR da curve di riferimento per età gestazionale
 */

import { estimateCentileRank } from "./fetalGrowthCentiles";

const SCALE_LEN = 9; // numero di trattini tra ⊢ e ⊣ (◆ occupa una posizione)

// ─── Curve di riferimento UA-PI (Fetal Medicine Foundation, Ciobanu et al. 2019, UOG) ───
// p5, p50, p95 per settimane 20–41
const UA_PI_REF: Record<number, [number, number, number]> = {
  20: [0.955, 1.218, 1.553], 21: [0.939, 1.197, 1.526], 22: [0.922, 1.176, 1.499],
  23: [0.906, 1.155, 1.472], 24: [0.889, 1.134, 1.446], 25: [0.871, 1.113, 1.420],
  26: [0.854, 1.092, 1.395], 27: [0.836, 1.070, 1.371], 28: [0.818, 1.049, 1.346],
  29: [0.800, 1.028, 1.322], 30: [0.782, 1.007, 1.299], 31: [0.763, 0.986, 1.275],
  32: [0.744, 0.965, 1.252], 33: [0.725, 0.944, 1.229], 34: [0.706, 0.923, 1.207],
  35: [0.687, 0.902, 1.184], 36: [0.668, 0.881, 1.162], 37: [0.649, 0.860, 1.140],
  38: [0.630, 0.839, 1.118], 39: [0.610, 0.818, 1.097], 40: [0.591, 0.797, 1.075],
  41: [0.572, 0.776, 1.053],
};

// ─── Curve di riferimento UA-RI (Indice di resistenza) per età gestazionale ───
// Letteratura: RI diminuisce con l’epoca (mediana ~0,70 a 20 sett, ~0,52 a 40 sett).
// p5, p50, p95 – valori indicativi da riferimenti in gravidanza fisiologica.
const UA_RI_REF: Record<number, [number, number, number]> = {
  20: [0.62, 0.72, 0.82], 21: [0.61, 0.71, 0.81], 22: [0.60, 0.70, 0.80],
  23: [0.59, 0.69, 0.79], 24: [0.58, 0.68, 0.78], 25: [0.57, 0.67, 0.77],
  26: [0.56, 0.66, 0.76], 27: [0.55, 0.65, 0.75], 28: [0.54, 0.64, 0.74],
  29: [0.53, 0.63, 0.73], 30: [0.52, 0.62, 0.72], 31: [0.51, 0.61, 0.71],
  32: [0.50, 0.60, 0.70], 33: [0.49, 0.59, 0.69], 34: [0.48, 0.58, 0.68],
  35: [0.47, 0.57, 0.67], 36: [0.46, 0.56, 0.66], 37: [0.45, 0.55, 0.65],
  38: [0.44, 0.54, 0.64], 39: [0.43, 0.53, 0.63], 40: [0.42, 0.52, 0.62],
  41: [0.41, 0.51, 0.61],
};

const GA_MIN = 20;
const GA_MAX = 41;

function interpolateRef(
  gaWeeks: number,
  table: Record<number, [number, number, number]>,
): [number, number, number] | null {
  if (gaWeeks < GA_MIN || gaWeeks > GA_MAX) return null;
  const w0 = Math.floor(gaWeeks);
  const w1 = Math.min(w0 + 1, GA_MAX);
  const t = gaWeeks - w0;
  const r0 = table[w0];
  const r1 = table[w1];
  if (!r0) return null;
  if (!r1 || w0 === w1) return r0;
  return [
    r0[0] + t * (r1[0] - r0[0]),
    r0[1] + t * (r1[1] - r0[1]),
    r0[2] + t * (r1[2] - r0[2]),
  ];
}

/**
 * Calcola il percentile del PI dell’arteria ombelicale per l’età gestazionale.
 * Riferimento: Fetal Medicine Foundation (Ciobanu et al. 2019). GA in settimane (es. 32, 32.5).
 */
export function getUmbilicalPiPercentile(pi: number, gaWeeks: number): number | null {
  if (!Number.isFinite(pi) || !Number.isFinite(gaWeeks)) return null;
  const ref = interpolateRef(gaWeeks, UA_PI_REF);
  if (!ref) return null;
  const [p5, p50, p95] = ref;
  return estimateCentileRank(pi, p5, p50, p95);
}

/**
 * Calcola il percentile dell’IR (indice di resistenza) dell’arteria ombelicale per l’età gestazionale.
 * Curve di riferimento indicative per gravidanza fisiologica (GA 20–41 settimane).
 */
export function getUmbilicalRiPercentile(ri: number, gaWeeks: number): number | null {
  if (!Number.isFinite(ri) || !Number.isFinite(gaWeeks)) return null;
  const ref = interpolateRef(gaWeeks, UA_RI_REF);
  if (!ref) return null;
  const [p5, p50, p95] = ref;
  return estimateCentileRank(ri, p5, p50, p95);
}

/** Restituisce p5, p50, p95 per PI all’età gestazionale (per barra percentile in PDF). */
export function getUmbilicalPiRef(gaWeeks: number): { p5: number; p50: number; p95: number } | null {
  const ref = interpolateRef(gaWeeks, UA_PI_REF);
  if (!ref) return null;
  return { p5: ref[0], p50: ref[1], p95: ref[2] };
}

/** Restituisce p5, p50, p95 per IR all’età gestazionale (per barra percentile in PDF). */
export function getUmbilicalRiRef(gaWeeks: number): { p5: number; p50: number; p95: number } | null {
  const ref = interpolateRef(gaWeeks, UA_RI_REF);
  if (!ref) return null;
  return { p5: ref[0], p50: ref[1], p95: ref[2] };
}

/**
 * Restituisce la stringa ⊢—◆—⊣ con il ◆ posizionato in base al percentile.
 * Scala: 5° percentile = sinistra, 50° = centro, 95° = destra.
 */
export function percentileScaleBar(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) {
    return "⊢—◆—⊣";
  }
  const clamped = Math.max(5, Math.min(95, pct));
  const pos = Math.round(((clamped - 5) / 90) * SCALE_LEN);
  const left = Math.min(pos, SCALE_LEN);
  const right = SCALE_LEN - left;
  return "⊢" + "—".repeat(left) + "◆" + "—".repeat(right) + "⊣";
}

export interface FlussimetriaSpiegazioni {
  piTesto: string;
  irTesto: string;
  edfTesto: string;
  riepilogo: string;
}

/**
 * Testi in parole semplici per PI, IR, EDF e frase di riepilogo.
 */
export function getFlussimetriaSpiegazioni(
  pi: number,
  ir: number,
  edf: "positivo" | "assente" | "invertito",
): FlussimetriaSpiegazioni {
  const edfTesto =
    edf === "positivo"
      ? "EDF positivo: c’è flusso di sangue verso il feto anche in diastole; è il quadro atteso in condizioni normali."
      : edf === "assente"
        ? "EDF assente: in diastole il flusso si azzera. Può indicare aumentata resistenza placentare; va inquadrato clinicamente."
        : "EDF invertito: il flusso in diastole va in direzione opposta. È un segno di elevata resistenza e richiede valutazione clinica.";

  const piTesto =
    "Il PI (indice di pulsatilità) riflette la resistenza al flusso a livello placentare: valori nella norma indicano un buon scambio tra placenta e feto.";

  const irTesto =
    "L’IR (indice di resistenza) descrive quanto il flusso incontri resistenza nei vasi; valori nella norma sono compatibili con un adeguato apporto di sangue al feto.";

  const norm =
    edf === "positivo" &&
    Number.isFinite(pi) &&
    Number.isFinite(ir);
  const riepilogo = norm
    ? "In sintesi, il quadro Doppler dell’arteria ombelicale risulta nella norma per l’epoca gestazionale."
    : "In sintesi, il quadro Doppler dell’arteria ombelicale merita inquadramento clinico per l’epoca gestazionale.";

  return { piTesto, irTesto, edfTesto, riepilogo };
}

/** Esito clinico: Doppler arteria ombelicale normale o alterato. */
export type DopplerUmbilicaleRisultato = "Normale" | "Alterato";

/**
 * Restituisce "Normale" se EDF positivo e percentili PI/IR non elevati (≤95°); altrimenti "Alterato".
 */
export function getDopplerUmbilicaleRisultato(
  edf: "positivo" | "assente" | "invertito",
  piPercentile: number | null | undefined,
  riPercentile: number | null | undefined,
): DopplerUmbilicaleRisultato {
  if (edf !== "positivo") return "Alterato";
  const piOk = piPercentile == null || piPercentile <= 95;
  const riOk = riPercentile == null || riPercentile <= 95;
  return piOk && riOk ? "Normale" : "Alterato";
}
