import type { AppData } from "../types/Storage";

/**
 * Validazione del file di backup **prima** di toccare i dati esistenti.
 *
 * L'import in modalità "sostituzione totale" cancella l'archivio prima di
 * riscriverlo: se il file è troncato o non è un backup Corioli, il controllo
 * deve fallire qui, non a metà operazione.
 */

/** Versione dello schema scritta nei backup generati da questa versione dell'app. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupValidationResult {
  ok: boolean;
  /** Messaggi leggibili da mostrare al medico. */
  errors: string[];
  /** Conteggi per la schermata di conferma. */
  counts: {
    patients: number;
    visits: number;
    documents: number;
    templates: number;
    richiesteEsami: number;
    certificati: number;
    ricette: number;
    revisions: number;
  };
}

const ARRAY_FIELDS: ReadonlyArray<{ key: keyof AppData; label: string }> = [
  { key: "patients", label: "Pazienti" },
  { key: "visits", label: "Visite" },
  { key: "documents", label: "Documenti" },
  { key: "templates", label: "Modelli" },
  { key: "richiesteEsami", label: "Richieste esami" },
  { key: "certificatiPaziente", label: "Certificati" },
  { key: "ricettePaziente", label: "Ricette" },
  { key: "visitRevisions", label: "Cronologia modifiche" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasId(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0;
}

function countOf(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Controlla che l'oggetto sia un backup Corioli utilizzabile.
 * Non modifica nulla: restituisce l'elenco dei problemi trovati.
 */
export function validateBackupData(parsed: unknown): BackupValidationResult {
  const errors: string[] = [];
  const empty = {
    patients: 0,
    visits: 0,
    documents: 0,
    templates: 0,
    richiesteEsami: 0,
    certificati: 0,
    ricette: 0,
    revisions: 0,
  };

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: ["Il file non contiene un backup Corioli (formato non valido)."],
      counts: empty,
    };
  }

  // Ogni collezione presente deve essere un array di record con id.
  for (const { key, label } of ARRAY_FIELDS) {
    const value = parsed[key as string];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) {
      errors.push(`La sezione "${label}" è danneggiata (non è un elenco).`);
      continue;
    }
    const invalid = value.filter((item) => !hasId(item)).length;
    if (invalid > 0) {
      errors.push(
        `La sezione "${label}" contiene ${invalid} voci senza identificativo valido.`,
      );
    }
  }

  if (parsed.doctor !== undefined && parsed.doctor !== null && !isRecord(parsed.doctor)) {
    errors.push('La sezione "Profilo dottore" è danneggiata.');
  }

  const counts = {
    patients: countOf(parsed, "patients"),
    visits: countOf(parsed, "visits"),
    documents: countOf(parsed, "documents"),
    templates: countOf(parsed, "templates"),
    richiesteEsami: countOf(parsed, "richiesteEsami"),
    certificati: countOf(parsed, "certificatiPaziente"),
    ricette: countOf(parsed, "ricettePaziente"),
    revisions: countOf(parsed, "visitRevisions"),
  };

  const hasAnyData =
    Array.isArray(parsed.patients) ||
    Array.isArray(parsed.visits) ||
    Array.isArray(parsed.documents);
  if (!hasAnyData) {
    errors.push(
      "Il file non contiene né pazienti, né visite, né documenti: non sembra un backup Corioli.",
    );
  }

  // Un backup prodotto da una versione futura potrebbe avere campi non gestiti.
  const version = parsed.schemaVersion;
  if (typeof version === "number" && version > BACKUP_SCHEMA_VERSION) {
    errors.push(
      `Il backup proviene da una versione più recente di Corioli (schema ${version}). Aggiorna l'app prima di importarlo.`,
    );
  }

  return { ok: errors.length === 0, errors, counts };
}
