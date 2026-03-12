/**
 * Centili di crescita fetale (peso stimato vs epoca gestazionale).
 * Riferimento tipo Hadlock / curve di crescita ecografiche.
 * Peso in grammi, età gestazionale in settimane (es. 22.43 per 22+3).
 */

/** Peso (g) per centili 5, 10, 25, 50, 75, 90, 95 a ogni settimana 20-42 (Hadlock FP et al, Radiology 1991;181:129-133) */
const CENTILE_TABLE: Record<number, [number, number, number, number, number, number, number]> = {
  // week: [p5, p10, p25, p50, p75, p90, p95]
  20: [249, 270, 297, 331, 368, 405, 426],
  21: [299, 324, 357, 398, 443, 487, 513],
  22: [354, 384, 423, 472, 526, 578, 609],
  23: [417, 452, 499, 558, 622, 685, 721],
  24: [488, 529, 584, 653, 729, 803, 846],
  25: [567, 615, 679, 761, 850, 936, 986],
  26: [655, 710, 785, 881, 985, 1085, 1143],
  27: [751, 815, 901, 1013, 1133, 1249, 1316],
  28: [856, 929, 1028, 1160, 1298, 1431, 1508],
  29: [971, 1054, 1166, 1320, 1479, 1631, 1718],
  30: [1096, 1190, 1317, 1493, 1675, 1848, 1948],
  31: [1232, 1338, 1481, 1681, 1887, 2084, 2198],
  32: [1378, 1496, 1655, 1882, 2115, 2338, 2465],
  33: [1535, 1666, 1843, 2098, 2360, 2610, 2753],
  34: [1702, 1847, 2043, 2327, 2620, 2899, 3059],
  35: [1879, 2039, 2254, 2570, 2895, 3207, 3384],
  36: [2066, 2242, 2476, 2826, 3185, 3531, 3727],
  37: [2263, 2454, 2712, 3097, 3491, 3872, 4087],
  38: [2466, 2673, 2954, 3375, 3808, 4228, 4463],
  39: [2671, 2894, 3200, 3657, 4132, 4590, 4847],
  40: [2880, 3120, 3450, 3944, 4462, 4957, 5238],
  41: [3092, 3350, 3706, 4237, 4799, 5333, 5640],
  42: [3310, 3587, 3969, 4539, 5148, 5720, 6050],
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
  const match = s.match(/^(\d{1,2})\s*\+\s*(\d{1,2})$/);
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

export function getCentileForWeight(weightG: number, gaWeeks: number): number | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK || weightG <= 0) return null;
  const row = getPercentilesAtWeek(gaWeeks);
  if (!row) return null;
  // row corrisponde a CENTILE_INDEX = [5, 10, 25, 50, 75, 90, 95]
  // Usiamo p5 (idx 0), p50 (idx 3), p95 (idx 6) per coerenza col PDF
  const p5 = row[0] ?? 0;
  const p50 = row[3] ?? 0;
  const p95 = row[6] ?? 0;
  return estimateCentileRank(weightG, p5, p50, p95);
}

/**
 * Restituisce i valori assoluti di peso per i percentili 5, 50 e 95 alla settimana indicata.
 * Utile per disegnare graficamente la barra dei percentili nel PDF.
 */
export function getWeightPercentiles(gaWeeks: number): { p5: number; p50: number; p95: number } | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK) return null;
  const row = getPercentilesAtWeek(gaWeeks);
  if (!row) return null;
  return {
    p5: row[0] ?? 0,
    p50: row[3] ?? 0,
    p95: row[6] ?? 0,
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
