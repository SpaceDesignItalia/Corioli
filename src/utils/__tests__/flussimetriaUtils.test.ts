import { describe, expect, it } from "vitest";
import {
  getUmbilicalPiPercentile,
  getUmbilicalPiRef,
  getUmbilicalRiPercentile,
  getUmbilicalRiRef,
  percentileScaleBar,
} from "../flussimetriaUtils";

describe("flussimetria arteria ombelicale", () => {
  it("il p50 di riferimento corrisponde al 50° centile (PI)", () => {
    // Curve FMF/Ciobanu 2019: a 32 settimane p50 = 0.965
    expect(getUmbilicalPiPercentile(0.965, 32)).toBeCloseTo(50, 0);
    expect(getUmbilicalPiPercentile(1.007, 30)).toBeCloseTo(50, 0);
  });

  it("p5 e p95 cadono sui centili attesi (PI)", () => {
    const ref = getUmbilicalPiRef(32)!;
    expect(getUmbilicalPiPercentile(ref.p5, 32)).toBeCloseTo(5, 0);
    expect(getUmbilicalPiPercentile(ref.p95, 32)).toBeCloseTo(95, 0);
  });

  it("un PI alto indica resistenza aumentata (centile alto)", () => {
    const alto = getUmbilicalPiPercentile(1.4, 32)!;
    const normale = getUmbilicalPiPercentile(0.965, 32)!;
    expect(alto).toBeGreaterThan(95);
    expect(normale).toBeCloseTo(50, 0);
  });

  it("il PI di riferimento cala con l'avanzare della gravidanza", () => {
    const p24 = getUmbilicalPiRef(24)!;
    const p38 = getUmbilicalPiRef(38)!;
    expect(p38.p50).toBeLessThan(p24.p50);
  });

  it("interpola tra settimane intere", () => {
    const a = getUmbilicalPiRef(30)!;
    const b = getUmbilicalPiRef(31)!;
    const mezzo = getUmbilicalPiRef(30.5)!;
    expect(mezzo.p50).toBeCloseTo((a.p50 + b.p50) / 2, 4);
  });

  it("fuori dal range 20-41 settimane restituisce null", () => {
    expect(getUmbilicalPiPercentile(1.0, 19)).toBeNull();
    expect(getUmbilicalPiPercentile(1.0, 42)).toBeNull();
    expect(getUmbilicalPiRef(19)).toBeNull();
    expect(getUmbilicalRiRef(42)).toBeNull();
  });

  it("valori non validi non producono un centile", () => {
    expect(getUmbilicalPiPercentile(0, 32)).toBeNull();
    expect(getUmbilicalPiPercentile(-1, 32)).toBeNull();
    expect(getUmbilicalRiPercentile(0, 32)).toBeNull();
  });

  it("l'indice di resistenza segue le stesse regole", () => {
    const ref = getUmbilicalRiRef(32)!;
    expect(getUmbilicalRiPercentile(ref.p50, 32)).toBeCloseTo(50, 0);
    expect(getUmbilicalRiPercentile(ref.p5, 32)).toBeCloseTo(5, 0);
    expect(getUmbilicalRiPercentile(ref.p95, 32)).toBeCloseTo(95, 0);
  });

  it("la barra grafica marca gli estremi e il centro", () => {
    const bassa = percentileScaleBar(2);
    const media = percentileScaleBar(50);
    const alta = percentileScaleBar(98);
    for (const b of [bassa, media, alta]) {
      expect(b).toContain("⊢");
      expect(b).toContain("⊣");
      expect(b).toContain("◆");
    }
    // il diamante si sposta a destra al crescere del centile
    expect(bassa.indexOf("◆")).toBeLessThan(media.indexOf("◆"));
    expect(media.indexOf("◆")).toBeLessThan(alta.indexOf("◆"));
  });

  it("la barra gestisce l'assenza di valore", () => {
    expect(typeof percentileScaleBar(null)).toBe("string");
    expect(typeof percentileScaleBar(undefined)).toBe("string");
  });
});
