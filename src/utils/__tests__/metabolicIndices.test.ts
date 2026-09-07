import { describe, expect, it } from "vitest";
import {
  bmiBand,
  computeBmi,
  computeHomaIr,
  formatBmiWithBand,
  formatHomaIr,
  homaIrBand,
} from "../metabolicIndices";

describe("BMI", () => {
  it("calcola il valore da peso e altezza", () => {
    expect(computeBmi(65, 165)?.toFixed(1)).toBe("23.9");
    expect(computeBmi(100, 170)?.toFixed(1)).toBe("34.6");
  });

  it("non calcola nulla senza peso o altezza", () => {
    expect(computeBmi(0, 165)).toBeNull();
    expect(computeBmi(65, 0)).toBeNull();
    expect(computeBmi(65, undefined)).toBeNull();
    expect(computeBmi(-5, 165)).toBeNull();
  });

  it("classifica secondo le fasce OMS", () => {
    const cases: Array<[number, string]> = [
      [16, "Sottopeso"],
      [18.4, "Sottopeso"],
      [18.5, "Normopeso"],
      [24.9, "Normopeso"],
      [25, "Sovrappeso"],
      [29.9, "Sovrappeso"],
      [30, "Obesità I"],
      [34.9, "Obesità I"],
      [35, "Obesità II"],
      [39.9, "Obesità II"],
      [40, "Obesità III"],
      [55, "Obesità III"],
    ];
    for (const [bmi, label] of cases) {
      expect(bmiBand(bmi).label, String(bmi)).toBe(label);
    }
  });

  it("formatta valore e fascia insieme", () => {
    expect(formatBmiWithBand(27.34)).toBe("27.3 (Sovrappeso)");
  });
});

describe("HOMA-IR", () => {
  it("applica la formula glicemia × insulinemia / 405", () => {
    expect(formatHomaIr(computeHomaIr(90, 10)!)).toBe("2.22");
    expect(formatHomaIr(computeHomaIr(100, 5)!)).toBe("1.23");
  });

  it("non calcola nulla se manca un valore", () => {
    expect(computeHomaIr(90, 0)).toBeNull();
    expect(computeHomaIr(0, 10)).toBeNull();
    expect(computeHomaIr(undefined, 10)).toBeNull();
  });

  it("classifica secondo le soglie orientative", () => {
    expect(homaIrBand(1.4).label).toBe("Normale");
    expect(homaIrBand(1.99).label).toBe("Normale");
    expect(homaIrBand(2).label).toBe("Borderline");
    expect(homaIrBand(2.49).label).toBe("Borderline");
    expect(homaIrBand(2.5).label).toBe("Insulino-resistenza");
    expect(homaIrBand(4.99).label).toBe("Insulino-resistenza");
    expect(homaIrBand(5).label).toBe("Insulino-resistenza marcata");
    expect(homaIrBand(12).label).toBe("Insulino-resistenza marcata");
  });
});
