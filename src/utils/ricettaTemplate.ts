import { RicettaFarmaco } from "../types/Storage";

/**
 * Serializzazione dei farmaci di un modello ricetta dentro il campo `text` del
 * MedicalTemplate. Formato per riga, leggibile e retrocompatibile:
 *
 *   Nome farmaco: posologia | durata
 *
 * - `: posologia` è omesso se la posologia è vuota;
 * - ` | durata` è omesso se la durata è vuota.
 *
 * I vecchi modelli scritti come "Nome: posologia" (senza durata) restano validi.
 */
const DURATA_SEP = " | ";

/** Intestazioni di sezione o righe-note dei vecchi modelli liberi da ignorare. */
const RICETTA_SKIP_LINE_RE =
  /^(per\s+os|vaginale|orale|tos(\s*\([^)]*\))?):?$|^(bere|terapia|astensione|si\s+(consiglia|raccomanda))/i;

/**
 * Converte il vecchio formato strutturato (farmaci + note) in testo libero
 * leggibile, usato per migrare in lettura le ricette/modelli salvati prima del
 * passaggio al campo unico `testo`.
 *
 *   Nome: posologia (durata)
 *   …
 *
 *   note
 */
export function farmaciToTesto(
  farmaci?: RicettaFarmaco[] | null,
  note?: string | null,
): string {
  const righe = (farmaci || [])
    .filter((f) => (f.nome ?? "").trim())
    .map((f) => {
      const nome = (f.nome ?? "").trim();
      const posologia = (f.posologia ?? "").trim();
      const durata = (f.durata ?? "").trim();
      let line = posologia ? `${nome}: ${posologia}` : nome;
      if (durata) line += ` (${durata})`;
      return line;
    });
  let out = righe.join("\n");
  const n = (note ?? "").trim();
  if (n) out += (out ? "\n\n" : "") + n;
  return out;
}

/**
 * Testo libero effettivo di una ricetta: usa il campo `testo` se presente,
 * altrimenti lo deriva dal vecchio formato `farmaci` + `note`.
 */
export function getRicettaTesto(ricetta: {
  testo?: string;
  farmaci?: RicettaFarmaco[];
  note?: string;
}): string {
  const t = (ricetta.testo ?? "").trim();
  if (t) return t;
  return farmaciToTesto(ricetta.farmaci, ricetta.note);
}

export function serializeRicettaFarmaci(farmaci: RicettaFarmaco[]): string {
  return (farmaci || [])
    .filter((f) => (f.nome ?? "").trim())
    .map((f) => {
      const nome = (f.nome ?? "").trim();
      const posologia = (f.posologia ?? "").trim();
      const durata = (f.durata ?? "").trim();
      let line = posologia ? `${nome}: ${posologia}` : nome;
      if (durata) line += `${DURATA_SEP}${durata}`;
      return line;
    })
    .join("\n");
}

export function parseRicettaFarmaci(text: string): RicettaFarmaco[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !RICETTA_SKIP_LINE_RE.test(line),
    )
    .map((line) => {
      let cleaned = line.replace(/^[-•*]\s*/, "");
      let durata = "";
      const sepIdx = cleaned.lastIndexOf(DURATA_SEP);
      if (sepIdx >= 0) {
        durata = cleaned.slice(sepIdx + DURATA_SEP.length).trim();
        cleaned = cleaned.slice(0, sepIdx).trim();
      }
      const colonIdx = cleaned.indexOf(":");
      if (colonIdx > 0) {
        return {
          nome: cleaned.slice(0, colonIdx).trim(),
          posologia: cleaned.slice(colonIdx + 1).trim(),
          durata,
        };
      }
      return { nome: cleaned, posologia: "", durata };
    })
    .filter((f) => f.nome.length > 0);
}
