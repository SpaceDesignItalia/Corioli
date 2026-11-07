/**
 * I passi della prova guidata: la guida non spiega che cosa fa un pulsante,
 * lo fa premere e aspetta di vedere il risultato.
 *
 * La prova si fa su un archivio di prova (`archivioDiProva.ts`), perche' le
 * cose che contano di piu' si vedono solo con qualche mese di visite alle
 * spalle: le gravidanze in corso, i controlli precedenti nelle curve di
 * crescita. Il percorso e' quello di un controllo in gravidanza: la paziente
 * arriva, Ctrl+N, il cognome nella ricerca, la scheda, la visita ostetrica;
 * un modello e il grassetto sull'ecografia office, la stampa; infine i
 * modelli in Impostazioni.
 *
 * Ogni passo legge la pagina da un `ContestoPasso` e non dal DOM: cosi' le
 * condizioni si provano nei test senza un browser.
 */

import { PAZIENTE_DELLA_PROVA } from "./archivioDiProva";

/** Selettore di un elemento marcato per la guida. */
export const g = (nome: string) => `[data-guida="${nome}"]`;

/** Evento che `AddVisit` lancia quando il referto e' stato aperto in PDF. */
export const EVENTO_REFERTO_APERTO = "corioli-referto-aperto";

/** Il campo di testo modificabile dell'ecografia office della visita ostetrica. */
const CAMPO_ESAME_OBIETTIVO = `${g("campo-esame-obiettivo")} [contenteditable="true"]`;

/** La riga della paziente della prova fra i risultati della ricerca. */
export const RISULTATO_PAZIENTE_DELLA_PROVA = `button[data-paziente="${PAZIENTE_DELLA_PROVA.id}"]`;

export interface ContestoPasso {
  /** `pathname` della rotta attuale. */
  percorso: string;
  /** `search` della rotta attuale, con il `?`. */
  ricerca: string;
  esiste(selettore: string): boolean;
  /** Testo visibile del primo elemento che corrisponde. */
  testo(selettore: string): string;
  /** Valore del primo campo che corrisponde. */
  valore(selettore: string): string;
  /** Eventi della pagina arrivati da quando il passo e' cominciato. */
  eventi: ReadonlySet<string>;
}

/**
 * - `guarda`: si legge e si va avanti con il pulsante; la pagina sotto non
 *   risponde ai clic.
 * - `prova`: l'elemento illuminato si usa davvero, e il passo va avanti da
 *   solo quando `fatto` lo vede fatto (o con Avanti, se c'e' `pronto`).
 * - `attesa`: si lavora in una finestra dell'app (l'editor dei modelli); la
 *   guida si riduce a un promemoria in basso finche' `fatto` non torna vero.
 */
export type TipoPasso = "guarda" | "prova" | "attesa";

export interface PassoGuida {
  id: string;
  capitolo: string;
  tipo: TipoPasso;
  /** Selettori degli elementi da illuminare, presi tutti insieme. */
  bersagli: string[];
  titolo: string;
  testo: string;
  /** Scorciatoia da mostrare, tasto per tasto. */
  tasti?: string[];
  /**
   * Scorciatoie dell'app che in questo passo devono funzionare (le altre la
   * guida le ferma): la lettera, minuscola.
   */
  consentiti?: string[];
  /** "Scrivilo per me": riempie il campo con un valore di prova. */
  scrivi?: { selettore: string; testo: string };
  /**
   * Dove la manina mostra che cosa premere: il primo selettore che trova un
   * elemento (il menu, se e' aperto, prima del pulsante che lo apre).
   */
  punta?: string[];
  /** Dimostrazione animata nel fumetto. */
  demo?: "grassetto";
  /** Con `pronto`, il passo prova si chiude con Avanti quando e' vero. */
  pronto?(c: ContestoPasso): boolean;
  /** Il passo e' fatto: si va avanti da soli. */
  fatto?(c: ContestoPasso): boolean;
  /** Il contesto del passo e' sparito: id del passo da cui ripartire. */
  perso?(c: ContestoPasso): string | null;
}

/** L'id del paziente della visita aperta, dalla rotta `/add-visit?patientId=`. */
export function pazienteDellaVisita(c: Pick<ContestoPasso, "percorso" | "ricerca">): string | null {
  if (!c.percorso.startsWith("/add-visit")) return null;
  return new URLSearchParams(c.ricerca).get("patientId");
}

/**
 * Nella visita, ma tornati sulla scheda ginecologica: i passi della visita
 * ostetrica ripartono dalla scelta della scheda.
 */
function fuoriDallaVisitaOstetrica(c: ContestoPasso): string | null {
  return pazienteDellaVisita(c) !== null && !c.esiste(g("card-biometria")) ? "ostetrica" : null;
}

/** `mod` e' il tasto Ctrl, o Cmd sul Mac. */
export function passiGuida(mod: string): PassoGuida[] {
  const { cognome } = PAZIENTE_DELLA_PROVA;
  return [
    // ── L'archivio di prova ────────────────────────────────────────────
    {
      id: "gravidanze",
      capitolo: "L'archivio di prova",
      tipo: "guarda",
      bersagli: [g("colonna-gravidanze")],
      titolo: "Le gravidanze in corso",
      testo:
        "Per la prova l'archivio si è riempito di pazienti inventate, che spariscono quando esci dalla guida. Qui le gravidanze in corso, con l'epoca e i giorni alla data presunta del parto.",
    },

    // ── La paziente ────────────────────────────────────────────────────
    {
      id: "apri-visita",
      capitolo: "La paziente",
      tipo: "prova",
      bersagli: [g("nuova-visita")],
      punta: [g("nuova-visita")],
      titolo: "Arriva una paziente",
      testo: `È la signora ${cognome}, per il controllo della gravidanza. Si comincia sempre da qui: premi ${mod}+N, oppure il pulsante «Nuova Visita».`,
      tasti: [mod, "N"],
      consentiti: ["n"],
      fatto: (c) => c.esiste(g("pannello-paziente")),
    },
    {
      id: "cerca",
      capitolo: "La paziente",
      tipo: "prova",
      bersagli: [g("pannello-paziente")],
      titolo: "Cercala per cognome",
      testo: `Scrivi ${cognome}, o anche solo le prime lettere, poi fai clic sul suo nome: si apre la sua scheda.`,
      scrivi: { selettore: `${g("pannello-paziente")} input`, testo: cognome },
      // La manina compare sulla paziente appena la ricerca la trova.
      punta: [RISULTATO_PAZIENTE_DELLA_PROVA],
      fatto: (c) => c.percorso === `/patient-history/${PAZIENTE_DELLA_PROVA.id}`,
      perso: (c) => (c.percorso === "/" && !c.esiste(g("pannello-paziente")) ? "apri-visita" : null),
    },
    {
      id: "nuova-visita",
      capitolo: "La paziente",
      tipo: "prova",
      bersagli: [g("nuova-visita-scheda")],
      punta: [g("nuova-visita-scheda")],
      titolo: "La sua scheda",
      testo:
        "Qui le sue visite, ricette ed esami: tre controlli dall'inizio della gravidanza. Premi «Nuova visita».",
      fatto: (c) => pazienteDellaVisita(c) !== null,
      perso: (c) => (c.percorso === "/" ? "apri-visita" : null),
    },
    {
      id: "ostetrica",
      capitolo: "La visita",
      tipo: "prova",
      // Solo la riga delle schede: il marcatore avvolge anche la maschera
      // sotto, e illuminata tutta il fumetto finiva sopra la scheda da scegliere.
      bersagli: [`${g("schede-visita")} [role="tablist"]`],
      punta: [`${g("schede-visita")} [data-key="ostetrica"]`],
      titolo: "Una visita ostetrica",
      testo: "È al sesto mese: scegli «Visita Ostetrica». Con «Copia visita precedente», in alto, ritrovi datazione e storia dell'ultimo controllo.",
      fatto: (c) => c.esiste(g("card-biometria")),
      perso: (c) => (pazienteDellaVisita(c) === null && !c.percorso.startsWith("/patient-history/") ? "apri-visita" : null),
    },
    {
      id: "biometria",
      capitolo: "La visita",
      tipo: "guarda",
      bersagli: [g("card-biometria")],
      titolo: "La biometria",
      testo:
        "Scritti DBP, CC, CA e FL, percentili e peso fetale si calcolano da soli. Nel referto escono con le barre dei percentili, e le curve di crescita mettono in fila i controlli della gravidanza.",
      perso: fuoriDallaVisitaOstetrica,
    },

    // ── Il referto ─────────────────────────────────────────────────────
    {
      id: "modello",
      capitolo: "Il referto",
      tipo: "prova",
      bersagli: [g("campo-esame-obiettivo"), '[role="menu"]'],
      punta: ['[role="menu"] [role="menuitem"]', `${g("campo-esame-obiettivo")} button`],
      titolo: "Un modello, un clic",
      testo:
        "I modelli sono testi pronti. Premi «Modello» accanto a Visita / Ecografia Office e scegli «Eco III Trimestre».",
      fatto: (c) => c.testo(CAMPO_ESAME_OBIETTIVO).trim().length > 0,
      perso: fuoriDallaVisitaOstetrica,
    },
    {
      id: "grassetto",
      capitolo: "Il referto",
      tipo: "prova",
      bersagli: [g("campo-esame-obiettivo")],
      demo: "grassetto",
      titolo: "Metti in risalto",
      testo: `Il testo è tuo: correggilo come vuoi. Ora seleziona qualche parola e premi ${mod}+B. Nel referto stampato esce in grassetto.`,
      tasti: [mod, "B"],
      fatto: (c) =>
        c.esiste(`${CAMPO_ESAME_OBIETTIVO} b`) || c.esiste(`${CAMPO_ESAME_OBIETTIVO} strong`),
      perso: fuoriDallaVisitaOstetrica,
    },
    {
      id: "stampa",
      capitolo: "Il referto",
      tipo: "prova",
      bersagli: [g("stampa-visita")],
      punta: [g("stampa-visita")],
      titolo: "Stampa il referto",
      testo:
        "Premi «Stampa» e rispondi «Sì» al grafico di crescita: la visita si salva e il referto si apre in PDF, con il tuo studio in testa, il grassetto dove l'hai messo e le curve di crescita.",
      fatto: (c) => c.eventi.has(EVENTO_REFERTO_APERTO),
    },
    {
      id: "salva-visita",
      capitolo: "Il referto",
      tipo: "prova",
      bersagli: [g("salva-visita")],
      punta: [g("salva-visita")],
      titolo: "Chiudi la visita",
      testo: "Guardato il referto, torna qui e premi «Salva Visita».",
      fatto: (c) => c.percorso.startsWith("/patient-history/"),
    },
    {
      id: "scheda",
      capitolo: "Il referto",
      tipo: "guarda",
      bersagli: [g("scheda-documenti")],
      titolo: "Ricette, esami e certificati",
      testo:
        "La visita di oggi è in cima alle sue visite: la riapri, la ristampi, la ricopi nella prossima. Qui accanto ricette, richieste di esame e certificati, ognuno con i suoi modelli.",
    },

    // ── I modelli ──────────────────────────────────────────────────────
    {
      id: "vai-modelli",
      capitolo: "I modelli",
      tipo: "prova",
      bersagli: [g("impostazioni")],
      punta: [g("impostazioni")],
      titolo: "I tuoi modelli",
      testo:
        "Il modello di prima è uno di quelli che trovi già pronti: li cambi e ne aggiungi di tuoi. Apri Impostazioni.",
      fatto: (c) => c.percorso === "/settings",
    },
    {
      id: "modelli",
      capitolo: "I modelli",
      tipo: "guarda",
      bersagli: [g("modelli-categorie")],
      titolo: "I tipi di modello",
      testo:
        "Ginecologia e Ostetricia: i testi dei campi della visita, come quello che hai usato. Terapie: le frasi per le conclusioni. Ricette, Esami e Certificati: i documenti che fai dalla scheda della paziente.",
    },
    {
      id: "nuovo-modello",
      capitolo: "I modelli",
      tipo: "prova",
      bersagli: [g("nuovo-modello")],
      punta: [g("nuovo-modello")],
      titolo: "Preparane uno",
      testo:
        "Premi «Nuovo modello». Scegli il tipo e la sezione, dai un nome e scrivi il testo.",
      fatto: (c) => c.esiste(g("editor-modello")),
    },
    {
      id: "editor-modello",
      capitolo: "I modelli",
      tipo: "attesa",
      bersagli: [g("editor-modello")],
      titolo: "Crea il modello o chiudi con Annulla",
      testo: "Poi finiamo.",
      fatto: (c) => !c.esiste(g("editor-modello")),
    },
  ];
}
