import { beforeEach, describe, expect, it } from "vitest";

/**
 * La pulizia dei dati demo è una migrazione una-tantum: se girasse a ogni avvio
 * cancellerebbe senza preavviso un paziente reale che per coincidenza ha uno dei
 * codici fiscali demo.
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

const { initializeAppData } = await import("../seed");
const { PatientService, VisitService } = await import("../OfflineServices");
const { storageService } = await import("../StorageServiceFallback");

const CF_DEMO = "RSSMRA80A01H501U";

const cognomi = async () =>
  (await PatientService.getAllPatients()).map((p) => p.cognome).sort();

beforeEach(() => {
  store.clear();
});

describe("migrazione dei dati demo", () => {
  it("rimuove il paziente demo (CF demo + email demo)", async () => {
    await PatientService.addPatient({
      codiceFiscale: CF_DEMO, nome: "Mario", cognome: "Rossi",
      dataNascita: "1980-01-01", luogoNascita: "Roma", sesso: "M",
      email: "mario.rossi@example.com",
    });
    await initializeAppData();
    expect(await cognomi()).not.toContain("Rossi");
  });

  it("NON tocca un paziente reale con lo stesso codice fiscale", async () => {
    await PatientService.addPatient({
      codiceFiscale: CF_DEMO, nome: "Mario", cognome: "Rossi",
      dataNascita: "1980-01-01", luogoNascita: "Roma", sesso: "M",
      email: "mario.rossi@gmail.com",
    });
    await initializeAppData();
    expect(await cognomi()).toContain("Rossi");
  });

  it("NON tocca un paziente con CF demo e senza email", async () => {
    await PatientService.addPatient({
      codiceFiscale: CF_DEMO, nome: "Mario", cognome: "Rossi",
      dataNascita: "1980-01-01", luogoNascita: "Roma", sesso: "M",
    });
    await initializeAppData();
    expect(await cognomi()).toContain("Rossi");
  });

  it("non tocca i pazienti normali né le loro visite", async () => {
    const p = await PatientService.addPatient({
      nome: "Anna", cognome: "Neri", dataNascita: "1985-12-10",
      luogoNascita: "Milano", sesso: "F", email: "anna@example.com",
    });
    await VisitService.addVisit({
      patientId: p.id, dataVisita: "2026-08-01", descrizioneClinica: "Controllo",
      anamnesi: "", esamiObiettivo: "", conclusioniDiagnostiche: "", terapie: "",
    });
    await initializeAppData();
    expect(await cognomi()).toContain("Neri");
    expect(await VisitService.getAllVisits()).toHaveLength(1);
  });

  it("non si ripete ai riavvii successivi", async () => {
    await initializeAppData();
    expect(await storageService.getPreference("demo_cleanup_done_v1")).toBe("true");

    // Un paziente registrato dopo la migrazione sopravvive anche se coincide col demo
    await PatientService.addPatient({
      codiceFiscale: CF_DEMO, nome: "Mario", cognome: "Rossi",
      dataNascita: "1980-01-01", luogoNascita: "Roma", sesso: "M",
      email: "mario.rossi@example.com",
    });
    await initializeAppData();
    await initializeAppData();
    expect(await cognomi()).toContain("Rossi");
  });

  it("crea il profilo dottore di default", async () => {
    await initializeAppData();
    const { DoctorService } = await import("../OfflineServices");
    expect(await DoctorService.getDoctor()).not.toBeNull();
  });
});
