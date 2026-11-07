/**
 * Centili di crescita fetale (peso stimato vs epoca gestazionale).
 * Peso in grammi, età gestazionale in settimane (es. 22.43 per 22+3).
 */

/**
 * Hadlock FP, Harrist RB, Martinez-Poyer J, Radiology 1991;181:129-133:
 * ln(peso) = 0.578 + 0.332·EG − 0.00354·EG², DS = 12.7% del peso atteso.
 * Si usa l'equazione e non la tabella stampata, che non coincide con essa
 * ("Revisiting the Hadlock 1991 population reference", AJOG). La tabella
 * a mano usata prima si discostava fino al +9% a 40 settimane.
 * L'equazione è pubblicata per 10–40 settimane: 41–42 sono un'estrapolazione.
 */
const HADLOCK_1991_SD = 0.127;
const MIN_WEEK = 20;
const MAX_WEEK = 42;

function hadlock1991MedianWeight(gaWeeks: number): number {
  return Math.exp(0.578 + 0.332 * gaWeeks - 0.00354 * gaWeeks * gaWeeks);
}

/**
 * Converte "22+3" o "22" in settimane decimali (22.43 o 22).
 */
export function parseGestationalWeeks(settimaneGestazione: string): number | null {
  if (!settimaneGestazione?.trim()) return null;
  const s = settimaneGestazione.trim();
  const match = s.match(/^(\d{1,2})\s*\+\s*(\d{1,2})$/);
  if (match) {
    const weeks = parseInt(match[1], 10);
    const days = parseInt(match[2], 10);
    if (days >= 0 && days <= 6 && weeks >= 0) return weeks + days / 7;
    // Giorni fuori range (es. "32+7"): valore ambiguo. Va rifiutato, non
    // interpretato: il fallback numerico più sotto leggerebbe "32+7" come 32,
    // perdendo una settimana e falsando il centile del peso stimato.
    return null;
  }
  const n = parseFloat(s.replace(",", "."));
  if (!Number.isNaN(n) && n >= 0) return n;
  return null;
}

const CRL_MIN_MM = 3;
/** Oltre 84 mm Robinson non è più valida: si data con la circonferenza cranica. */
const CRL_MAX_MM = 84;

/**
 * Epoca gestazionale in giorni compiuti dal CRL (mm).
 * Robinson HP, Fleming JE, Br J Obstet Gynaecol 1975;82:702-710:
 * GA_giorni = 8.052 × √CRL + 23.73. Con i giorni compiuti CRL 45–84 mm
 * dà 11+0 – 13+6, la finestra della translucenza nucale (FMF).
 * `null` se il CRL è fuori dal range di validità.
 */
export function gestationalDaysFromCrl(crlMm: number): number | null {
  if (!Number.isFinite(crlMm) || crlMm < CRL_MIN_MM || crlMm > CRL_MAX_MM) return null;
  return Math.floor(8.052 * Math.sqrt(crlMm) + 23.73);
}

/**
 * Scarto massimo (giorni) tra epoca attuale e CRL entro cui non si ridata.
 * ACOG Committee Opinion 700 (2017): 5 giorni fino a 8+6, 7 giorni da 9+0 a 13+6.
 */
export function crlRedatingThresholdDays(currentGaDays: number): number {
  return currentGaDays < 9 * 7 ? 5 : 7;
}

/**
 * Calcola la Cumulative Distribution Function (CDF) della distribuzione normale standard.
 * Approssimazione numerica (Abramowitz & Stegun 7.1.26).
 * Errore < 1.5 * 10^-7.
 */
export function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014337 * Math.exp(-x * x / 2);
  // Abramowitz & Stegun 7.1.26: Phi(x)=1-phi(x)*(b1*t+b2*t^2+...+b5*t^5), t=1/(1+p*x)
  const poly =
    0.319381530 * t +
    -0.356563782 * t * t +
    1.781477937 * t * t * t +
    -1.821255978 * t * t * t * t +
    1.330274429 * t * t * t * t * t;
  const prob = d * poly;
  if (x > 0) return 1 - prob;
  return prob;
}

/**
 * Stima il rango centile (0-100) con approccio split-half SD.
 * Per value ≤ p50 usa sdLeft = (p50-p5)/1.645; per value > p50 usa sdRight = (p95-p50)/1.645.
 * Garantisce i valori esatti (5%, 50%, 95%) ai punti di riferimento e gestisce
 * correttamente distribuzioni asimmetriche (peso fetale, PI).
 */
export function estimateCentileRank(value: number, p5: number, p50: number, p95: number): number {
  if (p5 >= p95) return 50;

  if (value <= p50) {
    const sdLeft = (p50 - p5) / 1.645;
    if (sdLeft <= 0) return 50;
    const z = (value - p50) / sdLeft;
    return Math.min(100, Math.max(0, normalCDF(z) * 100));
  } else {
    const sdRight = (p95 - p50) / 1.645;
    if (sdRight <= 0) return 50;
    const z = (value - p50) / sdRight;
    return Math.min(100, Math.max(0, normalCDF(z) * 100));
  }
}

/** Formatta il centile per la UI (es. <5°, 78°, >95°) */
export function formatCentileLabel(rank: number): string {
  if (rank <= 5.01) return "<5°";
  if (rank >= 94.99) return ">95°";
  return `${Math.round(rank)}°`;
}

/**
 * Restituisce la categoria di crescita clinica basata sul centile.
 * SGA: Small for Gestational Age (<10°)
 * LGA: Large for Gestational Age (>90°)
 * AGA: Appropriate for Gestational Age (10-90°)
 */
export function getGrowthCategory(centile: number): "SGA" | "LGA" | "AGA" {
  if (centile < 10) return "SGA";
  if (centile > 90) return "LGA";
  return "AGA";
}

export function getCentileForWeight(weightG: number, gaWeeks: number): number | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK || weightG <= 0) return null;
  const p50 = hadlock1991MedianWeight(gaWeeks);
  return normalCDF((weightG - p50) / (HADLOCK_1991_SD * p50)) * 100;
}

/**
 * Restituisce i valori assoluti di peso per i percentili 5, 50 e 95 alla settimana indicata.
 * Utile per disegnare graficamente la barra dei percentili nel PDF.
 */
export function getWeightPercentiles(gaWeeks: number): { p5: number; p50: number; p95: number } | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK) return null;
  const p50 = hadlock1991MedianWeight(gaWeeks);
  const delta = 1.645 * HADLOCK_1991_SD * p50;
  return {
    p5: Math.round(p50 - delta),
    p50: Math.round(p50),
    p95: Math.round(p50 + delta),
  };
}

/**
 * DEPRECATA: Usa formatCentileLabel(rank) invece.
 * Mantenuta per retrocompatibilità se necessario, ma ora delega.
 */
export function getCentileLabel(centile: number | null): string {
  if (centile == null) return "";
  return formatCentileLabel(centile);
}

/** Range settimane per il grafico */
export const FETAL_GROWTH_WEEK_RANGE = { min: MIN_WEEK, max: MAX_WEEK } as const;
