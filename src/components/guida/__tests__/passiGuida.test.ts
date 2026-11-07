import { describe, expect, it } from "vitest";
import {
  EVENTO_REFERTO_APERTO,
  RISULTATO_PAZIENTE_DELLA_PROVA,
  g,
  passiGuida,
  pazienteDellaVisita,
  type ContestoPasso,
} from "../passiGuida";
import { PAZIENTE_DELLA_PROVA } from "../archivioDiProva";

/** Una pagina finta: percorso, elementi presenti, testi e valori dei campi. */
function contesto(parziale: {
  percorso?: string;
  ricerca?: string;
  presenti?: string[];
  testi?: Record<string, string>;
  valori?: Record<string, string>;
  eventi?: string[];
}): ContestoPasso {
  const presenti = new Set(parziale.presenti ?? []);
  return {
    percorso: parziale.percorso ?? "/",
    ricerca: parziale.ricerca ?? "",
    esiste: (s) => presenti.has(s),
    testo: (s) => parziale.testi?.[s] ?? "",
    valore: (s) => parziale.valori?.[s] ?? "",
    eventi: new Set(parziale.eventi ?? []),
  };
}

const passi = passiGuida("Ctrl");
const passo = (id: string) => {
  const trovato = passi.find((p) => p.id === id);
  if (!trovato) throw new Error(`passo ${id} mancante`);
  return trovato;
};
const CAMPO_EO = `${g("campo-esame-obiettivo")} [contenteditable="true"]`;
const SCHEDA = `/patient-history/${PAZIENTE_DELLA_PROVA.id}`;

describe("passi della prova guidata", () => {
  it("non ripete lo stesso id e rimanda solo a passi esistenti", () => {
    const ids = passi.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of passi) {
      const verso = p.perso?.(contesto({ percorso: "/" }));
      if (verso) expect(ids).toContain(verso);
    }
  });

  it("comincia dalle gravidanze in corso", () => {
    expect(passi[0].id).toBe("gravidanze");
    expect(passi[0].bersagli).toEqual([g("colonna-gravidanze")]);
  });

  it("apre la ricerca con Ctrl+N e lascia passare solo quella scorciatoia", () => {
    const p = passo("apri-visita");
    expect(p.consentiti).toEqual(["n"]);
    expect(p.fatto?.(contesto({}))).toBe(false);
    expect(p.fatto?.(contesto({ presenti: [g("pannello-paziente")] }))).toBe(true);
  });

  it("fa cercare la paziente della prova per cognome e sceglierla col clic", () => {
    const p = passo("cerca");
    expect(p.scrivi?.testo).toBe(PAZIENTE_DELLA_PROVA.cognome);
    expect(p.punta).toEqual([RISULTATO_PAZIENTE_DELLA_PROVA]);
    expect(p.fatto?.(contesto({ percorso: "/" }))).toBe(false);
    expect(p.fatto?.(contesto({ percorso: SCHEDA }))).toBe(true);
    expect(p.perso?.(contesto({ percorso: "/" }))).toBe("apri-visita");
    expect(p.perso?.(contesto({ percorso: "/", presenti: [g("pannello-paziente")] }))).toBeNull();
  });

  it("dalla scheda apre la visita, e la visita diventa ostetrica", () => {
    expect(passo("nuova-visita").fatto?.(contesto({ percorso: SCHEDA }))).toBe(false);
    expect(
      passo("nuova-visita").fatto?.(
        contesto({ percorso: "/add-visit", ricerca: `?patientId=${PAZIENTE_DELLA_PROVA.id}` }),
      ),
    ).toBe(true);
    const ostetrica = passo("ostetrica");
    expect(ostetrica.fatto?.(contesto({ percorso: "/add-visit" }))).toBe(false);
    expect(ostetrica.fatto?.(contesto({ presenti: [g("card-biometria")] }))).toBe(true);
  });

  it("se si torna sulla scheda ginecologica riparte dalla scelta della visita ostetrica", () => {
    const visita = { percorso: "/add-visit", ricerca: `?patientId=${PAZIENTE_DELLA_PROVA.id}` };
    for (const id of ["biometria", "modello", "grassetto"]) {
      expect(passo(id).perso?.(contesto(visita)), id).toBe("ostetrica");
      expect(passo(id).perso?.(contesto({ ...visita, presenti: [g("card-biometria")] })), id).toBeNull();
    }
  });

  it("riconosce la paziente dalla visita che si apre", () => {
    expect(pazienteDellaVisita({ percorso: "/add-visit", ricerca: "?patientId=abc" })).toBe("abc");
    expect(pazienteDellaVisita({ percorso: "/", ricerca: "?patientId=abc" })).toBeNull();
  });

  it("modello, grassetto e stampa guardano il campo e l'evento giusti", () => {
    expect(passo("modello").fatto?.(contesto({}))).toBe(false);
    expect(passo("modello").fatto?.(contesto({ testi: { [CAMPO_EO]: "ECOGRAFIA OSTETRICA" } }))).toBe(true);
    expect(passo("grassetto").fatto?.(contesto({ presenti: [`${CAMPO_EO} b`] }))).toBe(true);
    expect(passo("stampa").fatto?.(contesto({}))).toBe(false);
    expect(passo("stampa").fatto?.(contesto({ eventi: [EVENTO_REFERTO_APERTO] }))).toBe(true);
    // In Ginecologia Ctrl+P apre la nuova paziente: la stampa non la suggerisce.
    expect(passo("stampa").tasti).toBeUndefined();
    expect(passo("stampa").consentiti).toBeUndefined();
  });

  it("finisce nei modelli di Impostazioni", () => {
    expect(passo("vai-modelli").fatto?.(contesto({ percorso: "/settings" }))).toBe(true);
    const ultimo = passi[passi.length - 1];
    expect(ultimo.id).toBe("editor-modello");
    expect(ultimo.fatto?.(contesto({ presenti: [g("editor-modello")] }))).toBe(false);
    expect(ultimo.fatto?.(contesto({}))).toBe(true);
  });

  it("mostra come si fa in ogni passo da provare", () => {
    for (const p of passi.filter((x) => x.tipo === "prova")) {
      const mostra = Boolean(p.punta?.length || p.tasti || p.scrivi || p.demo);
      expect(mostra, p.id).toBe(true);
    }
  });

  it("dice il tasto giusto sul Mac", () => {
    const mac = passiGuida("Cmd");
    expect(mac.find((p) => p.id === "apri-visita")?.tasti).toEqual(["Cmd", "N"]);
    expect(mac.find((p) => p.id === "grassetto")?.testo).toContain("Cmd+B");
  });
});
