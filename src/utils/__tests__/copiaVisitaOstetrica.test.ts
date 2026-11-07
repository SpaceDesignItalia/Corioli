import { describe, expect, it } from "vitest";
import { epocaAllaData, misureDaRifare } from "../copiaVisitaOstetrica";
import { BIOMETRIA_MAX_MM, biometriaFuoriScala } from "../fetalWeightUtils";

describe("epoca alla data della visita", () => {
  it("conta settimane e giorni dall'ultima mestruazione", () => {
    expect(epocaAllaData("2026-03-01", "2026-03-01")).toBe("");
    expect(epocaAllaData("2026-03-01", "2026-03-02")).toBe("0+1");
    expect(epocaAllaData("2026-03-01", "2026-10-21")).toBe("33+3");
  });

  it("non cambia col passaggio all'ora legale", () => {
    // Fra le due date c'e' il 29 marzo 2026: con l'ora locale un giorno
    // durerebbe 23 ore e l'epoca uscirebbe di un giorno indietro.
    expect(epocaAllaData("2026-03-20", "2026-04-03")).toBe("2+0");
  });

  it("resta vuota senza date o se la distanza non e' una gravidanza", () => {
    expect(epocaAllaData("", "2026-10-21")).toBe("");
    expect(epocaAllaData("2026-03-01", "")).toBe("");
    expect(epocaAllaData("2026-10-21", "2026-03-01")).toBe("");
    expect(epocaAllaData("2025-01-01", "2026-10-21")).toBe("");
  });
});

describe("copia della visita ostetrica precedente", () => {
  it("ricalcola l'epoca e svuota le misure del controllo", () => {
    const rifare = misureDaRifare("2026-03-01", "2026-10-21");
    expect(rifare.settimaneGestazione).toBe("33+3");
    expect(rifare.biometriaFetale).toEqual({ bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 });
    expect(rifare.flussimetriaOmbelicale).toBeUndefined();
    expect(rifare.crlMm).toBeUndefined();
    expect(rifare.ecografiaImmagini).toEqual([]);
    expect(rifare.pesoAttuale).toBe(0);
    expect(rifare.pressioneArteriosa).toBe("");
    expect(rifare.battitiFetali).toBe("");
  });

  it("lascia storia e datazione della gravidanza", () => {
    const chiavi = Object.keys(misureDaRifare("2026-03-01", "2026-10-21"));
    for (const resta of ["ultimaMestruazione", "dataPresunta", "pesoPreGravidanza", "gravidanzePrec", "prestazione", "noteOstetriche"]) {
      expect(chiavi).not.toContain(resta);
    }
  });
});

describe("misure della biometria fuori scala", () => {
  it("lascia passare misure vere, anche patologiche", () => {
    expect(biometriaFuoriScala(undefined)).toBeNull();
    expect(biometriaFuoriScala({ bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 })).toBeNull();
    expect(biometriaFuoriScala({ bpdMm: 104, hcMm: 372, acMm: 410, flMm: 82 })).toBeNull();
    // Idrocefalia grave e macrosomia: sopra il 99° centile, ma possibili.
    expect(biometriaFuoriScala({ bpdMm: 130, hcMm: 480, acMm: 450 })).toBeNull();
  });

  it("ferma una cifra in piu' in ogni misura", () => {
    expect(biometriaFuoriScala({ bpdMm: 760 })).toContain("DBP di 760 mm");
    expect(biometriaFuoriScala({ hcMm: 2790 })).toContain("CC di 2790 mm");
    expect(biometriaFuoriScala({ acMm: 2580 })).toContain("CA di 2580 mm");
    expect(biometriaFuoriScala({ flMm: 570 })).toContain("FL di 570 mm");
    expect(biometriaFuoriScala({ flMm: BIOMETRIA_MAX_MM.flMm })).toBeNull();
    expect(biometriaFuoriScala({ flMm: BIOMETRIA_MAX_MM.flMm + 1 })).not.toBeNull();
  });
});
