/**
 * Utility per costruire i punti (GA, peso) da usare nel grafico crescita fetale
 * a partire da più visite ostetriche (es. per mostrare l'andamento nel tempo).
 */
import type { Visit } from "../types/Storage";
import { calcolaStimePesoFetale } from "./fetalWeightUtils";
import {
  parseGestationalWeeks,
  FETAL_GROWTH_WEEK_RANGE,
} from "./fetalGrowthCentiles";

export interface FetalGrowthPoint {
  gaWeeks: number;
  pesoGrammi: number;
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
    if (!stima?.calcolabile || stima.pesoGrammi == null) continue;
    points.push({ gaWeeks: ga, pesoGrammi: stima.pesoGrammi });
  }
  return points;
}
