/**
 * Stima del peso fetale (EFW) con formule di riferimento.
 * Misure in ingresso in mm, risultato in grammi.
 * Riferimenti:
 * - Hadlock (AJOG 1985): 4 modelli principali.
 * - Shepard (1982)
 * - Campbell (1975)
 */

export interface BiometriaMm {
  bpdMm: number;
  hcMm: number;
  acMm: number;
  flMm: number;
}

export interface StimaPesoFetale {
  nome: string;
  descrizione: string;
  pesoGrammi: number | null;
  pesoKg: number | null;
  calcolabile: boolean;
}

// === FORMULE HADLOCK (1985) - EFW in grammi ===

/** Hadlock I: BPD, AC, FL (cm) */
function hadlock1(bpd: number, ac: number, fl: number): number {
  const log10 = 1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.162 * fl;
  return Math.pow(10, log10);
}

/** Hadlock II: HC, AC, FL (cm) */
function hadlock2(hc: number, ac: number, fl: number): number {
  const log10 = 1.326 + 0.0107 * hc + 0.0438 * ac + 0.158 * fl - 0.00326 * ac * fl;
  return Math.pow(10, log10);
}

/** Hadlock III: AC, FL (cm) */
function hadlock3(ac: number, fl: number): number {
  const log10 = 1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl;
  return Math.pow(10, log10);
}

/** Hadlock IV: BPD, HC, AC, FL (cm) */
function hadlock4(bpd: number, hc: number, ac: number, fl: number): number {
  const log10 = 1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
  return Math.pow(10, log10);
}

// === ALTRE FORMULE ===

/** Shepard: BPD, AC (cm). Output originale kg -> convertiamo in g. */
function shepard(bpd: number, ac: number): number {
  const log10 = -1.7492 + 0.166 * bpd + 0.046 * ac - 0.002646 * bpd * ac;
  return Math.pow(10, log10) * 1000;
}

/** Campbell (1975): AC (cm). Output originale kg -> convertiamo in g. */
function campbell(ac: number): number {
  // ln BW = -4.564 + 0.282 AC - 0.00331 AC^2
  const ln = -4.564 + 0.282 * ac - 0.00331 * ac * ac;
  return Math.exp(ln) * 1000;
}

function mmToCm(mm: number): number {
  return mm <= 0 ? 0 : mm / 10;
}

/**
 * Calcola tutte le stime di peso fetale disponibili.
 */
export function calcolaStimePesoFetale(b: BiometriaMm): Record<string, StimaPesoFetale> {
  const bpd = mmToCm(b.bpdMm);
  const hc = mmToCm(b.hcMm);
  const ac = mmToCm(b.acMm);
  const fl = mmToCm(b.flMm);

  // Helper per creare oggetto risultato
  const makeRes = (nome: string, desc: string, val: number | null, needed: boolean) => ({
    nome,
    descrizione: desc,
    pesoGrammi: val != null ? Math.round(val) : null,
    pesoKg: val != null ? Math.round(val / 10) / 100 : null,
    calcolabile: needed && val != null && !isNaN(val)
  });

  // Hadlock I: BPD, AC, FL
  const h1 = (bpd > 0 && ac > 0 && fl > 0) ? hadlock1(bpd, ac, fl) : null;
  // Hadlock II: HC, AC, FL
  const h2 = (hc > 0 && ac > 0 && fl > 0) ? hadlock2(hc, ac, fl) : null;
  // Hadlock III: AC, FL
  const h3 = (ac > 0 && fl > 0) ? hadlock3(ac, fl) : null;
  // Hadlock IV: BPD, HC, AC, FL
  const h4 = (bpd > 0 && hc > 0 && ac > 0 && fl > 0) ? hadlock4(bpd, hc, ac, fl) : null;
  
  // Shepard: BPD, AC
  const shep = (bpd > 0 && ac > 0) ? shepard(bpd, ac) : null;
  
  // Campbell: AC
  const camp = (ac > 0) ? campbell(ac) : null;

  return {
    hadlock1: makeRes("Hadlock I", "BPD, AC, FL", h1, bpd > 0 && ac > 0 && fl > 0),
    hadlock2: makeRes("Hadlock II", "HC, AC, FL", h2, hc > 0 && ac > 0 && fl > 0),
    hadlock3: makeRes("Hadlock III", "AC, FL", h3, ac > 0 && fl > 0),
    hadlock4: makeRes("Hadlock IV", "BPD, HC, AC, FL", h4, bpd > 0 && hc > 0 && ac > 0 && fl > 0),
    shepard: makeRes("Shepard", "BPD, AC", shep, bpd > 0 && ac > 0),
    campbell: makeRes("Campbell", "AC", camp, ac > 0),
  };
}

/** Campi biometria (in mm) richiesti da ogni formula per la stima del peso fetale */
export type BiometriaFieldKey = "bpdMm" | "hcMm" | "acMm" | "flMm";

export const FORMULA_BIOMETRIA_FIELDS: Record<string, BiometriaFieldKey[]> = {
  hadlock4: ["bpdMm", "hcMm", "acMm", "flMm"],
  hadlock1: ["bpdMm", "acMm", "flMm"],
  hadlock2: ["hcMm", "acMm", "flMm"],
  hadlock3: ["acMm", "flMm"],
  shepard: ["bpdMm", "acMm"],
  campbell: ["acMm"],
};

/** Etichette per i campi biometria (visite / UI) */
export const BIOMETRIA_FIELD_LABELS: Record<BiometriaFieldKey, string> = {
  bpdMm: "DBP (mm)",
  hcMm: "CC (mm)",
  acMm: "CA (mm)",
  flMm: "FL (mm)",
};

/** Backward compatibility alias */
export const calcolaTreScalePesoFetale = calcolaStimePesoFetale;
