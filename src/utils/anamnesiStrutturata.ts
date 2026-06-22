import { AnamnesiStrutturata, MedicalTemplate } from "../types/Storage";

/** Chiavi delle sezioni dell'anamnesi strutturata (set predefinito). */
export type AnamnesiCampoKey =
  | "familiare"
  | "fisiologica"
  | "patologica"
  | "ginecologica"
  | "farmacologica"
  | "allergica"
  | "partner";

/** Tipi di visita che hanno una configurazione di anamnesi indipendente. */
export type AnamnesiVisitType =
  | "ginecologica"
  | "ginecologica_pediatrica"
  | "ostetrica";

/** `singola` = un unico campo libero; `strutturata` = suddivisione in sezioni. */
export type AnamnesiMode = "singola" | "strutturata";

/** Configurazione dell'anamnesi per un singolo tipo di visita. */
export interface AnamnesiTypeConfig {
  mode: AnamnesiMode;
  /**
   * Sezioni attive, nell'ordine scelto (rilevante solo in modalità `strutturata`).
   * Ogni voce è una chiave predefinita ([[AnamnesiCampoKey]]) o una chiave di
   * sezione personalizzata generata (es. "custom_xxx").
   */
  campi: string[];
  /**
   * Etichette personalizzate per sezione (sovrascrivono il nome predefinito).
   * Per le sezioni personalizzate è il nome stesso della sezione.
   * Chiave assente o stringa vuota ⇒ si usa l'etichetta di default.
   */
  etichette?: Record<string, string>;
}

/** Configurazione completa per medico: una voce per ciascun tipo di visita. */
export type AnamnesiConfig = Record<AnamnesiVisitType, AnamnesiTypeConfig>;

type AnamnesiCampoMeta = {
  /** Chiave predefinita ([[AnamnesiCampoKey]]) o chiave custom generata. */
  key: string;
  label: string;
  placeholder: string;
  minRows: number;
  /** Campo facoltativo (mostra suffisso "facoltativa"). */
  optional?: boolean;
  /** Sezione del modello (MedicalTemplate.section) collegata a questo sotto-campo. */
  templateSection: MedicalTemplate["section"];
};

/**
 * Metadati ordinati delle sezioni: etichette, placeholder, righe minime e
 * sezione modello collegata. L'ordine qui definito è l'ordine "naturale"
 * usato come default e come fallback (es. nel PDF).
 */
export const ANAMNESI_STRUTTURATA_FIELDS: AnamnesiCampoMeta[] = [
  {
    key: "familiare",
    label: "Familiare",
    placeholder: "Es. madre con melanoma, padre cardiopatico...",
    minRows: 2,
    templateSection: "anamnesiFamiliare",
  },
  {
    key: "fisiologica",
    label: "Fisiologica",
    placeholder: "Cicli, alvo, diuresi, fumo, PAP test, contraccezione...",
    minRows: 3,
    templateSection: "anamnesiFisiologica",
  },
  {
    key: "patologica",
    label: "Patologica",
    placeholder: "Es. PCOS, pregressi interventi...",
    minRows: 2,
    templateSection: "anamnesiPatologica",
  },
  {
    key: "ginecologica",
    label: "Ginecologica",
    placeholder: "Menarca, caratteristiche del ciclo, PAP test, screening...",
    minRows: 3,
    templateSection: "anamnesiGinecologica",
  },
  {
    key: "farmacologica",
    label: "Farmacologica",
    placeholder: "Terapie in atto, integratori...",
    minRows: 2,
    templateSection: "anamnesiFarmacologica",
  },
  {
    key: "allergica",
    label: "Allergica",
    placeholder: "Es. nega allergie note...",
    minRows: 2,
    templateSection: "anamnesiAllergica",
  },
  {
    key: "partner",
    label: "Partner",
    placeholder: "Anamnesi del partner...",
    minRows: 2,
    templateSection: "anamnesiPartner",
  },
];

/** Tutte le chiavi di sezione nell'ordine naturale. */
export const ALL_ANAMNESI_CAMPO_KEYS: AnamnesiCampoKey[] =
  ANAMNESI_STRUTTURATA_FIELDS.map((f) => f.key as AnamnesiCampoKey);

/** Numero massimo di sezioni attive per tipo di visita (predefinite + personalizzate). */
export const MAX_ANAMNESI_SEZIONI = 10;

/** Prefisso delle chiavi delle sezioni personalizzate. */
const CUSTOM_KEY_PREFIX = "custom_";

/** True se la chiave è una sezione personalizzata (non predefinita). */
export function isCustomAnamnesiKey(key: string): boolean {
  return !ALL_ANAMNESI_CAMPO_KEYS.includes(key as AnamnesiCampoKey);
}

/** Genera una chiave univoca per una nuova sezione personalizzata. */
export function genAnamnesiCustomKey(): string {
  return `${CUSTOM_KEY_PREFIX}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const ANAMNESI_VISIT_TYPES: AnamnesiVisitType[] = [
  "ginecologica",
  "ginecologica_pediatrica",
  "ostetrica",
];

export const ANAMNESI_VISIT_TYPE_LABELS: Record<AnamnesiVisitType, string> = {
  ginecologica: "Visita Ginecologica",
  ginecologica_pediatrica: "Visita Ginecologica Pediatrica",
  ostetrica: "Visita Ostetrica",
};

/** Sezioni attive di default per ciascun tipo di visita: le 3 principali. */
const DEFAULT_CAMPI_BY_TYPE: Record<AnamnesiVisitType, AnamnesiCampoKey[]> = {
  ginecologica: ["familiare", "fisiologica", "patologica"],
  ginecologica_pediatrica: ["familiare", "fisiologica", "patologica"],
  ostetrica: ["familiare", "fisiologica", "patologica"],
};

/** Metadati di una sezione dalla chiave (predefinita o personalizzata). */
export function getAnamnesiCampoMeta(
  key: string,
): AnamnesiCampoMeta | undefined {
  const predef = ANAMNESI_STRUTTURATA_FIELDS.find((f) => f.key === key);
  if (predef) return predef;
  if (!key) return undefined;
  // Sezione personalizzata: metadati sintetici (etichetta risolta a parte).
  return {
    key,
    label: "Sezione",
    placeholder: "",
    minRows: 3,
    templateSection: key,
  };
}

/** Lunghezza massima di un'etichetta personalizzata. */
export const MAX_ANAMNESI_ETICHETTA_LEN = 40;

/** Normalizza un'etichetta personalizzata: niente a capo, lunghezza limitata. */
export function sanitizeAnamnesiEtichetta(value: string): string {
  return (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, MAX_ANAMNESI_ETICHETTA_LEN);
}

/**
 * Etichetta effettiva di una sezione: usa quella personalizzata (trim) se
 * presente, altrimenti il nome predefinito; fallback finale alla chiave.
 */
export function resolveAnamnesiLabel(
  key: string,
  etichette?: Record<string, string> | null,
): string {
  const custom = etichette?.[key]?.trim();
  if (custom) return custom;
  const predef = ANAMNESI_STRUTTURATA_FIELDS.find((f) => f.key === key);
  return predef?.label || "Sezione";
}

/** Etichette personalizzate configurate per un tipo di visita (vuoto se nessuna). */
export function getAnamnesiEtichette(
  config: AnamnesiConfig,
  visitType: string | undefined,
): Record<string, string> {
  return typeConfig(config, visitType).etichette ?? {};
}

/** Etichette di default (nomi reali) per le sezioni date — così nel config non
 *  compaiono come placeholder ma come testo già scritto. */
function defaultEtichette(campi: AnamnesiCampoKey[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of campi) {
    const meta = ANAMNESI_STRUTTURATA_FIELDS.find((f) => f.key === k);
    if (meta) out[k] = meta.label;
  }
  return out;
}

/** Configurazione di default: 3 sezioni principali, nomi reali pre-compilati.
 *  Modalità di default: "singola" (campo unico). */
export function createDefaultAnamnesiConfig(
  mode: AnamnesiMode = "singola",
): AnamnesiConfig {
  const build = (campi: AnamnesiCampoKey[]): AnamnesiTypeConfig => ({
    mode,
    campi: [...campi],
    etichette: defaultEtichette(campi),
  });
  return {
    ginecologica: build(DEFAULT_CAMPI_BY_TYPE.ginecologica),
    ginecologica_pediatrica: build(DEFAULT_CAMPI_BY_TYPE.ginecologica_pediatrica),
    ostetrica: build(DEFAULT_CAMPI_BY_TYPE.ostetrica),
  };
}

/** Estrae/sanifica le etichette personalizzate; scarta chiavi/valori non validi. */
function parseEtichette(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    // Accetta sia le chiavi predefinite sia quelle personalizzate (non vuote).
    if (!k || typeof v !== "string") continue;
    const label = sanitizeAnamnesiEtichetta(v).trim();
    if (label) out[k] = label;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Legge/normalizza la configurazione dalle preferenze. Default: campo unico
 * ("singola"); solo chi aveva esplicitamente attivato la vecchia preferenza
 * booleana `anamnesiStrutturataEnabled === true` mantiene "strutturata".
 * Garantisce sempre una voce valida per ciascun tipo di visita.
 */
export function parseAnamnesiConfig(
  prefs?: Record<string, unknown> | null,
): AnamnesiConfig {
  const legacyEnabled = prefs?.anamnesiStrutturataEnabled === true;
  const base = createDefaultAnamnesiConfig(
    legacyEnabled ? "strutturata" : "singola",
  );
  const raw = prefs?.anamnesiConfig as
    | Partial<Record<AnamnesiVisitType, Partial<AnamnesiTypeConfig>>>
    | undefined;
  if (!raw || typeof raw !== "object") return base;

  const out = {} as AnamnesiConfig;
  for (const t of ANAMNESI_VISIT_TYPES) {
    const r = raw[t];
    const mode: AnamnesiMode =
      r?.mode === "singola" || r?.mode === "strutturata"
        ? r.mode
        : base[t].mode;
    // Accetta chiavi predefinite e personalizzate; dedup + tetto a MAX_ANAMNESI_SEZIONI.
    const rawCampi = Array.isArray(r?.campi)
      ? r!.campi!.filter(
          (k): k is string => typeof k === "string" && k.trim().length > 0,
        )
      : base[t].campi;
    const campi = Array.from(new Set(rawCampi)).slice(0, MAX_ANAMNESI_SEZIONI);
    const etichette = parseEtichette(r?.etichette);
    out[t] = {
      mode,
      campi: campi.length ? campi : base[t].campi,
      ...(etichette ? { etichette } : {}),
    };
  }
  return out;
}

function typeConfig(
  config: AnamnesiConfig,
  visitType: string | undefined,
): AnamnesiTypeConfig {
  const t = (visitType ?? "") as AnamnesiVisitType;
  return config[t] ?? { mode: "singola", campi: [] };
}

/** Modalità effettiva per un tipo di visita. */
export function getAnamnesiMode(
  config: AnamnesiConfig,
  visitType: string | undefined,
): AnamnesiMode {
  return typeConfig(config, visitType).mode;
}

/**
 * Metadati delle sezioni attive (ordinate) per un tipo di visita, con le
 * etichette personalizzate già applicate al campo `label`.
 */
export function getCampiAttivi(
  config: AnamnesiConfig,
  visitType: string | undefined,
): AnamnesiCampoMeta[] {
  const tc = typeConfig(config, visitType);
  return tc.campi
    .map(getAnamnesiCampoMeta)
    .filter((m): m is AnamnesiCampoMeta => Boolean(m))
    .map((m) => ({ ...m, label: resolveAnamnesiLabel(m.key, tc.etichette) }));
}

/**
 * Restituisce i soli valori delle sezioni attive per il tipo di visita,
 * scartando i dati di sezioni non attive (così non finiscono nel salvataggio).
 */
export function pickCampiAttivi(
  data: AnamnesiStrutturata | null | undefined,
  config: AnamnesiConfig,
  visitType: string | undefined,
): AnamnesiStrutturata {
  const keys = typeConfig(config, visitType).campi;
  const out: AnamnesiStrutturata = {};
  for (const k of keys) {
    const v = data?.[k];
    if (v != null) out[k] = v;
  }
  return out;
}

/** Oggetto vuoto con tutte le chiavi inizializzate a stringa vuota (stato del form). */
export function createEmptyAnamnesiStrutturata(): AnamnesiStrutturata {
  return {
    familiare: "",
    fisiologica: "",
    patologica: "",
    ginecologica: "",
    farmacologica: "",
    allergica: "",
    partner: "",
  };
}

/** True se almeno un campo dell'anamnesi strutturata è valorizzato (incl. sezioni custom). */
export function hasAnamnesiStrutturataContent(
  as?: AnamnesiStrutturata | null,
): boolean {
  if (!as) return false;
  return Object.values(as).some(
    (v) => typeof v === "string" && v.trim() !== "",
  );
}

/**
 * Restituisce solo i campi valorizzati (trim applicato), oppure `undefined`
 * se l'anamnesi è interamente vuota — così non si salvano oggetti inutili nel DB.
 */
export function cleanAnamnesiStrutturata(
  as?: AnamnesiStrutturata | null,
): AnamnesiStrutturata | undefined {
  if (!hasAnamnesiStrutturataContent(as)) return undefined;
  const out: AnamnesiStrutturata = {};
  for (const [key, raw] of Object.entries(as!)) {
    const val = (raw ?? "").trim();
    if (val) out[key] = val;
  }
  return out;
}

/**
 * Versione testuale a righe ("Familiare: ...\nPatologica: ...") usata nelle
 * anteprime in sola lettura e nella concatenazione multi → campo unico.
 * `order` (facoltativo) impone un ordine personalizzato; le sezioni con dato
 * non incluse nell'ordine vengono comunque aggiunte in coda (no perdita dati).
 */
export function formatAnamnesiStrutturataText(
  as?: AnamnesiStrutturata | null,
  order?: string[],
  etichette?: Record<string, string> | null,
): string {
  if (!as) return "";
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const k of order ?? []) {
    if (k && !seen.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  for (const k of ALL_ANAMNESI_CAMPO_KEYS) {
    if (!seen.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  // Sezioni personalizzate con dato ma non incluse nell'ordine: in coda (no perdita dati).
  for (const k of Object.keys(as)) {
    if (!seen.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  return ordered
    .map((key) => {
      const val = (as[key] ?? "").trim();
      return val ? `${resolveAnamnesiLabel(key, etichette)}: ${val}` : null;
    })
    .filter(Boolean)
    .join("\n");
}
