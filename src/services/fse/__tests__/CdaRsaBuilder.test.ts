import { describe, expect, it } from "vitest";
import { buildCdaRsa } from "../CdaRsaBuilder";
import { inputDemo, pazienteDemo, visitaDemo } from "./fixtures";

const sectionCodes = (xml: string) =>
  [...xml.matchAll(/<section>\s*<templateId root="[^"]+"\/>\s*<code code="([^"]+)"/g)].map((m) => m[1]);

describe("buildCdaRsa", () => {
  it("produce un RSA completo e senza errori dai dati demo", () => {
    const { xml, errori, avvisi } = buildCdaRsa(inputDemo);
    expect(errori).toEqual([]);
    expect(avvisi).toEqual([]);
    expect(xml).toContain('<templateId root="2.16.840.1.113883.2.9.10.1.9.1" extension="1.1"/>');
    expect(xml).toContain('code="11488-4"');
    expect(xml).toContain(`extension="${pazienteDemo.codiceFiscale}"`);
    // Ordine delle sezioni come da IG; Prestazioni (62387-6) e Referto (47045-0) obbligatorie.
    expect(sectionCodes(xml)).toEqual([
      "29299-5", "11329-0", "29545-1", "62387-6", "47045-0", "29548-5", "55110-1",
    ]);
  });

  it("esegue l'escape dei caratteri speciali nel testo libero", () => {
    const visit = {
      ...visitaDemo,
      ginecologia: { ...visitaDemo.ginecologia!, esameBimanuale: "Endometrio < 5 mm & ovaie \"regolari\"" },
    };
    const { xml } = buildCdaRsa({ ...inputDemo, visit });
    expect(xml).toContain("Endometrio &lt; 5 mm &amp; ovaie &quot;regolari&quot;");
  });

  it("blocca l'invio con CF generato all'import o mancante", () => {
    const generato = buildCdaRsa({ ...inputDemo, patient: { ...pazienteDemo, codiceFiscaleGenerato: true } });
    expect(generato.errori.join(" ")).toMatch(/generato/);
    const mancante = buildCdaRsa({ ...inputDemo, patient: { ...pazienteDemo, codiceFiscale: undefined } });
    expect(mancante.errori.join(" ")).toMatch(/mancante/);
  });

  it("segnala l'IVG in anamnesi come dato a maggior tutela", () => {
    const visit = {
      ...visitaDemo,
      ginecologia: { ...visitaDemo.ginecologia!, gravidanze: 1, aborti: 1, ivg: 1 },
    };
    const { avvisi } = buildCdaRsa({ ...inputDemo, visit });
    expect(avvisi.join(" ")).toMatch(/maggior tutela/);
  });

  it("richiede il referto, sezione obbligatoria", () => {
    const visit = { ...visitaDemo, ginecologia: { ...visitaDemo.ginecologia!, esameBimanuale: "" } };
    expect(buildCdaRsa({ ...inputDemo, visit }).errori.join(" ")).toMatch(/Referto/);
  });
});
