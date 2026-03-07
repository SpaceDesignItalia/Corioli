/**
 * Centili di crescita fetale (peso stimato vs epoca gestazionale).
 * Riferimento tipo Hadlock / curve di crescita ecografiche.
 * Peso in grammi, età gestazionale in settimane (es. 22.43 per 22+3).
 */

/** Peso (g) per centili 5, 10, 25, 50, 75, 90, 95 a ogni settimana 20-42 (Hadlock -3% population adjustment) */
const CENTILE_TABLE: Record<number, [number, number, number, number, number, number, number]> = {
  // week: [p5, p10, p25, p50, p75, p90, p95]
  20: [252, 272, 291, 321, 354, 388, 407],
  21: [306, 330, 354, 387, 425, 464, 487],
  22: [364, 393, 422, 464, 509, 558, 587],
  23: [429, 464, 500, 551, 606, 664, 698],
  24: [502, 543, 587, 650, 716, 786, 826],
  25: [584, 631, 681, 761, 839, 922, 970],
  26: [674, 729, 788, 886, 975, 1072, 1127],
  27: [774, 836, 904, 1023, 1127, 1240, 1305],
  28: [881, 953, 1030, 1174, 1295, 1426, 1502],
  29: [997, 1079, 1166, 1338, 1476, 1625, 1712],
  30: [1123, 1214, 1314, 1513, 1670, 1841, 1940],
  31: [1259, 1363, 1474, 1701, 1877, 2071, 2183],
  32: [1405, 1521, 1647, 1901, 2097, 2313, 2440],
  33: [1562, 1690, 1828, 2113, 2330, 2569, 2708],
  34: [1729, 1870, 2022, 2335, 2575, 2840, 2992],
  35: [1906, 2061, 2231, 2567, 2832, 3123, 3293],
  36: [2093, 2265, 2452, 2808, 3099, 3419, 3606],
  37: [2291, 2478, 2685, 3058, 3378, 3727, 3930],
  38: [2498, 2701, 2925, 3316, 3669, 4050, 4270],
  39: [2714, 2934, 3177, 3581, 3972, 4386, 4627],
  40: [2941, 3180, 3444, 3852, 4287, 4736, 4997],
  41: [3177, 3436, 3720, 4127, 4615, 5100, 5384],
  42: [3422, 3701, 4008, 4407, 4957, 5479, 5783],
};

const CENTILE_INDEX = [5, 10, 25, 50, 75, 90, 95] as const;
const MIN_WEEK = 20;
const MAX_WEEK = 42;

/**
 * Converte "22+3" o "22" in settimane decimali (22.43 o 22).
 */
export function parseGestationalWeeks(settimaneGestazione: string): number | null {
  if (!settimaneGestazione?.trim()) return null;
  const s = settimaneGestazione.trim();
  const match = s.match(/^(\d{1,2})\s*\+\s*(\d)$/);
  if (match) {
    const weeks = parseInt(match[1], 10);
    const days = parseInt(match[2], 10);
    if (days >= 0 && days <= 6 && weeks >= 0) return weeks + days / 7;
  }
  const n = parseFloat(s.replace(",", "."));
  if (!Number.isNaN(n) && n >= 0) return n;
  return null;
}

function getRow(week: number): [number, number, number, number, number, number, number] | null {
  const w = Math.floor(week);
  if (w < MIN_WEEK || w > MAX_WEEK) return null;
  return CENTILE_TABLE[w] ?? null;
}

/**
 * Interpola linearmente i valori di peso per i centili alla settimana data.
 */
function getPercentilesAtWeek(week: number): number[] | null {
  const w0 = Math.floor(week);
  const w1 = w0 + 1;
  const t = week - w0;
  const r0 = getRow(w0);
  const r1 = getRow(w1);
  if (!r0) return null;
  if (!r1 || w1 > MAX_WEEK) return r0;
  return r0.map((v, i) => v + t * (r1[i] - v));
}

/**
 * Calcola la Cumulative Distribution Function (CDF) della distribuzione normale standard.
 * Approssimazione numerica (Abramowitz & Stegun 7.1.26).
 * Errore < 1.5 * 10^-7.
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014337 * Math.exp(-x * x / 2);
  const prob = d * t * (0.319381530 * t + -0.356563782 * t * t + 1.781477937 * t * t * t + -1.821255978 * t * t * t * t + 1.330274429 * t * t * t * t * t);
  if (x > 0) return 1 - prob;
  return prob;
}

/**
 * Stima il rango centile (0-100) assumendo una distribuzione normale.
 * Ricostruisce Media e SD dai percentili p5, p50, p95 forniti.
 * Mean = p50
 * SD = (p95 - p5) / 3.29  (poiché p5-p95 copre +/- 1.645 SD = 3.29 SD)
 */
export function estimateCentileRank(value: number, p5: number, p50: number, p95: number): number {
  // Sanity check
  if (p5 >= p95) return 50;

  const mean = p50;
  const sd = (p95 - p5) / 3.29;

  if (sd <= 0) return 50;

  const z = (value - mean) / sd;
  const percentile = normalCDF(z) * 100;

  // Clamp 0-100 (anche se CDF lo fa già matematicamente, utile per precisione JS)
  return Math.min(100, Math.max(0, percentile));
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

/**
 * Dato il peso in grammi e l'età gestazionale (settimane decimali),
 * restituisce il centile puntuale (0-100) usando la logica a 3 punti (p5, p50, p95)
 * coerente col PDF.
 */
export function getCentileForWeight(weightG: number, gaWeeks: number): number | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK || weightG <= 0) return null;
  const row = getPercentilesAtWeek(gaWeeks);
  if (!row) return null;
  // row corrisponde a CENTILE_INDEX = [5, 10, 25, 50, 75, 90, 95]
  // Usiamo p5 (idx 0), p50 (idx 3), p95 (idx 6) per coerenza col PDF
  const p5 = row[0];
  const p50 = row[3];
  const p95 = row[6];
  return estimateCentileRank(weightG, p5, p50, p95);
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

/**
 * Restituisce i punti delle curve centili per disegnare il grafico (es. in PDF).
 * Ogni elemento: { centile: 5|10|25|50|75|90|95, points: { week, weight }[] }.
 */
export function getCentileCurveData(): {
  centile: (typeof CENTILE_INDEX)[number];
  points: { week: number; weight: number }[];
}[] {
  return CENTILE_INDEX.map((centile, idx) => ({
    centile,
    points: Array.from(
      { length: MAX_WEEK - MIN_WEEK + 1 },
      (_, i) => {
        const week = MIN_WEEK + i;
        const row = CENTILE_TABLE[week];
        return { week, weight: row ? row[idx] : 0 };
      },
    ),
  }));
}
