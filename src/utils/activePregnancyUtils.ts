import { addDays, differenceInDays, parseISO, isValid } from "date-fns";
import type { Patient, Visit } from "../types/Storage";
import { normalizeLMP } from "./fetalGrowthChartUtils";

export interface ActivePregnancy {
  patientId: string;
  patientName: string;
  initials: string;
  umDate: Date;
  dpp: Date;
  weeks: number;
  days: number;
  gestationLabel: string;
  daysToBirth: number;
  progressPercent: number;
  dppLabel: string;
}

function parseLMPDate(lmp: string): Date | null {
  const key = normalizeLMP(lmp);
  if (!key) return null;
  const d = parseISO(key);
  return isValid(d) ? d : null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getPatientInitials(patient: Patient, displayName: string | null): string {
  if (displayName) {
    const fromName = `${patient.nome?.[0] ?? ""}${patient.cognome?.[0] ?? ""}`.trim();
    if (fromName) return fromName.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  return "?";
}

export function computeActivePregnancies(
  visits: Visit[],
  patients: Patient[],
  referenceDate: Date = new Date(),
): ActivePregnancy[] {
  const today = startOfDay(referenceDate);
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const obstetricByPatient = new Map<string, Visit[]>();
  for (const v of visits) {
    if (v.tipo !== "ostetrica" || !v.ostetricia) continue;
    const list = obstetricByPatient.get(v.patientId) ?? [];
    list.push(v);
    obstetricByPatient.set(v.patientId, list);
  }

  const results: ActivePregnancy[] = [];

  for (const [patientId, patientVisits] of obstetricByPatient) {
    const sorted = [...patientVisits].sort(
      (a, b) =>
        new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime(),
    );
    const latestWithUm = sorted.find((v) =>
      v.ostetricia?.ultimaMestruazione?.trim(),
    );
    if (!latestWithUm?.ostetricia) continue;

    const umRaw = latestWithUm.ostetricia.ultimaMestruazione.trim();

    const umDate = parseLMPDate(umRaw);
    if (!umDate) continue;

    const umDay = startOfDay(umDate);
    const dpp = startOfDay(addDays(umDay, 280));

    if (dpp.getTime() <= today.getTime()) continue;

    const totalDays = differenceInDays(today, umDay);
    if (totalDays < 0) continue;

    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const daysToBirth = Math.ceil(
      (dpp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const progressPercent = Math.min(100, (weeks / 40) * 100);

    const patient = patientMap.get(patientId);
    const displayName = patient
      ? `${patient.nome ?? ""} ${patient.cognome ?? ""}`.trim() || null
      : null;
    const patientName = displayName ?? "Paziente senza nome";

    results.push({
      patientId,
      patientName,
      initials: patient
        ? getPatientInitials(patient, displayName)
        : patientName.slice(0, 2).toUpperCase(),
      umDate: umDay,
      dpp,
      weeks,
      days,
      gestationLabel: `${weeks}+${days}`,
      daysToBirth,
      progressPercent,
      dppLabel: dpp.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    });
  }

  // Più vicine al parto per prime (meno giorni al parto → DPP più prossima)
  return results.sort((a, b) => {
    if (a.daysToBirth !== b.daysToBirth) {
      return a.daysToBirth - b.daysToBirth;
    }
    return a.dpp.getTime() - b.dpp.getTime();
  });
}
