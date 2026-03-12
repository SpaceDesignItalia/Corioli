/**
 * Percentili biometria fetale via regressione cubica su dati Hadlock 1984.
 * Evita gli errori di interpolazione da tabelle a step fisso.
 * Riferimento: Hadlock FP et al, Radiology 1984;152:497-501
 */

import { estimateCentileRank } from "./fetalGrowthCentiles";

export type BiometryParam = "bpdMm" | "hcMm" | "acMm" | "flMm";

// Medie per regressione cubica: mu = a + b*GA + c*GA^2 + d*GA^3
// FL - Hadlock con correzione -2mm per allineamento a curve CFEF/Salomon
// Riferimento: Hadlock 1984 p50 - 2mm, SD=3.0mm
const FL_MEAN = (ga: number): number =>
  -25.01558 + 2.47146 * ga + 0.030357 * ga * ga + -0.0007401 * ga * ga * ga;
const FL_SD = 3.0;

// BPD - SD=3.0mm
const BPD_MEAN = (ga: number): number =>
  -11.41647 + 1.7995 * ga + 0.085263 * ga * ga + -0.0016004 * ga * ga * ga;
const BPD_SD = 3.0;

// HC - SD=10.0mm
const HC_MEAN = (ga: number): number =>
  -67.03636 + 10.27685 * ga + 0.189468 * ga * ga + -0.0047156 * ga * ga * ga;
const HC_SD = 10.0;

// AC - SD=12.0mm
const AC_MEAN = (ga: number): number =>
  -63.21499 + 8.44699 * ga + 0.170025 * ga * ga + -0.0030702 * ga * ga * ga;
const AC_SD = 12.0;

function getBiometryMeanAndSd(param: BiometryParam): { mean: (ga: number) => number; sd: (ga: number) => number } {
  switch (param) {
    case "bpdMm":
      return { mean: BPD_MEAN, sd: () => BPD_SD };
    case "hcMm":
      return { mean: HC_MEAN, sd: () => HC_SD };
    case "acMm":
      return { mean: AC_MEAN, sd: () => AC_SD };
    case "flMm":
      return { mean: FL_MEAN, sd: () => FL_SD };
    default:
      return { mean: BPD_MEAN, sd: () => BPD_SD };
  }
}

/** Restituisce p5, p50, p95 per una misura biometrica a GA decimale. */
export function getBiometryReferenceAtGa(
  gaWeeks: number | null,
  param: BiometryParam
): { p5: number; p50: number; p95: number } | null {
  if (gaWeeks == null || !Number.isFinite(gaWeeks)) return null;
  const { mean, sd } = getBiometryMeanAndSd(param);
  const mu = mean(gaWeeks);
  const sigma = sd(gaWeeks);
  return {
    p5: mu - 1.645 * sigma,
    p50: mu,
    p95: mu + 1.645 * sigma,
  };
}

/** Restituisce il percentile (0-100) per una misura biometria a una data GA. */
export function getBiometryPercentile(
  value: number,
  gaWeeks: number | null,
  param: BiometryParam
): number | null {
  if (gaWeeks == null || !Number.isFinite(value) || value <= 0) return null;
  const ref = getBiometryReferenceAtGa(gaWeeks, param);
  if (!ref) return null;
  return estimateCentileRank(value, ref.p5, ref.p50, ref.p95);
}
