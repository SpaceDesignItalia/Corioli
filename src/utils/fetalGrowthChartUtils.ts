/**
 * Utility per costruire i punti (GA, peso) da usare nel grafico crescita fetale
 * a partire da più visite ostetriche (es. per mostrare l'andamento nel tempo).
 * Le visite sono filtrate per "stessa gravidanza" (stessa LMP) così grafici e tabelle
 * si resettano quando inizia una nuova gravidanza.
 */
import type { Visit } from "../types/Storage";
import { calcolaStimePesoFetale } from "./fetalWeightUtils";
import {
  parseGestationalWeeks,
  FETAL_GROWTH_WEEK_RANGE,
} from "./fetalGrowthCentiles";

/** Normalizza ultima mestruazione a YYYY-MM-DD per confronto (stessa gravidanza = stessa LMP). */
export function normalizeLMP(lmp: string | undefined): string {
  if (!lmp || !lmp.trim()) return "";
  const d = new Date(lmp.trim());
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Restituisce solo le visite che appartengono alla stessa gravidanza della visita di riferimento
 * (stessa ultima mestruazione). Così le curve e le tabelle non mischiano gravidanze diverse.
 */
export function getVisitsOfSamePregnancy(
  visits: Visit[],
  referenceVisit: Visit,
): Visit[] {
  const refLMP = referenceVisit.ostetricia?.ultimaMestruazione;
  const key = normalizeLMP(refLMP);
  if (!key) return visits; // nessuna LMP di riferimento: non filtrare (comportamento precedente)
  return visits.filter((v) => {
    if (v.tipo !== "ostetrica" || !v.ostetricia) return false;
    return normalizeLMP(v.ostetricia.ultimaMestruazione) === key;
  });
}

export interface FetalGrowthPoint {
  gaWeeks: number;
  pesoGrammi: number;
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
}

/**
 * Da una lista di visite ostetriche (ordinate per data) restituisce i punti
 * (età gestazionale, peso stimato) validi per il grafico.
 * Usa la formula indicata (es. "hadlock4") per il peso; solo visite con
 * settimane gestazionali e biometria utilizzabile producono un punto.
 */
export function getFetalGrowthDataPointsFromVisits(
  visits: Visit[],
  formulaPesoFetale: string,
): FetalGrowthPoint[] {
  const formula = formulaPesoFetale || "hadlock4";
  const ostetriche = visits
    .filter((v): v is Visit & { ostetricia: NonNullable<Visit["ostetricia"]> } => v.tipo === "ostetrica" && !!v.ostetricia)
    .slice()
    .sort((a, b) => new Date(a.dataVisita).getTime() - new Date(b.dataVisita).getTime());

  const points: FetalGrowthPoint[] = [];
  for (const v of ostetriche) {
    const obs = v.ostetricia;
    const ga = parseGestationalWeeks(obs.settimaneGestazione ?? "");
    if (ga == null || ga < FETAL_GROWTH_WEEK_RANGE.min || ga > FETAL_GROWTH_WEEK_RANGE.max) continue;
    const biometria = obs.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 };
    const stime = calcolaStimePesoFetale(biometria);
    const stima = stime[formula] ?? stime.hadlock4;
    // Anche se il peso non è calcolabile, potremmo voler mostrare le altre biometrie se presenti
    const peso = (stima?.calcolabile && stima.pesoGrammi != null) ? stima.pesoGrammi : 0;
    
    // Se non c'è peso e nessuna biometria, saltiamo
    if (peso <= 0 && !biometria.bpdMm && !biometria.hcMm && !biometria.acMm && !biometria.flMm) continue;

    points.push({
      gaWeeks: ga,
      pesoGrammi: peso,
      bpdMm: biometria.bpdMm > 0 ? biometria.bpdMm : undefined,
      hcMm: biometria.hcMm > 0 ? biometria.hcMm : undefined,
      acMm: biometria.acMm > 0 ? biometria.acMm : undefined,
      flMm: biometria.flMm > 0 ? biometria.flMm : undefined,
    });
  }
  return points;
}
