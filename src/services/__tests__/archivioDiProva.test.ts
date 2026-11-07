import { beforeEach, describe, expect, it } from "vitest";

/**
 * L'archivio di prova della guida di primo avvio: pazienti inventate che
 * esistono solo finche' la guida e' aperta. La cosa da verificare e' che
 * l'archivio vero non veda mai niente di loro, e che quello che il medico
 * sistema durante la guida (preferenze, modelli) resti.
 *
 * Fuori da Electron l'app usa localStorage: qui e' una mappa.
 */
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

const {
  apriArchivioDiProva,
  chiudiArchivioDiProva,
  archivioDiProvaAperto,
  conteggiArchivioReale,
  storageService,
} = await import("../StorageServiceFallback");
const { PatientService, VisitService, PreferenceService, TemplateService } = await import(
  "../OfflineServices"
);
const { creaArchivioDiProva, PAZIENTE_DELLA_PROVA } = await import(
  "../../components/guida/archivioDiProva"
);
const { computeActivePregnancies } = await import("../../utils/activePregnancyUtils");
const { getFetalGrowthDataPointsFromVisits } = await import("../../utils/fetalGrowthChartUtils");
const { isValidCodiceFiscale } = await import("../../utils/codiceFiscale");
const { chiaveBozzaVisita, leggiBozzaVisita, scriviBozzaVisita } = await import(
  "../../utils/bozzaVisita"
);

const OGGI = new Date(2026, 8, 28, 10, 0);

const visitaVuota = (patientId: string) => ({
  patientId,
  dataVisita: "2026-09-28",
  descrizioneClinica: "",
  anamnesi: "",
  esamiObiettivo: "",
  conclusioniDiagnostiche: "",
  terapie: "",
});

/** Le chiavi cliniche dell'archivio vero, come stanno sul disco. */
const archivioVeroGrezzo = () =>
  [...store.entries()].filter(([k]) => /patients|visits|ricette|richieste|bozza/.test(k));

beforeEach(async () => {
  chiudiArchivioDiProva();
  store.clear();
  await PatientService.addPatient({
    nome: "Anna", cognome: "Neri", dataNascita: "1985-12-10", luogoNascita: "Milano", sesso: "F",
  });
});

describe("archivio di prova", () => {
  it("mostra le pazienti inventate al posto di quelle vere, e alla chiusura le toglie", async () => {
    apriArchivioDiProva(creaArchivioDiProva(OGGI));
    expect(archivioDiProvaAperto()).toBe(true);
    const cognomi = (await PatientService.getAllPatients()).map((p) => p.cognome);
    expect(cognomi).toContain("Ferraro");
    expect(cognomi).not.toContain("Neri");

    chiudiArchivioDiProva();
    expect((await PatientService.getAllPatients()).map((p) => p.cognome)).toEqual(["Neri"]);
  });

  it("non scrive niente nell'archivio vero: visite, ricette, bozze restano in memoria", async () => {
    const prima = JSON.stringify(archivioVeroGrezzo());
    apriArchivioDiProva(creaArchivioDiProva(OGGI));

    const visita = await VisitService.addVisit(visitaVuota(PAZIENTE_DELLA_PROVA.id));
    await VisitService.updateVisit(visita.id, { esamiObiettivo: "Nella norma" });
    const nuovo = await PatientService.addPatient({
      nome: "Mario", cognome: "Rossi", dataNascita: "1980-01-01", luogoNascita: "Roma", sesso: "M",
    });
    await PatientService.deletePatient(nuovo.id);
    const chiave = chiaveBozzaVisita(undefined, PAZIENTE_DELLA_PROVA.id);
    await scriviBozzaVisita(chiave, {
      salvataIl: new Date().toISOString(),
      visitData: {},
      visitaData: {},
      anamnesiStrutturata: {},
    });
    expect(await leggiBozzaVisita(chiave)).not.toBeNull();

    chiudiArchivioDiProva();
    expect(JSON.stringify(archivioVeroGrezzo())).toBe(prima);
    expect(await leggiBozzaVisita(chiave)).toBeNull();
    expect(await VisitService.getAllRevisions()).toEqual([]);
  });

  // Il medico sistema lo studio durante la guida: quello resta suo.
  it("tiene nell'archivio vero preferenze e modelli toccati durante la prova", async () => {
    apriArchivioDiProva(creaArchivioDiProva(OGGI));
    await PreferenceService.savePreferences({ formulaPesoFetale: "shepard" });
    const modello = await TemplateService.addTemplate({
      category: "ostetricia", section: "esameObiettivo", label: "Mio modello", text: "Testo",
    });
    chiudiArchivioDiProva();

    expect(await PreferenceService.getPreferences()).toEqual({ formulaPesoFetale: "shepard" });
    expect((await TemplateService.getAllTemplates()).some((t) => t.id === modello.id)).toBe(true);
  });

  // Una scrittura partita nella prova non deve finire nell'archivio vero
  // perche' la guida si e' chiusa mentre era in corso.
  it("finisce nella prova l'operazione cominciata nella prova", async () => {
    apriArchivioDiProva(creaArchivioDiProva(OGGI));
    const inCorso = VisitService.addVisit(visitaVuota(PAZIENTE_DELLA_PROVA.id));
    chiudiArchivioDiProva();
    await inCorso;
    expect(await VisitService.getAllVisits()).toEqual([]);
  });

  it("rifiuta backup e reset durante la prova", async () => {
    apriArchivioDiProva(creaArchivioDiProva(OGGI));
    await expect(storageService.exportData()).rejects.toThrow(/guida/);
    await expect(storageService.clearAllData()).rejects.toThrow(/guida/);
    chiudiArchivioDiProva();
    expect((await storageService.exportData()).patients).toHaveLength(1);
  });

  it("conta per la telemetria solo l'archivio vero", async () => {
    apriArchivioDiProva(creaArchivioDiProva(OGGI));
    expect(await conteggiArchivioReale()).toEqual({ pazienti: 1, visite: 0 });
  });
});

describe("pazienti dell'archivio di prova", () => {
  const { patients, visits } = creaArchivioDiProva(OGGI);
  const visiteDi = (id: string) => visits.filter((v) => v.patientId === id);

  it("riempiono la colonna delle gravidanze in corso, con la paziente della prova", () => {
    const inCorso = computeActivePregnancies(visits, patients, OGGI).map((g) => g.patientId);
    expect(inCorso.length).toBeGreaterThanOrEqual(3);
    expect(inCorso).toContain(PAZIENTE_DELLA_PROVA.id);
  });

  // Le curve di crescita mettono in fila i controlli della gravidanza.
  it("danno alla paziente della prova piu' controlli con la biometria, per le curve", () => {
    const punti = getFetalGrowthDataPointsFromVisits(visiteDi(PAZIENTE_DELLA_PROVA.id), "hadlock4");
    expect(punti.length).toBeGreaterThanOrEqual(2);
  });

  // La visita di oggi e' quella che il medico scrive nella prova.
  it("hanno visite tutte passate, nessuna di oggi", () => {
    for (const v of visits) expect(v.dataVisita < "2026-09-28").toBe(true);
    for (const p of patients) {
      expect(p.createdAt).not.toBe("");
      expect(visiteDi(p.id).length).toBeGreaterThan(0);
    }
  });

  it("non ripetono id ne' codici fiscali, e i codici fiscali sono validi", () => {
    expect(new Set(patients.map((p) => p.id)).size).toBe(patients.length);
    expect(new Set(visits.map((v) => v.id)).size).toBe(visits.length);
    expect(new Set(patients.map((p) => p.codiceFiscale)).size).toBe(patients.length);
    for (const p of patients) expect(isValidCodiceFiscale(p.codiceFiscale ?? ""), p.cognome).toBe(true);
  });
});
