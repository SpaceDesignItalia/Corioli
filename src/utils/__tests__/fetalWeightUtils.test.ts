import { describe, expect, it } from "vitest";
import { calcolaStimePesoFetale, FORMULA_BIOMETRIA_FIELDS } from "../fetalWeightUtils";

/**
 * Valori di controllo calcolati dalle formule pubblicate (misure in cm):
 *  - Hadlock I   log10 BW = 1.335 − 0.0034(AC·FL) + 0.0316(BPD) + 0.0457(AC) + 0.162(FL)
 *  - Hadlock II  log10 BW = 1.326 − 0.00326(AC·FL) + 0.0107(HC) + 0.0438(AC) + 0.158(FL)
 *  - Hadlock III log10 BW = 1.304 + 0.05281(AC) + 0.1938(FL) − 0.004(AC·FL)
 *  - Hadlock IV  log10 BW = 1.3596 − 0.00386(AC·FL) + 0.0064(HC) + 0.00061(BPD·AC) + 0.0424(AC) + 0.174(FL)
 *  - Shepard     log10 BW = −1.7492 + 0.166(BPD) + 0.046(AC) − 0.002646(AC·BPD)   [kg]
 *  - Campbell    ln BW    = −4.564 + 0.282(AC) − 0.00331(AC²)                      [kg]
 */

// Feto a termine tipico: BPD 90 mm, CC 330 mm, CA 340 mm, FL 70 mm
const A_TERMINE = { bpdMm: 90, hcMm: 330, acMm: 340, flMm: 70 };

function atteso(log10: number): number {
  return Math.round(Math.pow(10, log10));
}

describe("stima del peso fetale", () => {
  it("Hadlock I riproduce la formula pubblicata", () => {
    const bpd = 9, ac = 34, fl = 7;
    const log10 = 1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.162 * fl;
    expect(calcolaStimePesoFetale(A_TERMINE).hadlock1.pesoGrammi).toBe(atteso(log10));
  });

  it("Hadlock II riproduce la formula pubblicata", () => {
    const hc = 33, ac = 34, fl = 7;
    const log10 = 1.326 + 0.0107 * hc + 0.0438 * ac + 0.158 * fl - 0.00326 * ac * fl;
    expect(calcolaStimePesoFetale(A_TERMINE).hadlock2.pesoGrammi).toBe(atteso(log10));
  });

  it("Hadlock III riproduce la formula pubblicata", () => {
    const ac = 34, fl = 7;
    const log10 = 1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl;
    expect(calcolaStimePesoFetale(A_TERMINE).hadlock3.pesoGrammi).toBe(atteso(log10));
  });

  it("Hadlock IV riproduce la formula pubblicata", () => {
    const bpd = 9, hc = 33, ac = 34, fl = 7;
    const log10 =
      1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl;
    expect(calcolaStimePesoFetale(A_TERMINE).hadlock4.pesoGrammi).toBe(atteso(log10));
  });

  it("Shepard e Campbell convertono correttamente da kg a grammi", () => {
    const r = calcolaStimePesoFetale(A_TERMINE);
    const shepardKg = Math.pow(10, -1.7492 + 0.166 * 9 + 0.046 * 34 - 0.002646 * 9 * 34);
    const campbellKg = Math.exp(-4.564 + 0.282 * 34 - 0.00331 * 34 * 34);
    expect(r.shepard.pesoGrammi).toBe(Math.round(shepardKg * 1000));
    expect(r.campbell.pesoGrammi).toBe(Math.round(campbellKg * 1000));
  });

  it("resta nel range fisiologico per un feto a termine", () => {
    const r = calcolaStimePesoFetale(A_TERMINE);
    for (const [nome, stima] of Object.entries(r)) {
      expect(stima.pesoGrammi, nome).toBeGreaterThan(2000);
      expect(stima.pesoGrammi, nome).toBeLessThan(5000);
    }
  });

  it("pesoKg è coerente con pesoGrammi", () => {
    const r = calcolaStimePesoFetale(A_TERMINE);
    expect(r.hadlock4.pesoKg).toBeCloseTo(r.hadlock4.pesoGrammi! / 1000, 2);
  });

  it("una formula non è calcolabile se manca una sua misura", () => {
    // Senza femore: Hadlock I/II/III/IV non calcolabili, Shepard e Campbell sì
    const r = calcolaStimePesoFetale({ ...A_TERMINE, flMm: 0 });
    expect(r.hadlock1.calcolabile).toBe(false);
    expect(r.hadlock2.calcolabile).toBe(false);
    expect(r.hadlock3.calcolabile).toBe(false);
    expect(r.hadlock4.calcolabile).toBe(false);
    expect(r.shepard.calcolabile).toBe(true);
    expect(r.campbell.calcolabile).toBe(true);
    expect(r.hadlock4.pesoGrammi).toBeNull();
  });

  it("nessuna misura: nulla è calcolabile e non lancia", () => {
    const r = calcolaStimePesoFetale({ bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 });
    expect(Object.values(r).every((s) => !s.calcolabile)).toBe(true);
  });

  it("misure negative sono trattate come assenti", () => {
    const r = calcolaStimePesoFetale({ bpdMm: -10, hcMm: -1, acMm: -5, flMm: -2 });
    expect(Object.values(r).every((s) => !s.calcolabile)).toBe(true);
  });

  it("l'elenco dei campi richiesti corrisponde alle formule", () => {
    expect(FORMULA_BIOMETRIA_FIELDS.hadlock4).toEqual(["bpdMm", "hcMm", "acMm", "flMm"]);
    expect(FORMULA_BIOMETRIA_FIELDS.campbell).toEqual(["acMm"]);
  });

  it("il peso cresce al crescere della circonferenza addominale", () => {
    const piccolo = calcolaStimePesoFetale({ ...A_TERMINE, acMm: 300 }).hadlock4.pesoGrammi!;
    const grande = calcolaStimePesoFetale({ ...A_TERMINE, acMm: 360 }).hadlock4.pesoGrammi!;
    expect(grande).toBeGreaterThan(piccolo);
  });
});
