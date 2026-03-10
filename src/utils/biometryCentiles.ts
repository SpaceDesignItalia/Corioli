/**
 * Curve centili per biometria fetale (DBP, CC, CA, FL) per età gestazionale.
 * Usate per calcolare il percentile di ogni misura nella UI (barra grafica).
 * Stessi dati usati nel PDF (PdfService).
 */

import { estimateCentileRank } from "./fetalGrowthCentiles";

export interface BiometryCentilePoint {
  week: number;
  p5: number;
  p50: number;
  p95: number;
}

const BPD_CENTILES: BiometryCentilePoint[] = [
  { week: 14, p5: 22, p50: 26, p95: 30 },
  { week: 16, p5: 29, p50: 33, p95: 37 },
  { week: 18, p5: 36, p50: 41, p95: 46 },
  { week: 20, p5: 43, p50: 48, p95: 53 },
  { week: 22, p5: 50, p50: 55, p95: 60 },
  { week: 24, p5: 56, p50: 61, p95: 66 },
  { week: 26, p5: 61, p50: 67, p95: 73 },
  { week: 28, p5: 67, p50: 73, p95: 79 },
  { week: 30, p5: 72, p50: 78, p95: 84 },
  { week: 32, p5: 77, p50: 83, p95: 89 },
  { week: 34, p5: 80, p50: 87, p95: 94 },
  { week: 36, p5: 83, p50: 90, p95: 97 },
  { week: 38, p5: 86, p50: 93, p95: 100 },
  { week: 40, p5: 88, p50: 95, p95: 102 },
];

const HC_CENTILES: BiometryCentilePoint[] = [
  { week: 14, p5: 89, p50: 99, p95: 109 },
  { week: 16, p5: 113, p50: 124, p95: 135 },
  { week: 18, p5: 138, p50: 150, p95: 162 },
  { week: 20, p5: 162, p50: 175, p95: 188 },
  { week: 22, p5: 184, p50: 198, p95: 212 },
  { week: 24, p5: 207, p50: 222, p95: 237 },
  { week: 26, p5: 227, p50: 243, p95: 259 },
  { week: 28, p5: 246, p50: 263, p95: 280 },
  { week: 30, p5: 264, p50: 282, p95: 300 },
  { week: 32, p5: 279, p50: 298, p95: 317 },
  { week: 34, p5: 293, p50: 313, p95: 333 },
  { week: 36, p5: 304, p50: 325, p95: 346 },
  { week: 38, p5: 313, p50: 335, p95: 357 },
  { week: 40, p5: 320, p50: 343, p95: 366 },
];

const AC_CENTILES: BiometryCentilePoint[] = [
  { week: 14, p5: 68, p50: 78, p95: 88 },
  { week: 16, p5: 91, p50: 103, p95: 115 },
  { week: 18, p5: 114, p50: 127, p95: 140 },
  { week: 20, p5: 137, p50: 152, p95: 167 },
  { week: 22, p5: 158, p50: 175, p95: 192 },
  { week: 24, p5: 178, p50: 197, p95: 216 },
  { week: 26, p5: 199, p50: 219, p95: 239 },
  { week: 28, p5: 218, p50: 240, p95: 262 },
  { week: 30, p5: 235, p50: 259, p95: 283 },
  { week: 32, p5: 253, p50: 279, p95: 305 },
  { week: 34, p5: 270, p50: 298, p95: 326 },
  { week: 36, p5: 287, p50: 316, p95: 345 },
  { week: 38, p5: 302, p50: 333, p95: 364 },
  { week: 40, p5: 315, p50: 348, p95: 381 },
];

const FL_CENTILES: BiometryCentilePoint[] = [
  { week: 14, p5: 12, p50: 14, p95: 16 },
  { week: 16, p5: 17, p50: 20, p95: 23 },
  { week: 18, p5: 24, p50: 27, p95: 30 },
  { week: 20, p5: 30, p50: 33, p95: 36 },
  { week: 22, p5: 35, p50: 38, p95: 41 },
  { week: 24, p5: 40, p50: 44, p95: 48 },
  { week: 26, p5: 45, p50: 49, p95: 53 },
  { week: 28, p5: 50, p50: 54, p95: 58 },
  { week: 30, p5: 54, p50: 58, p95: 62 },
  { week: 32, p5: 56, p50: 61, p95: 66 },
  { week: 34, p5: 60, p50: 65, p95: 70 },
  { week: 36, p5: 63, p50: 68, p95: 73 },
  { week: 38, p5: 65, p50: 71, p95: 77 },
  { week: 40, p5: 68, p50: 74, p95: 80 },
];

function interpolateCentile(
  data: BiometryCentilePoint[],
  gaWeeks: number
): { p5: number; p50: number; p95: number } | null {
  if (!data.length) return null;
  if (gaWeeks <= data[0].week)
    return { p5: data[0].p5, p50: data[0].p50, p95: data[0].p95 };
  const last = data[data.length - 1];
  if (gaWeeks >= last.week) return { p5: last.p5, p50: last.p50, p95: last.p95 };
  for (let i = 0; i < data.length - 1; i++) {
    if (gaWeeks >= data[i].week && gaWeeks <= data[i + 1].week) {
      const t = (gaWeeks - data[i].week) / (data[i + 1].week - data[i].week);
      return {
        p5: data[i].p5 + t * (data[i + 1].p5 - data[i].p5),
        p50: data[i].p50 + t * (data[i + 1].p50 - data[i].p50),
        p95: data[i].p95 + t * (data[i + 1].p95 - data[i].p95),
      };
    }
  }
  return null;
}

/** Restituisce il percentile (0–100) per una misura biometria a una data GA. */
export function getBiometryPercentile(
  value: number,
  gaWeeks: number | null,
  curve: "bpdMm" | "hcMm" | "acMm" | "flMm"
): number | null {
  if (gaWeeks == null || !Number.isFinite(value) || value <= 0) return null;
  const data =
    curve === "bpdMm"
      ? BPD_CENTILES
      : curve === "hcMm"
        ? HC_CENTILES
        : curve === "acMm"
          ? AC_CENTILES
          : FL_CENTILES;
  const ref = interpolateCentile(data, gaWeeks);
  if (!ref) return null;
  return estimateCentileRank(value, ref.p5, ref.p50, ref.p95);
}
