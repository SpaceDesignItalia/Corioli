import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecordStore } from "../recordStore.js";

/**
 * Il servizio di archivio del renderer collegato al vero archivio SQLite, come
 * nell'app desktop. L'IPC è simulato con structuredClone, che riproduce la
 * copia dei dati tra renderer e main process.
 */
let store;

const ipc = (fn) => async (...args) => structuredClone(await fn(...args.map((a) => structuredClone(a))));

globalThis.window = { electronAPI: {} };

beforeEach(() => {
  store = createRecordStore(new DatabaseSync(":memory:"));
  window.electronAPI = {
    kvGet: ipc((k) => store.kvGet(k)),
    kvSet: ipc((k, v) => store.kvSet(k, v)),
    kvRemove: ipc((k) => store.kvRemove(k)),
    kvClearAppDottori: ipc(() => store.clearAppData()),
    recordsGetAll: ipc((c, o) => store.getAll(c, { withoutImages: Boolean(o?.withoutImages) })),
    recordsGetById: ipc((c, id) => store.getById(c, id)),
    recordsGetByPatient: ipc((c, p) => store.getByPatient(c, p)),
    recordsCount: ipc((c) => store.count(c)),
    recordsBatch: ipc((ops) => store.batch(ops)),
  };
});

const { storageService } = await import("../../src/services/StorageServiceFallback.ts");

const immagine = "data:image/png;base64," + "B".repeat(1000);
const nuovaPaziente = (cognome, codiceFiscale) => ({
  nome: "Anna", cognome, codiceFiscale, dataNascita: "1985-01-01", luogoNascita: "Pisa", sesso: "F",
});
const nuovaVisita = (patientId, extra = {}) => ({
  patientId, dataVisita: "2026-09-01", descrizioneClinica: "Controllo", anamnesi: "",
  esamiObiettivo: "", conclusioniDiagnostiche: "", terapie: "", tipo: "ginecologica", ...extra,
});

describe("pazienti e visite", () => {
  it("nuova paziente: si ritrova per id e per codice fiscale", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri", "nrinna85a41g702x"));
    expect(await storageService.getPatientById(p.id)).toEqual(p);
    expect((await storageService.getPatientByCF("NRINNA85A41G702X"))?.id).toBe(p.id);
    expect(await storageService.countPatients()).toBe(1);
  });

  it("codice fiscale duplicato rifiutato, in creazione e in modifica", async () => {
    await storageService.addPatient(nuovaPaziente("Neri", "AAA"));
    const b = await storageService.addPatient(nuovaPaziente("Conti", "BBB"));
    await expect(storageService.addPatient(nuovaPaziente("Altra", "aaa"))).rejects.toThrow(/già presente/);
    await expect(storageService.updatePatient(b.id, { codiceFiscale: "AAA" })).rejects.toThrow(/già presente/);
  });

  it("visite per paziente; l'elenco leggero non porta le immagini", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    const altra = await storageService.addPatient(nuovaPaziente("Conti"));
    const v = await storageService.addVisit(
      nuovaVisita(p.id, { ginecologia: { esameBimanuale: "nella norma", ecografiaImmagini: [immagine] } }),
    );
    await storageService.addVisit(nuovaVisita(altra.id));

    expect((await storageService.getVisitsByPatientId(p.id)).map((x) => x.id)).toEqual([v.id]);
    const elenco = await storageService.getVisitsWithoutImages();
    expect(elenco).toHaveLength(2);
    expect(elenco.find((x) => x.id === v.id).ginecologia).toEqual({ esameBimanuale: "nella norma" });
    expect((await storageService.getVisitById(v.id)).ginecologia.ecografiaImmagini).toEqual([immagine]);
    expect(await storageService.countVisits()).toBe(2);
  });

  it("modifica visita: cronologia registrata, immagini conservate", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    const v = await storageService.addVisit(nuovaVisita(p.id, { ginecologia: { ecografiaImmagini: [immagine] } }));
    await storageService.updateVisit(v.id, { descrizioneClinica: "Controllo annuale" });

    const salvata = await storageService.getVisitById(v.id);
    expect(salvata.descrizioneClinica).toBe("Controllo annuale");
    expect(salvata.ginecologia.ecografiaImmagini).toEqual([immagine]);
    const [rev] = await storageService.getVisitRevisions();
    expect(rev.visitId).toBe(v.id);
    expect(rev.patientName).toBe("Neri Anna");
  });

  it("visita inesistente: errore chiaro", async () => {
    await expect(storageService.updateVisit("nessuna", {})).rejects.toThrow(/Visita non trovata/);
  });

  it("eliminare una paziente elimina i suoi dati, non quelli delle altre né la cronologia", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    const altra = await storageService.addPatient(nuovaPaziente("Conti"));
    const v = await storageService.addVisit(nuovaVisita(p.id));
    await storageService.updateVisit(v.id, { descrizioneClinica: "x" });
    await storageService.addVisit(nuovaVisita(altra.id));
    await storageService.addRichiestaEsame({ patientId: p.id, nome: "Emocromo", dataRichiesta: "2026-09-01" });
    await storageService.addCertificato({ patientId: p.id, tipo: "altro", dataCertificato: "2026-09-01", descrizione: "" });
    await storageService.addRicetta({ patientId: p.id, tipo: "bianca", dataRicetta: "2026-09-01", testo: "" });
    await storageService.addDocument({
      patientId: p.id, title: "Referto", fileName: "r.pdf", fileSize: 1, mimeType: "application/pdf",
      category: "altro", uploadDate: "2026-09-01", fileData: "AAA",
    });

    await storageService.deletePatient(p.id);

    expect(await storageService.getPatientById(p.id)).toBeNull();
    expect(await storageService.getVisitsByPatientId(p.id)).toEqual([]);
    expect(await storageService.getRichiesteEsamiByPatientId(p.id)).toEqual([]);
    expect(await storageService.getCertificatiByPatientId(p.id)).toEqual([]);
    expect(await storageService.getRicetteByPatientId(p.id)).toEqual([]);
    expect(await storageService.getDocumentsByPatientId(p.id)).toEqual([]);
    expect(await storageService.getVisitsByPatientId(altra.id)).toHaveLength(1);
    expect(await storageService.getVisitRevisions()).toHaveLength(1);
  });
});

describe("import e reset", () => {
  const backup = {
    schemaVersion: 1,
    patients: [{ id: "y1", nome: "Nuova", cognome: "Paziente", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
    visits: [{ id: "v9", patientId: "y1", dataVisita: "2026-07-07", descrizioneClinica: "Importata" }],
    visitRevisions: [{ id: "r-backup", visitId: "v9", patientId: "y1", modifiedAt: "2026-07-08", changes: [] }],
    documents: [],
    doctor: { id: "d", nome: "Maria", cognome: "Rossi", email: "", createdAt: "", updatedAt: "" },
    templates: [{ id: "t1", category: "ginecologia", section: "prestazione", label: "Mio", text: "testo" }],
  };

  it("sostituzione totale: archivio sostituito, cronologia esistente conservata", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    const v = await storageService.addVisit(nuovaVisita(p.id));
    await storageService.updateVisit(v.id, { descrizioneClinica: "modificata" });

    await storageService.importData(backup, "replace");

    expect((await storageService.getPatients()).map((x) => x.cognome)).toEqual(["Paziente"]);
    expect((await storageService.getVisits()).map((x) => x.id)).toEqual(["v9"]);
    expect((await storageService.getVisitRevisions()).map((r) => r.id).sort()).toEqual(
      ["r-backup", expect.any(String)].sort(),
    );
    expect((await storageService.getDoctor()).cognome).toBe("Rossi");
    expect((await storageService.getTemplates()).some((t) => t.label === "Mio")).toBe(true);
  });

  it("sostituzione totale interrotta: l'archivio resta com'era", async () => {
    await storageService.addPatient(nuovaPaziente("Neri"));
    // JSON.stringify fallisce su un BigInt: la scrittura si rompe a metà transazione.
    const rotto = { ...backup, documents: [{ id: "d1", fileData: 1n }] };
    await expect(storageService.importData(rotto, "replace")).rejects.toThrow();
    expect((await storageService.getPatients()).map((x) => x.cognome)).toEqual(["Neri"]);
  });

  it("unione: si aggiunge solo ciò che manca", async () => {
    await storageService.addPatient(nuovaPaziente("Neri"));
    await storageService.importData(backup, "merge");
    await storageService.importData(backup, "merge");
    expect((await storageService.getPatients()).map((x) => x.cognome)).toEqual(["Neri", "Paziente"]);
    expect(await storageService.countVisits()).toBe(1);
    expect(await storageService.getVisitRevisions()).toHaveLength(1);
  });

  it("export e reimport producono lo stesso archivio", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    await storageService.addVisit(nuovaVisita(p.id, { ginecologia: { ecografiaImmagini: [immagine] } }));
    const esportato = await storageService.exportData();
    await storageService.clearAllData();
    await storageService.importData(esportato, "replace");
    expect(await storageService.getPatients()).toEqual(esportato.patients);
    expect(await storageService.getVisits()).toEqual(esportato.visits);
  });

  it("il reset totale svuota l'archivio ma non la cronologia", async () => {
    const p = await storageService.addPatient(nuovaPaziente("Neri"));
    const v = await storageService.addVisit(nuovaVisita(p.id));
    await storageService.updateVisit(v.id, { descrizioneClinica: "modificata" });
    await storageService.setPreference("preferences", "{}");

    await storageService.clearAllData();

    expect(await storageService.countPatients()).toBe(0);
    expect(await storageService.countVisits()).toBe(0);
    expect(await storageService.getPreference("preferences")).toBeNull();
    expect(await storageService.getVisitRevisions()).toHaveLength(1);
  });
});
