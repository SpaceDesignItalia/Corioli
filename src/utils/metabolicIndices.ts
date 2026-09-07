/**
 * Indici metabolici mostrati nella visita ginecologica: BMI e HOMA-IR.
 *
 * Ogni indice ha delle fasce ("band") con etichetta in italiano e classi
 * Tailwind, così la stessa scala di colori vale ovunque venga mostrato il
 * valore (form visita, storico, ecc.). Nel PDF si usa solo `label`: il referto
 * è in bianco e nero.
 */

export interface MetabolicBand {
  /** Chiave stabile della fascia (per test e confronti). */
  key: string;
  /** Etichetta clinica in italiano, es. "Obesità I". */
  label: string;
  /** Classi del chip colorato: testo + sfondo + bordo. */
  chipClass: string;
  /** Classe di sfondo del pallino/segmento nella legenda. */
  dotClass: string;
}

// ─── BMI ─────────────────────────────────────────────────────────────────────

/** Fasce OMS, in ordine crescente. `max` è escluso (l'ultima fascia è aperta). */
export const BMI_BANDS: ReadonlyArray<MetabolicBand & { max: number }> = [
  {
    key: "sottopeso",
    label: "Sottopeso",
    max: 18.5,
    chipClass: "text-sky-700 bg-sky-50 border-sky-200",
    dotClass: "bg-sky-400",
  },
  {
    key: "normopeso",
    label: "Normopeso",
    max: 25,
    chipClass: "text-success-700 bg-success-50 border-success-200",
    dotClass: "bg-success-500",
  },
  {
    key: "sovrappeso",
    label: "Sovrappeso",
    max: 30,
    chipClass: "text-amber-700 bg-amber-50 border-amber-200",
    dotClass: "bg-amber-400",
  },
  {
    key: "obesita1",
    label: "Obesità I",
    max: 35,
    chipClass: "text-orange-700 bg-orange-50 border-orange-200",
    dotClass: "bg-orange-400",
  },
  {
    key: "obesita2",
    label: "Obesità II",
    max: 40,
    chipClass: "text-red-700 bg-red-50 border-red-200",
    dotClass: "bg-red-400",
  },
  {
    key: "obesita3",
    label: "Obesità III",
    max: Number.POSITIVE_INFINITY,
    chipClass: "text-red-800 bg-red-100 border-red-300",
    dotClass: "bg-red-600",
  },
];

/** BMI in kg/m². `null` se peso o altezza non sono utilizzabili. */
export function computeBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  return Number.isFinite(bmi) ? bmi : null;
}

/** Un decimale, come da prassi clinica. */
export function formatBmi(bmi: number): string {
  return bmi.toFixed(1);
}

export function bmiBand(bmi: number): MetabolicBand {
  return BMI_BANDS.find((b) => bmi < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1];
}

/** Testo compatto per PDF e storico, es. "27.3 (Sovrappeso)". */
export function formatBmiWithBand(bmi: number): string {
  return `${formatBmi(bmi)} (${bmiBand(bmi).label})`;
}

// ─── HOMA-IR ─────────────────────────────────────────────────────────────────

/**
 * Soglie orientative per l'adulto: sotto 2 normale, 2–2.5 borderline,
 * 2.5–5 insulino-resistenza, oltre 5 marcata. Vanno lette insieme al quadro
 * clinico (in particolare nella PCOS).
 */
export const HOMA_IR_BANDS: ReadonlyArray<MetabolicBand & { max: number }> = [
  {
    key: "normale",
    label: "Normale",
    max: 2,
    chipClass: "text-success-700 bg-success-50 border-success-200",
    dotClass: "bg-success-500",
  },
  {
    key: "borderline",
    label: "Borderline",
    max: 2.5,
    chipClass: "text-amber-700 bg-amber-50 border-amber-200",
    dotClass: "bg-amber-400",
  },
  {
    key: "insulino_resistenza",
    label: "Insulino-resistenza",
    max: 5,
    chipClass: "text-orange-700 bg-orange-50 border-orange-200",
    dotClass: "bg-orange-400",
  },
  {
    key: "insulino_resistenza_marcata",
    label: "Insulino-resistenza marcata",
    max: Number.POSITIVE_INFINITY,
    chipClass: "text-red-700 bg-red-50 border-red-200",
    dotClass: "bg-red-500",
  },
];

/**
 * HOMA-IR = glicemia (mg/dL) × insulinemia (µU/mL) / 405.
 * `null` se manca uno dei due valori.
 */
export function computeHomaIr(
  glicemiaMgDl: number | null | undefined,
  insulinemiaUuMl: number | null | undefined,
): number | null {
  if (!glicemiaMgDl || !insulinemiaUuMl) return null;
  if (glicemiaMgDl <= 0 || insulinemiaUuMl <= 0) return null;
  const homa = (glicemiaMgDl * insulinemiaUuMl) / 405;
  return Number.isFinite(homa) ? homa : null;
}

/** Due decimali: i valori utili stanno quasi tutti sotto 10. */
export function formatHomaIr(homa: number): string {
  return homa.toFixed(2);
}

export function homaIrBand(homa: number): MetabolicBand {
  return (
    HOMA_IR_BANDS.find((b) => homa < b.max) ??
    HOMA_IR_BANDS[HOMA_IR_BANDS.length - 1]
  );
}

/** Testo compatto per PDF e storico, es. "3.21 (Insulino-resistenza)". */
export function formatHomaIrWithBand(homa: number): string {
  return `${formatHomaIr(homa)} (${homaIrBand(homa).label})`;
}
