import { Visit, VisitFieldChange } from "../types/Storage";

/**
 * Utility per la cronologia delle modifiche di una visita.
 *
 * Confronta due versioni di una visita e produce l'elenco dei campi modificati,
 * con etichette in italiano e valori (precedente / nuovo) già formattati per
 * la visualizzazione. I valori sono salvati come stringhe per non duplicare in
 * cronologia dati pesanti (es. immagini ecografiche in base64).
 */

const TIPO_LABELS: Record<string, string> = {
  generale: "Generale",
  ginecologica: "Ginecologica",
  ginecologica_pediatrica: "Ginecologica pediatrica",
  ostetrica: "Ostetrica",
};

const TOP_LEVEL_LABELS: Record<string, string> = {
  dataVisita: "Data visita",
  descrizioneClinica: "Descrizione clinica",
  anamnesi: "Anamnesi",
  esamiObiettivo: "Esame obiettivo",
  conclusioniDiagnostiche: "Conclusioni diagnostiche",
  terapie: "Terapie",
  tipo: "Tipo visita",
};

const ANAMNESI_LABELS: Record<string, string> = {
  familiare: "Familiare",
  fisiologica: "Fisiologica",
  patologica: "Patologica",
  ginecologica: "Ginecologica",
  farmacologica: "Farmacologica",
  allergica: "Allergica",
  partner: "Partner",
};

const GINECOLOGIA_LABELS: Record<string, string> = {
  gravidanze: "Gravidanze",
  parti: "Parti",
  partiSpontanei: "Parti spontanei",
  partiCesarei: "Parti cesarei",
  aborti: "Aborti",
  abortiSpontanei: "Aborti spontanei",
  ivg: "IVG",
  pesoCorporeo: "Peso corporeo",
  glicemiaDigiuno: "Glicemia a digiuno",
  insulinemiaDigiuno: "Insulinemia a digiuno",
  menarca: "Menarca",
  stadioTannerFemmina: "Stadio di Tanner",
  ultimaMestruazione: "Ultima mestruazione",
  prestazione: "Prestazione",
  problemaClinico: "Problema clinico",
  chirurgiaPregessa: "Chirurgia pregressa",
  allergie: "Allergie",
  familiarita: "Familiarità",
  terapiaInAtto: "Terapia in atto",
  vaccinazioneHPV: "Vaccinazione HPV",
  esameBimanuale: "Esame bimanuale",
  speculum: "Speculum",
  ecografiaTV: "Ecografia TV",
  accertamenti: "Accertamenti",
  conclusione: "Conclusione",
  terapiaSpecifica: "Terapia specifica",
  ecografiaImmagini: "Immagini ecografia",
};

const OSTETRICIA_LABELS: Record<string, string> = {
  settimaneGestazione: "Settimane di gestazione",
  ultimaMestruazione: "Ultima mestruazione",
  dataPresunta: "Data presunta parto",
  modalitaConcepimento: "Modalità di concepimento",
  problemaClinico: "Problema clinico",
  gravidanzePrec: "Gravidanze precedenti",
  partiPrec: "Parti precedenti",
  partiPrecSpontanei: "Parti precedenti spontanei",
  partiPrecCesarei: "Parti precedenti cesarei",
  abortiPrec: "Aborti precedenti",
  abortiPrecSpontanei: "Aborti precedenti spontanei",
  ivgPrec: "IVG precedenti",
  pesoPreGravidanza: "Peso pre-gravidanza",
  pesoAttuale: "Peso attuale",
  pressioneArteriosa: "Pressione arteriosa",
  frequenzaCardiaca: "Frequenza cardiaca",
  fumaInGravidanza: "Fuma in gravidanza",
  pacchettiSigaretteAlGiorno: "Pacchetti sigarette/giorno",
  assunzioneAcidoFolico: "Assunzione acido folico",
  altezzaUterina: "Altezza uterina",
  battitiFetali: "Battiti fetali",
  movimentiFetali: "Movimenti fetali",
  esamiEseguiti: "Esami eseguiti",
  ecografiaOffice: "Ecografia office",
  noteOstetriche: "Note ostetriche",
  prestazione: "Prestazione",
  esameObiettivo: "Esame obiettivo",
  crlMm: "CRL (mm)",
  ecografiaImmagini: "Immagini ecografia",
  biometriaFetale: "Biometria fetale",
  flussimetriaOmbelicale: "Flussimetria ombelicale",
};

const BIOMETRIA_LABELS: Record<string, string> = {
  bpdMm: "BPD (mm)",
  hcMm: "CC (mm)",
  acMm: "CA (mm)",
  flMm: "FL (mm)",
  bpdPercentile: "Percentile BPD",
  hcPercentile: "Percentile CC",
  acPercentile: "Percentile CA",
  flPercentile: "Percentile FL",
  efwPercentile: "Percentile peso fetale",
};

const FLUSSIMETRIA_LABELS: Record<string, string> = {
  pi: "PI",
  ri: "IR",
  edf: "EDF",
  piPercentile: "Percentile PI",
  riPercentile: "Percentile IR",
  psv: "PSV",
  edv: "EDV",
  velocitaMedia: "Velocità media",
};

/** Converte una chiave camelCase in un'etichetta leggibile (fallback). */
function prettifyKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** True se il valore è "vuoto" (assente, stringa vuota, array vuoto). */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Formatta un valore (non oggetto) come stringa leggibile. */
function formatScalar(value: unknown, key?: string): string {
  if (isEmpty(value)) return "(vuoto)";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (key === "tipo" && typeof value === "string") {
    return TIPO_LABELS[value] ?? value;
  }
  if (Array.isArray(value)) {
    return `${value.length} immagine${value.length === 1 ? "" : "i"}`;
  }
  return String(value);
}

/** Confronto "morbido": tratta vuoti equivalenti come uguali. */
function scalarEquals(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    const la = Array.isArray(a) ? a.length : 0;
    const lb = Array.isArray(b) ? b.length : 0;
    if (la !== lb) return false;
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  }
  return a === b;
}

function pushScalarChange(
  changes: VisitFieldChange[],
  field: string,
  label: string,
  oldValue: unknown,
  newValue: unknown,
  key?: string,
): void {
  if (scalarEquals(oldValue, newValue)) return;
  changes.push({
    field,
    label,
    previousValue: formatScalar(oldValue, key),
    newValue: formatScalar(newValue, key),
  });
}

/** Confronta un oggetto annidato (anamnesi, ginecologia, ostetricia) chiave per chiave. */
function diffNested(
  changes: VisitFieldChange[],
  sectionKey: string,
  sectionLabel: string,
  oldObj: Record<string, unknown> | undefined,
  newObj: Record<string, unknown> | undefined,
  labels: Record<string, string>,
  subObjectLabels: Record<string, Record<string, string>> = {},
): void {
  const a = oldObj ?? {};
  const b = newObj ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    const label = `${sectionLabel} · ${labels[key] ?? prettifyKey(key)}`;
    const field = `${sectionKey}.${key}`;
    const oldVal = a[key];
    const newVal = b[key];

    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);

    if (subObjectLabels[key] && (isPlainObject(oldVal) || isPlainObject(newVal))) {
      diffNested(
        changes,
        field,
        `${sectionLabel} · ${labels[key] ?? prettifyKey(key)}`,
        isPlainObject(oldVal) ? oldVal : undefined,
        isPlainObject(newVal) ? newVal : undefined,
        subObjectLabels[key],
      );
      continue;
    }

    pushScalarChange(changes, field, label, oldVal, newVal, key);
  }
}

/**
 * Calcola l'elenco dei campi modificati tra due versioni della visita.
 * Ignora i metadati (id, createdAt, updatedAt, revisions).
 */
export function computeVisitChanges(
  oldVisit: Visit,
  newVisit: Visit,
): VisitFieldChange[] {
  const changes: VisitFieldChange[] = [];

  const oldRecord = oldVisit as unknown as Record<string, unknown>;
  const newRecord = newVisit as unknown as Record<string, unknown>;
  for (const key of Object.keys(TOP_LEVEL_LABELS)) {
    pushScalarChange(
      changes,
      key,
      TOP_LEVEL_LABELS[key],
      oldRecord[key],
      newRecord[key],
      key,
    );
  }

  diffNested(
    changes,
    "anamnesiStrutturata",
    "Anamnesi",
    oldVisit.anamnesiStrutturata as Record<string, unknown> | undefined,
    newVisit.anamnesiStrutturata as Record<string, unknown> | undefined,
    ANAMNESI_LABELS,
  );

  diffNested(
    changes,
    "ginecologia",
    "Ginecologia",
    oldVisit.ginecologia as Record<string, unknown> | undefined,
    newVisit.ginecologia as Record<string, unknown> | undefined,
    GINECOLOGIA_LABELS,
  );

  diffNested(
    changes,
    "ostetricia",
    "Ostetricia",
    oldVisit.ostetricia as Record<string, unknown> | undefined,
    newVisit.ostetricia as Record<string, unknown> | undefined,
    OSTETRICIA_LABELS,
    {
      biometriaFetale: BIOMETRIA_LABELS,
      flussimetriaOmbelicale: FLUSSIMETRIA_LABELS,
    },
  );

  return changes;
}
