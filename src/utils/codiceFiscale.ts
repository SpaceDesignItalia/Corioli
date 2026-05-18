import { decodeFiscalCode } from "codice-fiscale-ts";

const CF_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;

/** Base URL senza slash finale. Sovrascrivibile con `VITE_CF_DECODE_URL`. */
export const CF_DECODE_API_BASE =
  import.meta.env.VITE_CF_DECODE_URL?.trim() ||
  "https://axerrio.it/api/cf/decode";

const AXERRIO_FETCH_MS = 10_000;

export function isValidCodiceFiscaleFormat(cf: string): boolean {
  return CF_REGEX.test(cf.trim().toUpperCase());
}

/** Data locale (YYYY-MM-DD) dall'oggetto Date del decoder, senza shift UTC. */
function birthDateToIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DecodedCfFields = {
  dataNascita: string;
  luogoNascita: string;
  sesso: "M" | "F";
  /** Da servizio esterno (se disponibile); controllare con la paziente. */
  nomeGuess?: string;
  cognomeGuess?: string;
};

function inferGenderFromCf(cf: string): "M" | "F" {
  const dayCode = Number.parseInt(cf.slice(9, 11), 10);
  if (Number.isFinite(dayCode) && dayCode > 40) return "F";
  return "M";
}

function pickUnknown(
  obj: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const k of keys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  const v = pickUnknown(obj, keys);
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function flattenApiPayload(json: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...json };
  for (const nest of ["data", "result", "cf", "payload"] as const) {
    const inner = json[nest];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      Object.assign(out, inner as Record<string, unknown>);
    }
  }
  return out;
}

function parseSesso(v: unknown): "M" | "F" | undefined {
  if (typeof v !== "string") return undefined;
  const u = v.trim().toUpperCase();
  if (u === "M" || u === "MASCHIO" || u === "MALE" || u === "UOMO") return "M";
  if (u === "F" || u === "FEMMINA" || u === "FEMALE" || u === "DONNA") return "F";
  if (u === "1") return "M";
  if (u === "2") return "F";
  return undefined;
}

function parseDateToIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return birthDateToIsoLocal(d);
  }
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dm = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dm) {
    const d = dm[1].padStart(2, "0");
    const m = dm[2].padStart(2, "0");
    const y = dm[3];
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function mapAxerrioJson(
  json: Record<string, unknown>,
): Partial<
  Pick<DecodedCfFields, "dataNascita" | "luogoNascita" | "sesso"> & {
    nomeGuess?: string;
    cognomeGuess?: string;
  }
> {
  const j = flattenApiPayload(json);
  if (j.valid === false || j.success === false || j.error === true) {
    return {};
  }

  const dataNascita = parseDateToIso(
    pickUnknown(j, [
      "dataNascita",
      "data_nascita",
      "birthDate",
      "birth_date",
      "nascita",
      "birthday",
      "data",
      "date",
    ]),
  );

  const sesso = parseSesso(
    pickUnknown(j, ["sesso", "gender", "sex", "genere"]),
  );

  const luogo =
    pickString(j, [
      "luogoNascita",
      "luogo_nascita",
      "comuneNascita",
      "comune_nascita",
      "comune",
      "birthPlace",
      "birth_place",
      "citta",
      "città",
      "municipio",
      "luogo",
    ]) || undefined;

  const nomeGuess = pickString(j, ["nome", "name", "firstName", "first_name"]);
  const cognomeGuess = pickString(j, [
    "cognome",
    "lastName",
    "last_name",
    "surname",
  ]);

  return {
    ...(dataNascita ? { dataNascita } : {}),
    ...(sesso ? { sesso } : {}),
    ...(luogo ? { luogoNascita: luogo } : {}),
    ...(nomeGuess ? { nomeGuess } : {}),
    ...(cognomeGuess ? { cognomeGuess } : {}),
  };
}

/**
 * Prova la decodifica remota (es. Axerrio). In caso di errore di rete, CORS o
 * risposta non JSON, restituisce null e si usa il decoder locale.
 */
async function decodeCfViaRemoteApi(
  normalizedCf: string,
): Promise<Partial<
  Pick<DecodedCfFields, "dataNascita" | "luogoNascita" | "sesso"> & {
    nomeGuess?: string;
    cognomeGuess?: string;
  }
> | null> {
  if (import.meta.env.VITE_CF_DECODE_REMOTE === "0") {
    return null;
  }

  const url = `${CF_DECODE_API_BASE.replace(/\/$/, "")}/${encodeURIComponent(normalizedCf)}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), AXERRIO_FETCH_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      credentials: "omit",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return mapAxerrioJson(json);
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function decodeCfLocalFields(normalized: string): Promise<DecodedCfFields> {
  const data = await decodeFiscalCode(normalized);
  if (!data.birthDate) {
    throw new Error("Impossibile ricavare la data di nascita dal codice fiscale");
  }
  const luogo = (data.birthPlace || "").trim();
  const sesso: "M" | "F" =
    data.gender === "M" || data.gender === "F"
      ? data.gender
      : inferGenderFromCf(normalized);
  return {
    dataNascita: birthDateToIsoLocal(data.birthDate),
    luogoNascita: luogo || "Non specificato",
    sesso,
  };
}

function mergeDecoded(
  api: Partial<
    Pick<DecodedCfFields, "dataNascita" | "luogoNascita" | "sesso"> & {
      nomeGuess?: string;
      cognomeGuess?: string;
    }
  >,
  local: DecodedCfFields,
): DecodedCfFields {
  const dataNascita =
    (api.dataNascita && api.dataNascita.trim()) || local.dataNascita;
  const luogoNascita =
    (api.luogoNascita && api.luogoNascita.trim()) || local.luogoNascita;
  const sesso = api.sesso || local.sesso;
  return {
    dataNascita,
    luogoNascita,
    sesso,
    ...(api.nomeGuess ? { nomeGuess: api.nomeGuess } : {}),
    ...(api.cognomeGuess ? { cognomeGuess: api.cognomeGuess } : {}),
  };
}

/**
 * Decodifica CF: prima tentativo API remota (più campi se disponibili), poi
 * integrazione con libreria locale per campi mancanti o se la rete fallisce.
 */
export async function decodeCfToPatientFields(
  cf: string,
): Promise<DecodedCfFields> {
  const normalized = cf.trim().toUpperCase();
  const fromApi = await decodeCfViaRemoteApi(normalized);
  const local = await decodeCfLocalFields(normalized);
  if (!fromApi || Object.keys(fromApi).length === 0) {
    return local;
  }
  return mergeDecoded(fromApi, local);
}
