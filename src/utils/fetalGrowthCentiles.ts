/**
 * Centili di crescita fetale (peso stimato vs epoca gestazionale).
 * Riferimento tipo Hadlock / curve di crescita ecografiche.
 * Peso in grammi, età gestazionale in settimane (es. 22.43 per 22+3).
 */

/** Peso (g) per centili 5, 10, 25, 50, 75, 90, 95 a ogni settimana 20-42 */
const CENTILE_TABLE: Record<number, [number, number, number, number, number, number, number]> = {
  // week: [p5, p10, p25, p50, p75, p90, p95]
  20: [260, 280, 300, 331, 365, 400, 420],
  21: [315, 340, 365, 399, 438, 478, 502],
  22: [375, 405, 435, 478, 525, 575, 605],
  23: [442, 478, 515, 568, 625, 685, 720],
  24: [518, 560, 605, 670, 738, 810, 852],
  25: [602, 650, 702, 785, 865, 950, 1000],
  26: [695, 752, 812, 913, 1005, 1105, 1162],
  27: [798, 862, 932, 1055, 1162, 1278, 1345],
  28: [908, 982, 1062, 1210, 1335, 1470, 1548],
  29: [1028, 1112, 1202, 1379, 1522, 1675, 1765],
  30: [1158, 1252, 1355, 1560, 1722, 1898, 2000],
  31: [1298, 1405, 1520, 1754, 1935, 2135, 2250],
  32: [1448, 1568, 1698, 1960, 2162, 2385, 2515],
  33: [1610, 1742, 1885, 2178, 2402, 2648, 2792],
  34: [1782, 1928, 2085, 2407, 2655, 2928, 3085],
  35: [1965, 2125, 2300, 2646, 2920, 3220, 3395],
  36: [2158, 2335, 2528, 2895, 3195, 3525, 3718],
  37: [2362, 2555, 2768, 3153, 3482, 3842, 4052],
  38: [2575, 2785, 3015, 3419, 3782, 4175, 4402],
  39: [2798, 3025, 3275, 3692, 4095, 4522, 4770],
  40: [3032, 3278, 3550, 3971, 4420, 4882, 5152],
  41: [3275, 3542, 3835, 4255, 4758, 5258, 5550],
  42: [3528, 3815, 4132, 4543, 5110, 5648, 5962],
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
 * Dato il peso in grammi e l'età gestazionale (settimane decimali),
 * restituisce il centile approssimato (5, 10, 25, 50, 75, 90, 95 o interpolato).
 * Restituisce null se GA o peso fuori range.
 */
export function getCentileForWeight(weightG: number, gaWeeks: number): number | null {
  if (gaWeeks < MIN_WEEK || gaWeeks > MAX_WEEK || weightG <= 0) return null;
  const row = getPercentilesAtWeek(gaWeeks);
  if (!row) return null;
  if (weightG <= row[0]) return 5;
  if (weightG >= row[6]) return 95;
  for (let i = 0; i < CENTILE_INDEX.length - 1; i++) {
    if (weightG >= row[i] && weightG <= row[i + 1]) {
      const p0 = CENTILE_INDEX[i];
      const p1 = CENTILE_INDEX[i + 1];
      const t = (weightG - row[i]) / (row[i + 1] - row[i]);
      return Math.round(p0 + t * (p1 - p0));
    }
  }
  return null;
}

/**
 * Restituisce una etichetta breve per il centile (es. "<5", "50", "75-90", ">95").
 */
export function getCentileLabel(centile: number | null): string {
  if (centile == null) return "";
  if (centile <= 5) return "<5°";
  if (centile >= 95) return ">95°";
  const idx = CENTILE_INDEX.indexOf(centile as (typeof CENTILE_INDEX)[number]);
  if (idx >= 0) return `${centile}°`;
  const below = CENTILE_INDEX.filter((p) => p < centile).pop();
  const above = CENTILE_INDEX.filter((p) => p > centile).shift();
  if (below != null && above != null) return `${below}-${above}°`;
  return `${centile}°`;
}
