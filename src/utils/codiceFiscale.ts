import { decodeFiscalCode } from "codice-fiscale-ts";

const CF_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;

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
};

function inferGenderFromCf(cf: string): "M" | "F" {
  const dayCode = Number.parseInt(cf.slice(9, 11), 10);
  if (Number.isFinite(dayCode) && dayCode > 40) return "F";
  return "M";
}

export async function decodeCfToPatientFields(
  cf: string,
): Promise<DecodedCfFields> {
  const normalized = cf.trim().toUpperCase();
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
