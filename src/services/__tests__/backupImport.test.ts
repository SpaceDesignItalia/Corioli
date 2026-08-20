import { beforeEach, describe, expect, it } from "vitest";

/**
 * Test dell'import di backup: la modalità "sostituzione totale" cancella
 * l'archivio prima di riscriverlo, quindi il comportamento in caso di errore
 * è la cosa più importante da verificare.
 *
 * L'app fuori da Electron usa localStorage: qui viene sostituito con una mappa.
 */
const store = new Map<string, string>();
/** Se valorizzata, la scrittura su questa chiave fallisce (simula spazio esaurito). */
let chiaveCheFallisce: string | null = null;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (chiaveCheFallisce && k === chiaveCheFallisce) {
        throw new Error("QuotaExceededError: spazio esaurito");
      }
      store.set(k, String(v));
    },
    removeItem: (k: string) => void store.delete(k),
  },
});
// Nessun electronAPI: niente backup su file durante i test
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

const { BackupService, PatientService, VisitService } = await import("../OfflineServices");

const fileDi = (contenuto: unknown) =>
  new File([JSON.stringify(contenuto)], "backup.json", { type: "application/json" });

async function archivioCorrente() {
  const patients = await PatientService.getAllPatients();
  const visits = await VisitService.getAllVisits();
  return { cognomi: patients.map((p) => p.cognome).sort(), visite: visits.length };
}

beforeEach(async () => {
  store.clear();
  chiaveCheFallisce = null;
  await PatientService.addPatient({
    nome: "Anna", cognome: "Neri", dataNascita: "1985-12-10", luogoNascita: "Milano", sesso: "F",
  });
  await PatientService.addPatient({
    nome: "Sara", cognome: "Conti", dataNascita: "1979-04-02", luogoNascita: "Pisa", sesso: "F",
  });
  const anna = (await PatientService.getAllPatients())[0];
  await VisitService.addVisit({
    patientId: anna.id, dataVisita: "2026-08-01", descrizioneClinica: "Controllo",
    anamnesi: "", esamiObiettivo: "", conclusioniDiagnostiche: "", terapie: "",
  });
});

describe("import di un file non valido", () => {
  it.each([
    ["JSON illeggibile", new File(["{ non-json"], "backup.json")],
    ["JSON di un'altra applicazione", fileDi({ users: [], settings: {} })],
    ["sezione danneggiata", fileDi({ patients: "rovinato", visits: [] })],
    ["record senza identificativo", fileDi({ patients: [{ nome: "X" }], visits: [] })],
    ["schema di una versione futura", fileDi({ schemaVersion: 99, patients: [{ id: "p" }] })],
  ])("%s: errore chiaro e archivio intatto", async (_nome, file) => {
    const prima = await archivioCorrente();
    await expect(BackupService.importData(file, "replace")).rejects.toThrow();
    expect(await archivioCorrente()).toEqual(prima);
  });

  it("il messaggio di errore spiega il problema", async () => {
    await expect(
      BackupService.importData(fileDi({ patients: "rovinato", visits: [] }), "replace"),
    ).rejects.toThrow(/Pazienti/);
  });
});

describe("import interrotto a metà", () => {
  /**
   * Il file è valido e l'import parte: pazienti e visite vengono già sostituiti,
   * poi la scrittura dei documenti fallisce (spazio esaurito). Senza rollback
   * l'archivio resterebbe con i dati del backup solo a metà.
   */
  const backupValido = {
    schemaVersion: 1,
    patients: [{ id: "x1", nome: "Import", cognome: "Fallito", dataNascita: "2000-01-01", luogoNascita: "Roma", sesso: "F", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
    visits: [{ id: "xv1", patientId: "x1", dataVisita: "2026-02-02", descrizioneClinica: "", anamnesi: "", esamiObiettivo: "", conclusioniDiagnostiche: "", terapie: "" }],
    documents: [{ id: "d1", title: "Referto", fileName: "r.pdf", fileSize: 10, mimeType: "application/pdf", category: "altro", uploadDate: "2026-01-01", fileData: "AAA", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  };

  it("propaga l'errore e ripristina i dati precedenti", async () => {
    const prima = await archivioCorrente();
    chiaveCheFallisce = "AppDottori_documents";

    await expect(BackupService.importData(fileDi(backupValido), "replace")).rejects.toThrow(
      /spazio esaurito/,
    );

    chiaveCheFallisce = null;
    const dopo = await archivioCorrente();
    expect(dopo).toEqual(prima);
    expect(dopo.cognomi).not.toContain("Fallito");
  });

  it("senza il guasto lo stesso backup viene importato", async () => {
    await BackupService.importData(fileDi(backupValido), "replace");
    const dopo = await archivioCorrente();
    expect(dopo.cognomi).toEqual(["Fallito"]);
    expect(dopo.visite).toBe(1);
  });
});

describe("import valido", () => {
  it("sostituisce l'archivio con il contenuto del backup", async () => {
    const backup = {
      schemaVersion: 1,
      patients: [{ id: "y1", nome: "Nuova", cognome: "Paziente", dataNascita: "1990-05-05", luogoNascita: "Bari", sesso: "F", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
      visits: [{ id: "v9", patientId: "y1", dataVisita: "2026-07-07", descrizioneClinica: "Visita importata", anamnesi: "", esamiObiettivo: "", conclusioniDiagnostiche: "", terapie: "" }],
      documents: [],
    };
    await BackupService.importData(fileDi(backup), "replace");
    expect(await archivioCorrente()).toEqual({ cognomi: ["Paziente"], visite: 1 });
  });

  it("in modalità unione i pazienti già presenti restano", async () => {
    const backup = {
      schemaVersion: 1,
      patients: [{ id: "z1", nome: "Terza", cognome: "Aggiunta", dataNascita: "1995-03-03", luogoNascita: "Roma", sesso: "F", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
      visits: [],
      documents: [],
    };
    await BackupService.importData(fileDi(backup), "merge");
    const dopo = await archivioCorrente();
    expect(dopo.cognomi).toContain("Neri");
    expect(dopo.cognomi).toContain("Conti");
    expect(dopo.cognomi).toContain("Aggiunta");
  });
});

describe("export", () => {
  it("dichiara la versione dello schema e la data", async () => {
    const blob = await BackupService.exportData();
    const dati = JSON.parse(await blob.text());
    expect(dati.schemaVersion).toBe(1);
    expect(typeof dati.exportedAt).toBe("string");
  });

  it("il file esportato supera la propria validazione", async () => {
    const { validateBackupData } = await import("../../utils/backupValidation");
    const blob = await BackupService.exportData();
    expect(validateBackupData(JSON.parse(await blob.text())).ok).toBe(true);
  });
});
