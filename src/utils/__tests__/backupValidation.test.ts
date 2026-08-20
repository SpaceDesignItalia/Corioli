import { describe, expect, it } from "vitest";
import { BACKUP_SCHEMA_VERSION, validateBackupData } from "../backupValidation";

const backupValido = {
  schemaVersion: BACKUP_SCHEMA_VERSION,
  patients: [{ id: "p1", nome: "Anna", cognome: "Neri" }],
  visits: [{ id: "v1", patientId: "p1" }],
  documents: [],
  doctor: { id: "d1", nome: "Rossi" },
};

describe("validazione del file di backup", () => {
  it("accetta un backup completo", () => {
    const r = validateBackupData(backupValido);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.counts.patients).toBe(1);
    expect(r.counts.visits).toBe(1);
  });

  it("accetta backup vecchi, senza schemaVersion", () => {
    expect(validateBackupData({ patients: [{ id: "p1" }], visits: [] }).ok).toBe(true);
  });

  it.each([
    ["null", null],
    ["stringa", "testo"],
    ["array", [1, 2, 3]],
    ["oggetto vuoto", {}],
    ["JSON di un'altra applicazione", { users: [], config: {} }],
  ])("rifiuta un file che non è un backup Corioli: %s", (_nome, valore) => {
    const r = validateBackupData(valore);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rifiuta una sezione danneggiata e la nomina nel messaggio", () => {
    const r = validateBackupData({ patients: "rovinato", visits: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("Pazienti");
  });

  it("rifiuta record senza identificativo", () => {
    const r = validateBackupData({ patients: [{ nome: "Anna" }], visits: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("identificativo");
  });

  it("rifiuta voci nulle dentro un elenco", () => {
    expect(validateBackupData({ patients: [null], visits: [] }).ok).toBe(false);
  });

  it("rifiuta un backup di una versione futura dell'app", () => {
    const r = validateBackupData({ schemaVersion: 99, patients: [{ id: "p" }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("recente");
  });

  it("segnala un profilo dottore danneggiato", () => {
    const r = validateBackupData({ ...backupValido, doctor: "non un oggetto" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("dottore");
  });

  it("conta tutte le collezioni per la schermata di conferma", () => {
    const r = validateBackupData({
      ...backupValido,
      templates: [{ id: "t1" }, { id: "t2" }],
      ricettePaziente: [{ id: "r1" }],
      visitRevisions: [{ id: "rev1" }],
    });
    expect(r.ok).toBe(true);
    expect(r.counts.templates).toBe(2);
    expect(r.counts.ricette).toBe(1);
    expect(r.counts.revisions).toBe(1);
  });
});
