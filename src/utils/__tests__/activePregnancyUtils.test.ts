import { describe, expect, it } from "vitest";
import type { Patient, Visit } from "../../types/Storage";
import { computeTrackedPregnancies } from "../activePregnancyUtils";

const paziente = { id: "p1", nome: "Anna", cognome: "Rossi" } as Patient;

function visitaOstetrica(dataVisita: string, ultimaMestruazione: string, dataPresunta = ""): Visit {
  return {
    id: dataVisita,
    patientId: "p1",
    tipo: "ostetrica",
    dataVisita,
    ostetricia: { ultimaMestruazione, dataPresunta },
  } as unknown as Visit;
}

const oggi = new Date(2026, 10, 2);

describe("gravidanze in corso", () => {
  it("senza DPP salvata data dall'ultima mestruazione", () => {
    const [g] = computeTrackedPregnancies([visitaOstetrica("2026-11-02", "2026-08-10")], [paziente], oggi);
    expect(g.gestationLabel).toBe("12+0");
    expect(g.dpp).toEqual(new Date(2027, 4, 17));
  });

  it("usa la DPP salvata, ridatata col CRL", () => {
    // UM darebbe 12+0, il CRL ha ridatato a 11+0 (DPP spostata di 7 giorni)
    const [g] = computeTrackedPregnancies(
      [visitaOstetrica("2026-11-02", "2026-08-10", "2027-05-24")],
      [paziente],
      oggi,
    );
    expect(g.gestationLabel).toBe("11+0");
    expect(g.dpp).toEqual(new Date(2027, 4, 24));
  });

  it("ignora la DPP di una gravidanza precedente", () => {
    const [g] = computeTrackedPregnancies(
      [
        visitaOstetrica("2026-11-02", "2026-08-10"),
        visitaOstetrica("2025-03-01", "2024-12-01", "2025-09-07"),
      ],
      [paziente],
      oggi,
    );
    expect(g.gestationLabel).toBe("12+0");
  });
});
