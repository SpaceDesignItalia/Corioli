import { describe, expect, it } from "vitest";
import {
  estimateCentileRank,
  formatCentileLabel,
  getCentileForWeight,
  getGrowthCategory,
  getWeightPercentiles,
  normalCDF,
  parseGestationalWeeks,
} from "../fetalGrowthCentiles";

describe("epoca gestazionale", () => {
  it('interpreta la notazione "settimane+giorni"', () => {
    expect(parseGestationalWeeks("22+3")).toBeCloseTo(22 + 3 / 7, 5);
    expect(parseGestationalWeeks("32 + 0")).toBe(32);
    expect(parseGestationalWeeks("40+6")).toBeCloseTo(40 + 6 / 7, 5);
  });

  it("accetta settimane semplici e decimali con virgola", () => {
    expect(parseGestationalWeeks("28")).toBe(28);
    expect(parseGestationalWeeks("28,5")).toBe(28.5);
    expect(parseGestationalWeeks("28.5")).toBe(28.5);
  });

  it("rifiuta valori non validi", () => {
    expect(parseGestationalWeeks("")).toBeNull();
    expect(parseGestationalWeeks("   ")).toBeNull();
    expect(parseGestationalWeeks("abc")).toBeNull();
    // 7 giorni non esiste: sarebbe la settimana successiva
    expect(parseGestationalWeeks("22+7")).toBeNull();
    expect(parseGestationalWeeks("-3")).toBeNull();
  });
});

describe("distribuzione normale", () => {
  it("normalCDF è corretta sui valori noti", () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
    expect(normalCDF(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCDF(-1.645)).toBeCloseTo(0.05, 3);
    expect(normalCDF(1.96)).toBeCloseTo(0.975, 3);
  });

  it("è monotona crescente", () => {
    expect(normalCDF(-1)).toBeLessThan(normalCDF(0));
    expect(normalCDF(0)).toBeLessThan(normalCDF(1));
  });
});

describe("rango centile", () => {
  it("restituisce esattamente 5, 50 e 95 ai punti di riferimento", () => {
    expect(estimateCentileRank(1000, 1000, 1500, 2000)).toBeCloseTo(5, 1);
    expect(estimateCentileRank(1500, 1000, 1500, 2000)).toBeCloseTo(50, 1);
    expect(estimateCentileRank(2000, 1000, 1500, 2000)).toBeCloseTo(95, 1);
  });

  it("gestisce distribuzioni asimmetriche (code diverse)", () => {
    // coda destra più lunga della sinistra
    const sotto = estimateCentileRank(900, 1000, 1500, 3000);
    const sopra = estimateCentileRank(3100, 1000, 1500, 3000);
    expect(sotto).toBeLessThan(5);
    expect(sopra).toBeGreaterThan(95);
  });

  it("resta nell'intervallo 0-100 anche con valori estremi", () => {
    expect(estimateCentileRank(1, 1000, 1500, 2000)).toBeGreaterThanOrEqual(0);
    expect(estimateCentileRank(999999, 1000, 1500, 2000)).toBeLessThanOrEqual(100);
  });

  it("riferimenti degeneri non fanno esplodere il calcolo", () => {
    expect(estimateCentileRank(1500, 2000, 1500, 1000)).toBe(50);
  });
});

describe("centile del peso per epoca gestazionale (Hadlock 1991)", () => {
  it("il p50 tabulato corrisponde al 50° centile", () => {
    // 28 settimane: p50 = 1160 g
    expect(getCentileForWeight(1160, 28)).toBeCloseTo(50, 0);
    // 32 settimane: p50 = 1882 g
    expect(getCentileForWeight(1882, 32)).toBeCloseTo(50, 0);
  });

  it("p5 e p95 tabulati cadono sui centili attesi", () => {
    expect(getCentileForWeight(856, 28)).toBeCloseTo(5, 0);
    expect(getCentileForWeight(1508, 28)).toBeCloseTo(95, 0);
  });

  it("interpola tra settimane intere", () => {
    const a = getWeightPercentiles(28)!;
    const b = getWeightPercentiles(29)!;
    const mezzo = getWeightPercentiles(28.5)!;
    expect(mezzo.p50).toBeCloseTo((a.p50 + b.p50) / 2, 0);
    expect(mezzo.p50).toBeGreaterThan(a.p50);
    expect(mezzo.p50).toBeLessThan(b.p50);
  });

  it("è monotona: più peso, centile più alto", () => {
    const basso = getCentileForWeight(1000, 28)!;
    const medio = getCentileForWeight(1160, 28)!;
    const alto = getCentileForWeight(1400, 28)!;
    expect(basso).toBeLessThan(medio);
    expect(medio).toBeLessThan(alto);
  });

  it("fuori dal range 20-42 settimane restituisce null", () => {
    expect(getCentileForWeight(1000, 19)).toBeNull();
    expect(getCentileForWeight(3000, 43)).toBeNull();
    expect(getCentileForWeight(0, 30)).toBeNull();
    expect(getCentileForWeight(-100, 30)).toBeNull();
  });

  it("agli estremi della tabella resta definita", () => {
    expect(getCentileForWeight(331, 20)).toBeCloseTo(50, 0);
    expect(getCentileForWeight(4539, 42)).toBeCloseTo(50, 0);
  });
});

describe("categoria di crescita ed etichette", () => {
  it("classifica SGA / AGA / LGA sulle soglie 10° e 90°", () => {
    expect(getGrowthCategory(9.9)).toBe("SGA");
    expect(getGrowthCategory(10)).toBe("AGA");
    expect(getGrowthCategory(50)).toBe("AGA");
    expect(getGrowthCategory(90)).toBe("AGA");
    expect(getGrowthCategory(90.1)).toBe("LGA");
  });

  it("le etichette usano <5° e >95° agli estremi", () => {
    expect(formatCentileLabel(3)).toBe("<5°");
    expect(formatCentileLabel(97)).toBe(">95°");
    expect(formatCentileLabel(50)).toBe("50°");
    expect(formatCentileLabel(78.4)).toBe("78°");
  });
});
