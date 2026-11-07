import jsPDF from "jspdf";
import {
  Patient, Visit, Doctor,
  type Ambulatorio,
  RichiestaEsameComplementare,
  CertificatoPaziente,
  RicettaPaziente,
  type DocumentoStampa,
  type ModelloStampa,
  type SezioneReferto,
} from "../types/Storage";
import { DoctorService, ModelliStampaService, PreferenceService } from "./OfflineServices";
import { modelloPredefinito, titoloPredefinitoSezione, type DocumentoReferto } from "../utils/modelliStampa";
import {
  normalizeSignatureStampImage,
  signatureStampPdfFormat,
  SIGNATURE_STAMP_PDF_LAYOUT_W,
  SIGNATURE_STAMP_PDF_LAYOUT_H,
} from "../utils/signatureStamp";
import {
  ALL_ANAMNESI_CAMPO_KEYS,
  hasAnamnesiStrutturataContent,
  resolveAnamnesiLabel,
  parseAnamnesiConfig,
} from "../utils/anamnesiStrutturata";
import { getRicettaTesto } from "../utils/ricettaTemplate";
import { MARCATORE_GRASSETTO } from "../utils/grassettoReferto";
import { titoloMedico } from "../utils/doctorProfile";
import { calcolaStimePesoFetale } from "../utils/fetalWeightUtils";
import {
  estimateCentileRank,
  formatCentileLabel,
  getCentileForWeight,
  getGrowthCategory,
  getWeightPercentiles,
  parseGestationalWeeks,
} from "../utils/fetalGrowthCentiles";
import { getUmbilicalPiRef, getUmbilicalRiRef } from "../utils/flussimetriaUtils";
import { getBiometryReferenceAtGa, type BiometryParam } from "../utils/biometryCentiles";
import {
  bmiBand,
  computeBmi,
  computeHomaIr,
  formatBmiWithBand,
  formatHomaIrWithBand,
  homaIrBand,
} from "../utils/metabolicIndices";

// Il motore e' lo stesso di Corioli Cardiologia, dove e' nato: le decisioni
// d'impaginazione che i commenti attribuiscono al cardiologo vengono da li', e
// valgono per tutti i referti di Corioli. Qui ci sono in piu' le sezioni della
// visita ginecologica e ostetrica (vedi `sezioniGinecologiche` e
// `sezioniOstetriche`).

// ─── Layout ──────────────────────────────────────────────────────────────────
//
// Margini a 18 mm invece di 15. Il foglio A4 e' largo 210 e la colonna resta
// centrata; i tre millimetri in piu' per lato sono tolleranza di stampa: fra
// l'area non stampabile della macchina e il trascinamento del foglio, una
// stampa leggermente fuori centro con margini stretti mangia del testo. Con 18
// la stessa deriva mangia solo bianco.
//
// Margini, foglio, carattere e colori sono variabili dal giorno dei modelli di
// stampa: `impostaModello` le assegna all'inizio di ogni documento secondo il
// modello scelto, e con il predefinito valgono quello che valevano quando erano
// costanti. Le generazioni non si accavallano mai (vedi `PdfService.inFila`),
// quindi un documento non vede mai i margini di un altro.
let ML = 18;
let MR = 192;
let PW = MR - ML;   // 174 mm
/** Larghezza del foglio e suo asse: 210 e 105 sull'A4. */
let PAGE_W = 210;
let CX = PAGE_W / 2;
/** Spaziatura fra le lettere del titolo del documento, in millimetri. */
const SPAZIATURA_TITOLO = 0.7;
let PAGE_H = 297;
let FOOT_Y = PAGE_H - 14;
/**
 * Fin dove puo' scendere il contenuto: otto millimetri sopra il filetto del
 * piede, piu' le righe del testo libero del piede quando il modello ne ha.
 */
let LIMITE = FOOT_Y - 8;
/**
 * Spazio lasciato libero in cima a ogni foglio per la carta gia' intestata:
 * zero quando l'intestazione la stampa Corioli.
 */
let ALTO = 0;
/** Dove riprende il contenuto sulle pagine dopo la prima (referto e altri). */
let INIZIO_SEGUENTI_REFERTO = 24;
let INIZIO_SEGUENTI = 18;
/** Il carattere di tutto il documento: Helvetica, o Times nei modelli che lo scelgono. */
let F = "helvetica";
const LH = 4.8;
// Interlinea della prosa clinica in corpo 10,5: circa 1,4 volte il corpo.
// Era 6,1 mm e, con l'aria sotto le fasce e fra le righe delle tabelle, un
// referto normale arrivava a tre pagine: "spaziature eccessive", il
// cardiologo l'11 settembre 2026.
let LH_PROSA = 5.2;
/** Corpo della prosa: 10,5, o quello della grandezza scelta nel modello. */
let CORPO = 10.5;
/** Dal filo del contenuto alla linea di base della prima riga di prosa. */
const PRIMA_RIGA_PROSA = 3.9;
/** Altezza della fascia grigia dei titoli di sezione. */
const FASCIA_H = 5.6;
/**
 * Righe che una tabella deve avere su ciascun lato di un salto pagina: una
 * riga sola sotto il titolo in fondo alla pagina, o sola in cima alla pagina
 * dopo, e' un orfano. Le tabelle che non arrivano al doppio non si spezzano.
 */
const RIGHE_MINIME = 2;
/**
 * Aria fra il filo inferiore della fascia e il contenuto della sezione.
 *
 * Era 1,3 mm: il titolo e la prima riga si toccavano quasi, e "CONCLUSIONI E
 * TERAPIA" sembrava incollato al testo che apriva. Vale per tutte le sezioni,
 * prosa e tabelle, perche' pesano uguale.
 */
const ARIA_SOTTO_FASCIA = 2.5;

/**
 * Riquadri dell'inquadramento clinico: aria fra l'uno e l'altro, margine
 * interno, altezza del nome con il suo filetto, aria in fondo e interlinea
 * delle etichette.
 */
const RIQ_SPAZIO = 4;
const RIQ_PAD = 3.5;
const RIQ_TESTATA = 8.4;
const RIQ_FONDO = 2.2;
const RIQ_LH_ETICHETTA = 3.6;

// ─── B&W palette ─────────────────────────────────────────────────────────────
const K0 = [0, 0, 0] as const;
const K30: [number, number, number] = [30, 30, 30];
const K80: [number, number, number] = [80, 80, 80];
const K140: [number, number, number] = [140, 140, 140];
const K200: [number, number, number] = [200, 200, 200];
const K235: [number, number, number] = [235, 235, 235];

/**
 * I colori del modello: la fascia dei titoli, i filetti e il nome del medico,
 * il testo dei titoli. In bianco e nero sono i grigi di sempre; gli altri sono
 * tinte scure, che restano leggibili anche quando il colore lo stampa una
 * laser in bianco e nero.
 */
type Tinta = { fascia: readonly number[]; accento: readonly number[]; titoli: readonly number[] };
const COLORI: Record<"nero" | "blu" | "verde" | "bordeaux", Tinta> = {
  nero: { fascia: K235, accento: K0, titoli: K0 },
  blu: { fascia: [223, 234, 246], accento: [24, 95, 165], titoli: [12, 68, 124] },
  verde: { fascia: [222, 241, 233], accento: [15, 110, 86], titoli: [8, 80, 65] },
  bordeaux: { fascia: [246, 226, 233], accento: [140, 40, 75], titoli: [110, 30, 58] },
};
let FASCIA: readonly number[] = K235;
let ACCENTO: readonly number[] = K0;
let TITOLI: readonly number[] = K0;

const BIANCO = [255, 255, 255] as const;

/** Da `a` verso `b` per la frazione `t`: le tinte tenui sono il colore verso il bianco. */
function mescola(a: readonly number[], b: readonly number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function daEsadecimale(h: string | undefined): number[] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((h ?? "").trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

/**
 * Le tinte di un colore del modello: quelle della tavolozza come sono sempre
 * state, o ricavate da un colore libero: la fascia e' il colore quasi bianco,
 * i titoli un po' piu' scuri del colore, perche' si leggano anche in
 * fotocopia.
 */
function tavolozza(colore: string): Tinta {
  const pronta = COLORI[colore as keyof typeof COLORI];
  if (pronta) return pronta;
  const c = daEsadecimale(colore) ?? [0, 0, 0];
  return { fascia: mescola(c, BIANCO, 0.88), accento: c, titoli: mescola(c, K0, 0.2) };
}

/**
 * Il secondo colore (specializzazione, sottotitoli, valori fuori norma) e la
 * sua tinta tenue; senza secondo colore e' il principale. `TENUE` e' il
 * colore dei filetti e dei bordi nello stile moderno.
 */
let SECONDO: readonly number[] = K0;
let SECONDO_TINTA: readonly number[] = K235;
let TENUE: readonly number[] = K200;
/** Stile moderno, angoli arrotondati, valori fuori norma a colori: vedi `ModelloStampa.pagina`. */
let MODERNO = false;
let TONDI = false;
let EVIDENZA_COLORE = false;
/**
 * Moderno con i valori fuori norma a colori: tutti i valori in grassetto,
 * come nel referto d'esempio, perche' a distinguere quelli fuori norma ci
 * pensa il colore. Con il grassetto come evidenza resterebbero tutti uguali.
 */
let VALORI_GRASSETTO = false;

/** Lato, caricato solo quando un modello lo usa (vedi `caricaLato`). */
let LATO: typeof import("../assets/fonts/lato") | null = null;
async function caricaLato(): Promise<void> {
  LATO ??= await import("../assets/fonts/lato");
}

/** Corpo della prosa per grandezza: il "normale" e' quello di sempre. */
const CORPI: Record<ModelloStampa["pagina"]["testo"], number> = {
  piccolo: 9.5,
  normale: 10.5,
  grande: 11.5,
};
/** Margini laterali per formato: i "normali" dell'A4 sono i 18 mm di sempre. */
const MARGINI: Record<ModelloStampa["pagina"]["formato"], Record<ModelloStampa["pagina"]["margini"], number>> = {
  A4: { stretti: 14, normali: 18, larghi: 24 },
  A5: { stretti: 10, normali: 13, larghi: 17 },
};

/** Il riquadro del logo nell'intestazione, in mm: cima, altezza e larghezza massime. */
const LOGO_TOP = 9;
let LOGO_H = 14;
let LOGO_W = 36;
/** Altezza e larghezza massime del logo per grandezza: il "medio" e' quello di sempre. */
const GRANDEZZE_LOGO: Record<ModelloStampa["intestazione"]["grandezzaLogo"], [number, number]> = {
  piccolo: [10, 26],
  medio: [14, 36],
  grande: [20, 50],
};
/** Larghezza dell'immagine della firma: la "normale" e' quella di sempre. */
const LARGHEZZE_FIRMA: Record<ModelloStampa["firma"]["grandezza"], number> = {
  piccola: 38,
  normale: 48,
  grande: 60,
};

function formatoImmagine(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
}

/** Il testo libero del piede: corpo, interlinea e righe al massimo. */
const PIEDE_CORPO = 7;
const PIEDE_RIGA = 3.2;
const PIEDE_RIGHE = 2;

/**
 * Assegna l'impaginazione del modello alle variabili di layout. Con il
 * predefinito ridà i valori di sempre: `generateVisitPDF` senza modello stampa
 * lo stesso PDF di prima che i modelli ci fossero.
 */
function impostaModello(m: ModelloStampa): void {
  const formato = m.documento === "referto" ? "A4" : m.pagina.formato;
  PAGE_W = formato === "A5" ? 148 : 210;
  PAGE_H = formato === "A5" ? 210 : 297;
  CX = PAGE_W / 2;
  ML = MARGINI[formato][m.pagina.margini];
  MR = PAGE_W - ML;
  PW = MR - ML;
  const carta = m.intestazione.cartaIntestata;
  ALTO = carta ? m.intestazione.spazioAlto : 0;
  FOOT_Y = PAGE_H - 14 - (carta ? m.intestazione.spazioBasso : 0);
  LIMITE = FOOT_Y - 8 - righePiede(m).length * PIEDE_RIGA;
  INIZIO_SEGUENTI = ALTO + 18;
  // Senza la riga del paziente in testa, le pagine seguenti partono dove
  // partono quelle degli altri documenti.
  INIZIO_SEGUENTI_REFERTO = ALTO + (m.piede.pazienteSullePagine ? 24 : 18);
  // Se Lato non si e' caricato si ripiega su Helvetica: un PDF col carattere
  // sbagliato e' meglio di nessun PDF.
  F = m.pagina.carattere === "lato" && !LATO ? "helvetica" : m.pagina.carattere;
  CORPO = CORPI[m.pagina.testo];
  LH_PROSA = 5.2 * (CORPO / 10.5);
  const tinta = tavolozza(m.pagina.colore);
  FASCIA = tinta.fascia;
  ACCENTO = tinta.accento;
  TITOLI = tinta.titoli;
  SECONDO = daEsadecimale(m.pagina.accento) ?? tinta.accento;
  SECONDO_TINTA = mescola(SECONDO, BIANCO, 0.86);
  TENUE = m.pagina.colore === "nero" ? K200 : mescola(tinta.accento, BIANCO, 0.6);
  MODERNO = m.pagina.stile === "moderno";
  TONDI = m.pagina.angoli === "arrotondati";
  EVIDENZA_COLORE = m.pagina.evidenza === "colore";
  VALORI_GRASSETTO = MODERNO && EVIDENZA_COLORE;
  [LOGO_H, LOGO_W] = GRANDEZZE_LOGO[m.intestazione.grandezzaLogo];
}

/** Le righe del testo libero del piede, al massimo due. */
function righePiede(m: ModelloStampa): string[] {
  return m.piede.testo
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, PIEDE_RIGHE);
}


/**
 * Una colonna dell'inquadramento ("Datazione", "Storia ostetrica"...) pronta
 * per il suo riquadro: il nome, le righe etichetta | valore e, se c'e', un
 * testo sotto. Vedi `ModelloStampa.inquadramentoInRiquadri`.
 */
interface SchedaInquadramento {
  titolo: string;
  /** Vuote solo per la sintesi del rischio senza classe: li' c'e' il solo testo. */
  righe: RigaScheda[];
  testo?: string;
}
interface RigaScheda {
  label: string;
  value: string;
  forte?: boolean;
  /**
   * La classe di rischio, che nei riquadri sta in una pillola: accesa, nel
   * secondo colore, per le classi alte, come il referto d'esempio di Pablo.
   */
  pillola?: "accesa" | "tenue";
}

export interface FetalGrowthPoint {
  gaWeeks: number;
  pesoGrammi: number;
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
}

interface VisitPdfOptions {
  /** Allega al referto le immagini dell'ecografia. */
  includeEcografiaImages?: boolean;
  /** Referto ostetrico: le curve di crescita biometrica. */
  includeFetalGrowthChart?: boolean;
  fetalGrowthDataPoints?: FetalGrowthPoint[];
  /** Il modello con cui stamparlo; senza, quello in uso. */
  modello?: ModelloStampa;
}

/** Sotto l'ecografia office, nei due referti. */
const NOTA_SIEOG =
  "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";

/**
 * Una parte del foglio, in millimetri dalla cima della pagina: e' quello che
 * l'editor dei modelli rende cliccabile sopra l'anteprima.
 */
export interface ZonaStampa {
  zona: "intestazione" | "titolo" | "paziente" | "sezione" | "firma" | "piede";
  sezione?: SezioneReferto;
  pagina: number;
  y0: number;
  y1: number;
}

/** Un documento impaginato con le sue zone e le misure del foglio. */
export interface DocumentoImpaginato {
  blob: Blob;
  pagine: number;
  zone: ZonaStampa[];
  larghezza: number;
  altezza: number;
  ml: number;
  mr: number;
}
interface FooterVisibilityOptions {
  showDoctorPhoneInPdf?: boolean;
  showDoctorEmailInPdf?: boolean;
}

// ─── Sanitizer + utils ────────────────────────────────────────────────────────

/**
 * I caratteri tipografici che WinAnsi colloca nella fascia 0x80-0x9F.
 *
 * In Unicode stanno sopra 0xFF, ma il font li sa scrivere: senza questo
 * elenco la rete di sicurezza di `san` li scambierebbe per caratteri non
 * rappresentabili e li sostituirebbe con un punto interrogativo. E' successo
 * con il trattino lungo delle categorie CAD-RADS.
 */
const WINANSI_ALTI = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/**
 * Simboli che il font standard di jsPDF non sa scrivere.
 *
 * Il font usa la codifica WinAnsi: un carattere fuori da quella tabella fa
 * ripiegare jsPDF su UTF-16 per **tutta** la stringa. Il danno e' doppio e si
 * e' visto in ambulatorio sul calcium score: il testo esce illeggibile
 * ("Agatston BOM e 300") e, siccome `splitTextToSize` misura la stringa come
 * se fosse a un byte per carattere, la riga viene mandata a capo sulla misura
 * sbagliata e sborda oltre il margine destro del foglio.
 *
 * Qui stanno i simboli che l'applicazione produce davvero: le soglie con il
 * maggiore-uguale sono ovunque, dalle fasce Agatston ai fenotipi dello
 * scompenso.
 */
const SIMBOLI: Record<string, string> = {
  "\u2265": ">=", "\u2264": "<=", "\u2260": "!=", 
  "\u2081": "1", "\u2082": "2", "\u2083": "3",
  "\u2192": "->", "\u2190": "<-", "\u00a0": " ",
};

/** Un tratto di testo con il suo peso: e' l'unita' che il PDF disegna. */
type TrattoTesto = { testo: string; grassetto: boolean };

/** Carattere, peso, corpo e colore con cui `block` scrive la prosa. */
type StileTesto = {
  font?: string;
  style?: "normal" | "bold" | "italic";
  fontSize?: number;
  color?: readonly number[];
};

/**
 * Da testo con i marcatori a paragrafi di parole, ciascuna col suo peso.
 *
 * Gli spazi restano come parole a se': servono a misurare la riga e a sapere
 * dove si puo' andare a capo. Un marcatore che non si chiude resta testo, come
 * nei messaggi: chi scrive "vedi ** nota" non voleva il grassetto.
 */
function trattiPerParagrafo(testo: string): TrattoTesto[][] {
  return testo.split("\n").map((paragrafo) => {
    const parole: TrattoTesto[] = [];
    // Divide su `**`: i pezzi in posizione dispari stanno fra due marcatori,
    // cioe' sono quelli da mettere in grassetto. Con un marcatore spaiato
    // l'ultimo pezzo resta senza chiusura e torna testo normale.
    const pezzi = paragrafo.split(MARCATORE_GRASSETTO);
    const chiusi = pezzi.length % 2 === 1;
    pezzi.forEach((pezzo, i) => {
      const grassetto = chiusi && i % 2 === 1;
      const testoPezzo =
        !chiusi && i > 0 ? `${MARCATORE_GRASSETTO}${pezzo}` : pezzo;
      for (const parola of testoPezzo.split(/(\s+)/)) {
        if (parola) parole.push({ testo: parola, grassetto });
      }
    });
    return parole;
  });
}

/**
 * Prepara il testo per il font standard di jsPDF.
 *
 * Le vocali accentate passano cosi' come sono: stanno nella codifica WinAnsi
 * (à = 0xE0, è = 0xE8...) e Helvetica le disegna, tondo e grassetto. Fino al
 * settembre 2026 venivano cambiate in apostrofo ("eta'", "attivita'") sulla
 * convinzione che il font non le sapesse scrivere: il referto, che e' il
 * documento che gira fra colleghi, usciva scritto male senza motivo.
 *
 * Esportata per essere coperta dai test: un errore qui non si vede finche'
 * qualcuno non stampa un referto.
 */
export function san(t: string): string {
  if (!t) return "";
  // Testo UTF-8 riletto come Latin-1 ("Ã¨" al posto di "è"), per esempio da
  // un CSV importato con la codifica sbagliata: si ricompone la lettera.
  // Prima dei simboli, che cambierebbero lo spazio non separabile che segue la A con la tilde.
  t = t.replace(/\u00c3([\u00a0\u00a8\u00a9\u00ac\u00b2\u00b9])/g, (_, c: string) =>
    String.fromCharCode(c.charCodeAt(0) + 0x40),
  );
  for (const [simbolo, ascii] of Object.entries(SIMBOLI)) {
    if (t.includes(simbolo)) t = t.split(simbolo).join(ascii);
  }
  let r = "";
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    // Rete di sicurezza: qualunque altro carattere fuori dalla tabella a un
    // byte farebbe ripiegare jsPDF su UTF-16 e romperebbe la riga intera. Si
    // prova la scomposizione Unicode (e' quella che riduce "ﬁ" a "fi"), e solo
    // se non resta niente di stampabile si lascia un punto interrogativo:
    // meglio un carattere sbagliato che una riga illeggibile fuori margine.
    if (c > 255 && !WINANSI_ALTI.has(c)) {
      const piano = t[i].normalize("NFKD").replace(/[^\x20-\xFF]/g, "");
      r += piano || "?";
      continue;
    }
    r += t[i];
  }
  return r;
}

/**
 * `san` per i valori delle tabelle, con la virgola decimale.
 *
 * I valori scritti dal medico arrivano come numeri e si stampavano con
 * `${n}`, cioe' col punto ("Creatinina 1.2 mg/dL"), mentre quelli calcolati
 * passano da un formattatore italiano ("CT / HDL 5,0"): nella stessa tabella
 * degli ematochimici c'erano i due separatori, e a schermo la virgola.
 * Convertire qui, dove si disegnano le celle, copre anche i campi futuri.
 *
 * Solo le tabelle: la prosa del referto la scrive il medico e resta com'e'.
 */
export function sanValore(t: string): string {
  return san(t).replace(/(\d)\.(\d)/g, "$1,$2");
}

function fd(d: string): string {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("it-IT");
}
function fmt2(x: number | null | undefined): string {
  if (x === null || x === undefined || !isFinite(x)) return "-";
  return x.toFixed(2).replace(".", ",");
}
function calcAge(dob: string): string {
  if (!dob) return "";
  const b = new Date(dob); if (isNaN(b.getTime())) return "";
  const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return String(a);
}
function v(x: string | number | undefined | null, fb = "-"): string {
  return (x === undefined || x === null || String(x).trim() === "") ? fb : String(x);
}

/** True se il valore mostrato indica "campo non inserito": la riga non va stampata nel PDF. */
function isInquadramentoValueEmpty(val: string): boolean {
  if (!val || String(val).trim() === "") return true;
  const s = String(val).trim();
  if (s === "-") return true;
  if (s === "0") return true;
  // Storia ostetrica e parametri materni senza dati, composti in una riga.
  if (s === "0 (0 PS, 0 TC)" || s === "0 (0 AS, 0 IVG)") return true;
  if (s === "- / -" || s === "- / - kg") return true;
  if (s === "- fumo, - acido folico") return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
export class PdfService {

  /**
   * Contesto del piede di pagina durante la generazione.
   *
   * `differita` serve al referto di visita: la numerazione "Pagina 2 di 3" non
   * si puo' scrivere mentre si impagina, perche' il totale si conosce solo alla
   * fine. Con la stampa differita i piedi si disegnano tutti insieme in coda,
   * quando il documento e' chiuso.
   */
  /** Vedi `generateVisitPDF`: spento, le tabelle si spezzano dove capita. */
  private static controlloOrfani = true;

  private static fCtx: {
    doctor: Doctor | null;
    opts: FooterVisibilityOptions;
    differita?: boolean;
  } | null = null;

  /** Il modello del documento che si sta impaginando (vedi `impostaModello`). */
  private static m: ModelloStampa = modelloPredefinito("referto");

  /**
   * Le zone del foglio, raccolte solo per l'anteprima dell'editor dei modelli:
   * fuori dall'editor e' `null` e non si registra niente.
   */
  private static zone: ZonaStampa[] | null = null;

  private static segnaZona(
    doc: jsPDF, zona: ZonaStampa["zona"], y0: number, y1: number, sezione?: SezioneReferto,
  ) {
    if (!this.zone || y1 <= y0) return;
    this.zone.push({ zona, pagina: doc.getNumberOfPages(), y0, y1, ...(sezione ? { sezione } : {}) });
  }

  /**
   * Una generazione alla volta. Lo stato dell'impaginazione e' statico (i
   * margini del modello, il piede differito, la traccia dei salti) e i
   * documenti si disegnano con delle attese in mezzo — il profilo, le
   * immagini: due PDF chiesti insieme, come fa l'anteprima dell'editor mentre
   * si scrive, si sarebbero mescolati i margini.
   */
  private static fila: Promise<unknown> = Promise.resolve();

  private static inFila<T>(lavoro: () => Promise<T>): Promise<T> {
    const turno = this.fila.then(lavoro, lavoro);
    this.fila = turno.catch(() => undefined);
    return turno;
  }

  /** Il modello scelto, o quello in uso; il predefinito se l'archivio non risponde. */
  private static async modelloPer(
    documento: DocumentoStampa, scelto?: ModelloStampa,
  ): Promise<ModelloStampa> {
    if (scelto) return scelto;
    try {
      return await ModelliStampaService.getModelloInUso(documento);
    } catch {
      return modelloPredefinito(documento);
    }
  }

  /** Il titolo della sezione del referto: quello del modello o quello di Corioli. */
  private static tit(id: SezioneReferto): string {
    return this.m.sezioni.find((s) => s.id === id)?.titolo.trim() || titoloPredefinitoSezione(id, this.m.documento);
  }

  private static dc(d: jsPDF, c: readonly number[]) { d.setDrawColor(c[0], c[1], c[2]); }
  private static tc(d: jsPDF, c: readonly number[]) { d.setTextColor(c[0], c[1], c[2]); }

  /**
   * Referto: le chiamate a `pb` in ordine, con la pagina su cui e' finito
   * quello che segue e `apre` per quelle che aprono un blocco (titolo di
   * sezione, referto di un modulo) e vogliono almeno due righe con se'. Serve
   * a non lasciare la firma sola su una pagina: vedi `componiReferto`. Fuori
   * dal referto e' `null` e non si registra niente.
   */
  private static tracciaSalti: { apre: boolean; pagina: number }[] | null = null;
  /** Referto: la chiamata a `pb`, come indice in `tracciaSalti`, che va a capo comunque. */
  private static saltoForzato: number | null = null;

  // ── page break ───────────────────────────────────────────────────────────────
  private static pb(doc: jsPDF, y: number, need = 30, apre = false): number {
    const chiamata = this.tracciaSalti ? this.tracciaSalti.length : -1;
    // In cima alla pagina andare a capo darebbe solo una pagina bianca.
    const inizio = this.fCtx?.differita ? INIZIO_SEGUENTI_REFERTO : INIZIO_SEGUENTI;
    const inCima = y <= inizio;
    const forzato = chiamata >= 0 && chiamata === this.saltoForzato && !inCima;
    if (forzato || y + need > LIMITE) {
      if (this.fCtx && !this.fCtx.differita) {
        this.drawFooter(doc, this.fCtx.doctor, this.fCtx.opts);
      }
      doc.addPage();
      this.disegnaSfondo(doc);
      // Sulle pagine dopo la prima il contenuto scende: sopra ci va la riga di
      // identificazione del paziente, scritta poi da `finalizzaPagine`.
      y = inizio;
    }
    this.tracciaSalti?.push({ apre, pagina: doc.getNumberOfPages() });
    return y;
  }

  /**
   * Una riga che deve restare una (il nome del medico, un recapito, il
   * titolo) e stare in `larghezza`. Se ci sta, `disegna` la scrive come
   * sempre; se no il corpo scende fino a due terzi e, se non basta, la riga
   * si accorcia con i puntini. Prima usciva dal foglio: un nome lungo, o la
   * specializzazione scritta per intero, passava il margine destro, e sul
   * mezzo foglio della ricetta di quattro centimetri. Alla fine il corpo
   * torna quello di prima.
   *
   * `disegna` riceve la riga e la sua larghezza, spaziatura compresa, per chi
   * la centra da se'.
   */
  private static rigaCheSta(
    doc: jsPDF, testo: string, larghezza: number,
    disegna: (riga: string, larghezzaRiga: number) => void, charSpace = 0,
  ): void {
    const misura = (t: string) => doc.getTextWidth(t) + charSpace * Math.max(t.length - 1, 0);
    if (misura(testo) <= larghezza) {
      disegna(testo, misura(testo));
      return;
    }
    const corpo = doc.getFontSize();
    let c = corpo;
    while (c - 0.25 >= corpo * 0.67 && misura(testo) > larghezza) {
      c -= 0.25;
      doc.setFontSize(c);
    }
    let riga = testo;
    if (misura(riga) > larghezza) {
      while (riga.length > 1 && misura(`${riga.trimEnd()}...`) > larghezza) riga = riga.slice(0, -1);
      riga = `${riga.trimEnd()}...`;
    }
    disegna(riga, misura(riga));
    doc.setFontSize(corpo);
  }

  // ── multiline text block ─────────────────────────────────────────────────────
  /** textStyle: ripristina font/size/colore prima di ogni riga (necessario dopo salto pagina, perché drawFooter cambia lo stile). */
  private static block(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh = LH,
    textStyle?: StileTesto,
    /**
     * Falso dentro un riquadro: chi lo disegna ha gia' misurato il testo con
     * `righeBlock` e fatto spazio, e un salto pagina a meta' lo spezzerebbe.
     */
    salti = true,
  ): number {
    if (!text?.trim()) return y;

    // Il carattere si imposta **prima** di mandare a capo, non solo prima di
    // scrivere: `splitTextToSize` misura con il font corrente, e il font
    // corrente era quello lasciato dall'ultima cosa disegnata — di solito
    // l'Helvetica 7 di un'etichetta di tabella. La prosa veniva quindi spezzata
    // sulla misura di un carattere piu' stretto e poi scritta in Times 10,5:
    // le righe uscivano fino a un centimetro e mezzo oltre il margine destro,
    // e nel testo estratto dal PDF non si vedeva perche' le parole c'erano
    // tutte.
    const applica = this.applicaStile(doc, textStyle);

    const testo = san(text);

    applica();
    // Senza marcatori si resta sulla via breve: e' quella che disegna quasi
    // tutto il referto, e il ritorno a capo di jsPDF e' gia' quello giusto.
    if (!testo.includes(MARCATORE_GRASSETTO)) {
      const lines: string[] = doc.splitTextToSize(testo, maxW);
      for (const line of lines) {
        if (salti) y = this.pb(doc, y, lh + 1);
        // Da riapplicare a ogni riga: dopo un salto pagina il piede ha cambiato
        // font, corpo e colore.
        applica();
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    }

    return this.blockConGrassetto(doc, testo, x, y, maxW, lh, applica, textStyle, salti);
  }

  /** Le righe che `block` scriverebbe in `maxW`, senza scriverle. */
  private static righeBlock(
    doc: jsPDF, text: string | undefined, maxW: number, textStyle?: StileTesto,
  ): number {
    if (!text?.trim()) return 0;
    const testo = san(text);
    const applica = this.applicaStile(doc, textStyle);
    applica();
    if (!testo.includes(MARCATORE_GRASSETTO)) {
      return (doc.splitTextToSize(testo, maxW) as string[]).length;
    }
    return this.righeConGrassetto(doc, testo, maxW, this.pesoTratto(doc, applica, textStyle)).length;
  }

  /** Carattere, corpo e colore di `textStyle`, da riapplicare prima di misurare o scrivere. */
  private static applicaStile(doc: jsPDF, textStyle?: StileTesto): () => void {
    return () => {
      if (!textStyle) return;
      doc.setFont(textStyle.font ?? F, textStyle.style ?? "normal");
      if (textStyle.fontSize != null) doc.setFontSize(textStyle.fontSize);
      if (textStyle.color) this.tc(doc, textStyle.color);
    };
  }

  /**
   * La stessa prosa, con i tratti fra `**` in grassetto.
   *
   * Il ritorno a capo lo fa questo metodo e non `splitTextToSize`: le parole in
   * grassetto sono piu' larghe delle stesse in tondo, e misurando tutto con un
   * carattere solo le righe uscivano oltre il margine destro — lo stesso
   * difetto che il commento qui sopra racconta per il font sbagliato.
   *
   * Il marcatore e' quello che il medico digita nella maschera, o che il
   * pulsante grassetto gli mette attorno alla selezione: nel campo resta testo
   * semplice, sul foglio diventa un risalto.
   */
  private static blockConGrassetto(
    doc: jsPDF,
    testo: string,
    x: number,
    y: number,
    maxW: number,
    lh: number,
    applica: () => void,
    textStyle?: StileTesto,
    salti = true,
  ): number {
    const applicaTratto = this.pesoTratto(doc, applica, textStyle);
    for (const riga of this.righeConGrassetto(doc, testo, maxW, applicaTratto)) {
      // Un paragrafo vuoto e' una riga vuota voluta: la si salta in altezza
      // senza disegnare niente.
      if (!riga.length) {
        y += lh;
        continue;
      }
      if (salti) y = this.pb(doc, y, lh + 1);
      let cursore = x;
      for (const tratto of riga) {
        applicaTratto(tratto.grassetto);
        doc.text(tratto.testo, cursore, y);
        cursore += doc.getTextWidth(tratto.testo);
      }
      y += lh;
    }
    return y;
  }

  /** Imposta il peso di un tratto sopra lo stile del testo. */
  private static pesoTratto(
    doc: jsPDF, applica: () => void, textStyle?: StileTesto,
  ): (grassetto: boolean) => void {
    const famiglia = textStyle?.font ?? F;
    // Un testo gia' in grassetto (o in corsivo) non ha un "piu' grassetto":
    // li' il marcatore non cambia niente ed e' giusto che non cambi.
    const stileBase = textStyle?.style ?? "normal";
    return (grassetto: boolean) => {
      applica();
      doc.setFont(famiglia, grassetto && stileBase === "normal" ? "bold" : stileBase);
    };
  }

  /** Le righe di `blockConGrassetto`; una riga vuota e' un paragrafo vuoto. */
  private static righeConGrassetto(
    doc: jsPDF, testo: string, maxW: number, applicaTratto: (grassetto: boolean) => void,
  ): TrattoTesto[][] {
    const righe: TrattoTesto[][] = [];
    for (const paragrafo of trattiPerParagrafo(testo)) {
      let riga: TrattoTesto[] = [];
      let larghezza = 0;
      for (const parola of paragrafo) {
        applicaTratto(parola.grassetto);
        const w = doc.getTextWidth(parola.testo);
        const aCapo = larghezza + w > maxW && riga.length > 0;
        if (aCapo) {
          righe.push(riga);
          riga = [];
          larghezza = 0;
          // Lo spazio che ha fatto traboccare la riga non apre quella dopo:
          // rientrerebbe il testo di un carattere, a caso.
          if (!parola.testo.trim()) continue;
        }
        riga.push(parola);
        larghezza += w;
      }
      righe.push(riga);
    }
    return righe;
  }

  // ── horizontal rule ──────────────────────────────────────────────────────────
  private static rule(doc: jsPDF, y: number, x1 = ML, x2 = MR, lw = 0.2, colore: readonly number[] = K200) {
    this.dc(doc, colore); doc.setLineWidth(lw); doc.line(x1, y, x2, y);
  }

  /**
   * Il filetto sotto un titoletto: grigio in bianco e nero, del colore del
   * modello negli altri. Grigio sotto un titolo blu sembrava un errore.
   */
  private static filettoTitoletto(): readonly number[] {
    return this.m.pagina.colore === "nero" ? K200 : ACCENTO;
  }

  /**
   * Griglia "Inquadramento" in stile referto: titolo di sezione + N colonne,
   * ciascuna con sotto-intestazione su barra grigia e righe "Etichetta: valore".
   * Le righe con valore vuoto/zero ("-", "0", ...) vengono nascoste; se non resta
   * alcun dato la sezione non viene disegnata.
   */
  private static drawInquadramentoGrid(
    doc: jsPDF, y: number, title: string,
    columns: {
      header: string;
      /** Senza etichetta la voce e' una riga di elenco: il valore da solo. */
      items: { label?: string; value: string; forte?: boolean }[];
    }[],
  ): number {
    // Le colonne vuote non si stampano, nemmeno l'intestazione: "PARAMETRI
    // VITALI" senza niente sotto diceva che i parametri non erano stati
    // rilevati, quando era solo che la pressione ha una sezione sua. Le
    // colonne che restano si dividono la larghezza.
    const cols = columns
      .map((c) => ({
        header: c.header,
        items: c.items.filter((it) => !isInquadramentoValueEmpty(it.value)),
      }))
      .filter((c) => c.items.length > 0);
    if (cols.length === 0) return y;

    const colW = PW / cols.length;

    // Si misura tutto prima di disegnare. Dentro una colonna l'impaginazione
    // scorre in verticale senza mai chiedere un salto pagina: con la vecchia
    // riserva fissa di 40 mm, una colonna piu' lunga di quella scriveva sotto
    // il piede. Misurata l'altezza vera, la griglia o ci sta o scende intera
    // alla pagina dopo, titolo compreso.
    doc.setFontSize(8);
    const misurate = cols.map((c) =>
      c.items.map((item) => {
        doc.setFont(F, "normal");
        const lbl = item.label ? san(item.label) + ": " : "";
        const lblW = lbl ? doc.getTextWidth(lbl) : 0;
        // Le voci senza etichetta sono un elenco (i fattori di rischio): in tondo.
        doc.setFont(F, item.forte || (VALORI_GRASSETTO && lbl) ? "bold" : "normal");
        const linee: string[] = doc.splitTextToSize(
          sanValore(item.value), colW - lblW - 4,
        );
        return { lbl, lblW, linee };
      }),
    );
    // Voci a 4,2 mm in corpo 8. Erano a 4,8, l'interlinea della prosa, e in
    // tre colonne di voci brevi era solo bianco.
    const RIGA = 4.2;
    const altezza = 8.6 + Math.max(
      ...misurate.map((items) =>
        items.reduce((h, it) => h + it.linee.length * RIGA, 0),
      ),
    );

    y = this.sezione(doc, y, title, FASCIA_H + ARIA_SOTTO_FASCIA + altezza + 1);
    let maxY = y;

    for (let c = 0; c < cols.length; c++) {
      const cx = ML + c * colW;

      // Nello stile moderno le intestazioni delle colonne sono nel secondo colore.
      doc.setFont(F, "bold"); doc.setFontSize(6.8); this.tc(doc, MODERNO ? SECONDO : K80);
      doc.text(san(cols[c].header).toUpperCase(), cx, y + 3);
      this.rule(doc, y + 4.6, cx, cx + colW - 4, 0.2, MODERNO ? mescola(SECONDO, BIANCO, 0.45) : K200);

      let cy = y + 8.6;
      doc.setFontSize(8);

      cols[c].items.forEach((item, i) => {
        const { lbl, lblW, linee } = misurate[c][i];
        if (lbl) {
          doc.setFont(F, "normal"); this.tc(doc, K80);
          doc.text(lbl, cx, cy);
        }

        doc.setFont(F, item.forte || (VALORI_GRASSETTO && lbl) ? "bold" : "normal");
        this.tc(doc, EVIDENZA_COLORE && item.forte ? SECONDO : K0);
        // Piccolo margine fra etichetta e valore; senza etichetta il valore
        // parte dal filo della colonna.
        const valueX = lbl ? cx + lblW + 1 : cx;
        for (const line of linee) {
          doc.text(line, valueX, cy);
          cy += RIGA;
        }
      });
      maxY = Math.max(maxY, cy);
    }

    return maxY + 0.8;
  }

  private static heading(doc: jsPDF, y: number, text: string): number {
    y = this.pb(doc, y, 12);
    const stile = () => { doc.setFont(F, "bold"); doc.setFontSize(9); this.tc(doc, TITOLI); };
    stile();
    // Un titoletto scritto lungo nel modello va a capo: su una riga sola
    // usciva dal foglio. Il filetto sta sotto l'ultima riga.
    const righe: string[] = doc.splitTextToSize(san(text), PW);
    righe.forEach((riga, i) => {
      if (i > 0) {
        y = this.pb(doc, y + 4.2, 8);
        stile();
      }
      doc.text(riga, ML, y);
    });
    this.rule(doc, y + 1.2, ML, ML + doc.getTextWidth(righe[righe.length - 1] ?? ""), 0.4, this.filettoTitoletto());
    return y + 5.5;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT HEADER
  // ─────────────────────────────────────────────────────────────────────────────
  /** L'ambulatorio del modello, se c'e' ancora; altrimenti quello in uso. */
  private static ambulatorio(doctor: Doctor | null) {
    const scelto = this.m.intestazione.ambulatorioId;
    return (scelto ? doctor?.ambulatori?.find((x) => x.id === scelto) : undefined)
      ?? doctor?.ambulatori?.find((x) => x.isPrimario)
      ?? doctor?.ambulatori?.[0];
  }

  /** Larghezza e altezza del logo nel riquadro dell'intestazione, in mm. */
  private static misuraLogo(doc: jsPDF, logo: string): { w: number; h: number } | null {
    try {
      const p = doc.getImageProperties(logo);
      if (!p.width || !p.height) return null;
      // Al piu' 14 mm di altezza e 36 di larghezza: un logo che pesa piu' del
      // nome del medico diventa la cosa piu' importante del foglio.
      let h = LOGO_H;
      let w = (p.width / p.height) * h;
      if (w > LOGO_W) { w = LOGO_W; h = (p.height / p.width) * w; }
      return { w, h };
    } catch {
      return null;
    }
  }

  /**
   * La carta intestata come immagine, sotto a tutto, su ogni pagina: va
   * disegnata per prima, se no coprirebbe il testo. Si stampa solo se il
   * modello lo dice (carta intestata digitale); altrimenti la si vede soltanto
   * nell'anteprima dell'editor, per allineare il testo alla carta vera.
   */
  private static disegnaSfondo(doc: jsPDF) {
    const int = this.m.intestazione;
    if (!int.cartaIntestata || !int.sfondo) return;
    if (!int.sfondoInStampa && !this.raccogliZone) return;
    try {
      // Con un nome l'immagine entra nel PDF una volta sola, anche su dieci pagine.
      doc.addImage(int.sfondo, formatoImmagine(int.sfondo), 0, 0, PAGE_W, PAGE_H, "carta-intestata", "FAST");
    } catch {
      // Un'immagine rovinata non deve impedire la stampa del documento.
    }
  }

  /**
   * Le righe dei recapiti sotto o accanto al nome: lo studio, il suo
   * indirizzo, telefono ed email, la partita IVA e le righe del modello.
   */
  private static recapitiIntestazione(
    doctor: Doctor | null, vis?: FooterVisibilityOptions,
  ): { amb: Ambulatorio | undefined; righe: string[] } {
    const int = this.m.intestazione;
    const recapiti: string[] = [];
    const amb = int.ambulatorio ? this.ambulatorio(doctor) : undefined;
    if (amb) {
      recapiti.push(san(amb.nome));
      recapiti.push(san(
        [amb.indirizzo, [amb.cap, amb.citta].filter(Boolean).join(" ")]
          .filter(Boolean).join(MODERNO ? " · " : " - "),
      ));
    }
    // Telefono ed email si spengono in due posti: dalle impostazioni, per
    // tutti i documenti, e dal modello, per i documenti di quel modello.
    const contatti: string[] = [];
    if (vis?.showDoctorPhoneInPdf !== false && int.telefono && doctor?.telefono) {
      contatti.push(`Tel ${san(doctor.telefono)}`);
    }
    if (vis?.showDoctorEmailInPdf !== false && int.email && doctor?.email) {
      contatti.push(san(doctor.email));
    }
    if (contatti.length) recapiti.push(contatti.join(MODERNO ? "  ·  " : "   -   "));
    // La partita IVA chiude i recapiti, su una riga sua: in coda a telefono
    // ed email la riga diventava piu' larga di meta' foglio. Si stampa
    // sempre quando c'e' (chiesto da Pablo il 7 ottobre 2026).
    const partitaIva = int.partitaIva ? doctor?.partitaIva?.trim() : "";
    if (partitaIva) recapiti.push(`P.IVA ${san(partitaIva)}`);
    // Le righe del modello: iscrizione all'Ordine, orari, quello che lo
    // studio scrive sulla sua carta.
    for (const riga of int.righeAggiuntive.split("\n")) {
      if (riga.trim()) recapiti.push(san(riga.trim()));
    }
    return { amb, righe: recapiti };
  }

  /**
   * Intestazione "a banda": nome, specializzazione e recapiti in bianco su
   * una fascia piena del colore del modello, da un bordo all'altro del
   * foglio. E' la carta intestata che si riconosce da lontano; sotto, un
   * filo del secondo colore quando c'e'. Restituisce dove finisce la banda.
   */
  private static intestazioneABanda(
    doc: jsPDF, doctor: Doctor | null, vis?: FooterVisibilityOptions,
  ): number {
    const int = this.m.intestazione;
    const fondo = this.coloreBanda();
    const bianco = [255, 255, 255] as const;
    const tenue = mescola(bianco, fondo, 0.22);
    const nome = doctor
      ? `${titoloMedico(doctor)} ${doctor.nome} ${doctor.cognome}`.trim()
      : "Studio medico";
    const specializzazione = int.specializzazione ? doctor?.specializzazione?.trim() ?? "" : "";
    const { amb, righe } = this.recapitiIntestazione(doctor, vis);
    const logo = int.logo ? this.misuraLogo(doc, int.logo) : null;
    const xNome = logo ? ML + logo.w + 4 : ML;
    const yNome = 14;
    const ySpec = yNome + 5.6;
    const RIGA = 3.9;

    // Le misure prima di disegnare: la banda deve contenere tutto.
    doc.setFont(F, "bold"); doc.setFontSize(17);
    let largNome = doc.getTextWidth(san(nome));
    const spec = san(specializzazione).toUpperCase();
    if (spec) {
      doc.setFontSize(7.5);
      largNome = Math.max(largNome, doc.getTextWidth(spec) + 0.9 * Math.max(spec.length - 1, 0));
    }
    doc.setFont(F, "normal"); doc.setFontSize(8);
    const largRecapiti = Math.max(0, ...righe.map((r) => doc.getTextWidth(r)));
    const affiancati = xNome + largNome + 6 <= MR - largRecapiti;
    const fineNome = spec ? ySpec : yNome;
    const primaRiga = affiancati ? 9.6 : fineNome + 5.2;
    const fineRecapiti = righe.length ? primaRiga + (righe.length - 1) * RIGA : 0;
    const altezza = Math.max(25, fineNome + 6, fineRecapiti + 5.5, logo ? LOGO_TOP + LOGO_H + 4 : 0);

    doc.setFillColor(fondo[0], fondo[1], fondo[2]);
    doc.rect(0, 0, PAGE_W, altezza, "F");
    if (this.m.pagina.accento) {
      doc.setFillColor(SECONDO[0], SECONDO[1], SECONDO[2]);
      doc.rect(0, altezza, PAGE_W, 1, "F");
    }
    if (logo && int.logo) {
      doc.addImage(
        int.logo, formatoImmagine(int.logo),
        ML, (altezza - logo.h) / 2, logo.w, logo.h,
      );
    }
    doc.setFont(F, "bold"); doc.setFontSize(17); this.tc(doc, bianco);
    this.rigaCheSta(doc, san(nome), MR - xNome, (t) => doc.text(t, xNome, yNome));
    if (spec) {
      doc.setFont(F, "bold"); doc.setFontSize(7.5); this.tc(doc, tenue);
      this.rigaCheSta(doc, spec, MR - xNome, (t) => doc.text(t, xNome, ySpec, { charSpace: 0.9 }), 0.9);
    }
    righe.forEach((riga, i) => {
      const studio = i === 0 && amb;
      doc.setFont(F, studio ? "bold" : "normal"); doc.setFontSize(studio ? 8.5 : 8);
      this.tc(doc, studio ? bianco : tenue);
      if (affiancati) doc.text(riga, MR, primaRiga + i * RIGA, { align: "right" });
      else this.rigaCheSta(doc, riga, MR - xNome, (t) => doc.text(t, xNome, primaRiga + i * RIGA));
    });
    return altezza + (this.m.pagina.accento ? 1 : 0);
  }

  /**
   * Il fondo delle parti piene (la banda dell'intestazione, le fasce piene
   * delle sezioni): il colore principale; in bianco e nero un grigio scuro,
   * che col testo bianco si legge come il nero ma consuma meno toner.
   */
  private static coloreBanda(): readonly number[] {
    return this.m.pagina.colore === "nero" ? K80 : ACCENTO;
  }

  private static drawHeader(
    doc: jsPDF, title: string, subtitle: string,
    doctor: Doctor | null, showDoctor = true, vis?: FooterVisibilityOptions,
  ): number {
    const int = this.m.intestazione;
    let y = 17;
    this.disegnaSfondo(doc);
    const banda = !int.cartaIntestata && showDoctor && int.disposizione === "banda";

    if (int.cartaIntestata) {
      // Sulla carta intestata nome, recapiti e filetto ci sono gia': si lascia
      // libero lo spazio che il medico ha misurato e si parte dal titolo.
      y = ALTO;
      this.segnaZona(doc, "intestazione", 0, ALTO);
    } else if (banda) {
      const fine = this.intestazioneABanda(doc, doctor, vis);
      this.segnaZona(doc, "intestazione", 0, fine);
      y = fine + 7;
    } else if (showDoctor) {
      const centro = int.disposizione === "centro";
      const logo = int.logo ? this.misuraLogo(doc, int.logo) : null;
      // A sinistra chi firma, a destra dove lo si trova: e' la carta intestata
      // di qualunque studio, e usa la larghezza del foglio invece di lasciarla
      // vuota ai lati di un titolo centrato. I recapiti stavano nel piede, in
      // corpo 6,5: e' il primo posto dove si cerca chi ha scritto il referto,
      // non l'ultimo.
      const nome = doctor
        ? `${titoloMedico(doctor)} ${doctor.nome} ${doctor.cognome}`.trim()
        : "Studio medico";
      // Il logo sta a sinistra del nome, o sopra quando l'intestazione e'
      // centrata.
      let xNome = ML;
      if (logo && int.logo) {
        const xLogo = centro ? CX - logo.w / 2 : ML;
        doc.addImage(
          int.logo, formatoImmagine(int.logo),
          xLogo, LOGO_TOP + (LOGO_H - logo.h) / 2, logo.w, logo.h,
        );
        if (centro) y = LOGO_TOP + LOGO_H + 5;
        else xNome = ML + logo.w + 4;
      }
      const xTesto = centro ? CX : xNome;
      // Il nome in corpo 11, lo stesso del titolo del documento: a 15 pesava
      // piu' di "VISITA CARDIOLOGICA", e il cardiologo l'ha trovato
      // sproporzionato (call dell'11 settembre 2026).
      // Nello stile moderno il nome e' la cosa piu' grande della carta
      // intestata, come sulla carta di uno studio grafico.
      const corpoNome = MODERNO ? 16 : 11;
      // Quanto c'e' per nome e specializzazione: centrati tutto il foglio,
      // a sinistra quello che lascia il logo.
      const largColonna = centro ? PW : MR - xNome;
      doc.setFont(F, "bold"); doc.setFontSize(corpoNome); this.tc(doc, ACCENTO);
      this.rigaCheSta(doc, san(nome), largColonna, (t) => {
        if (centro) doc.text(t, xTesto, y, { align: "center" });
        else doc.text(t, xTesto, y);
      });
      // Sotto, la specializzazione come e' scritta nel profilo. Era stata
      // tolta perche' ripeteva il titolo del documento; il cardiologo la
      // rivuole, e con due specialita' ("cardiologia e geriatria") dice una
      // cosa che il titolo non dice. La riga si allinea con l'ultima dei
      // recapiti a destra.
      const specializzazione = int.specializzazione ? doctor?.specializzazione?.trim() : "";
      // Moderno: in maiuscoletto spaziato, nel secondo colore, un po' piu' giu'
      // perche' il nome e' piu' grande.
      const dySpec = MODERNO ? 5.8 : 4.2;
      const spaziaturaSpec = MODERNO ? 0.9 : 0;
      if (specializzazione) {
        if (MODERNO) {
          doc.setFont(F, "bold"); doc.setFontSize(7.5); this.tc(doc, SECONDO);
          const testo = san(specializzazione).toUpperCase();
          this.rigaCheSta(doc, testo, largColonna, (t, larghezza) => {
            doc.text(t, centro ? xTesto - larghezza / 2 : xTesto, y + dySpec, { charSpace: spaziaturaSpec });
          }, spaziaturaSpec);
        } else {
          doc.setFont(F, "normal"); doc.setFontSize(8); this.tc(doc, K80);
          this.rigaCheSta(doc, san(specializzazione), largColonna, (t) => {
            if (centro) doc.text(t, xTesto, y + 4.2, { align: "center" });
            else doc.text(t, xTesto, y + 4.2);
          });
        }
      }
      // Moderno: recapiti un punto piu' grandi, separati da un punto in mezzo,
      // e il nome dello studio in grassetto colorato.
      const corpoRecapiti = MODERNO ? 8 : 7;
      const rigaRecapiti = MODERNO ? 3.9 : 3.4;
      const altezzaNome = specializzazione ? (MODERNO ? 9.2 : 7.4) : (MODERNO ? 5.5 : 4);
      const primaSotto = specializzazione ? (MODERNO ? 10.6 : 8.4) : (MODERNO ? 6.2 : 4.6);

      const { amb, righe: recapiti } = this.recapitiIntestazione(doctor, vis);

      // Nello stile moderno la prima riga, il nome dello studio, e' in grassetto
      // colorato; nel classico i recapiti sono tutti uguali.
      const stileRecapito = (i: number) => {
        if (!MODERNO) return;
        if (i === 0 && amb) {
          doc.setFont(F, "bold"); doc.setFontSize(corpoRecapiti + 0.5); this.tc(doc, ACCENTO);
        } else {
          doc.setFont(F, "normal"); doc.setFontSize(corpoRecapiti); this.tc(doc, K80);
        }
      };
      doc.setFont(F, "normal"); doc.setFontSize(corpoRecapiti); this.tc(doc, K80);
      if (centro) {
        // Centrata, l'intestazione scende in colonna: nome, specializzazione,
        // recapiti.
        const primo = y + primaSotto;
        recapiti.forEach((riga, i) => {
          stileRecapito(i);
          this.rigaCheSta(doc, riga, PW, (t) => doc.text(t, CX, primo + i * rigaRecapiti, { align: "center" }));
        });
        y = recapiti.length ? primo + (recapiti.length - 1) * rigaRecapiti + 3 : y + altezzaNome;
      } else {
        // Nome e recapiti affiancati, se ci stanno. Sul mezzo foglio, o con un
        // logo largo, la specializzazione finiva sulla stessa riga del
        // telefono e sembrava una riga sola: li' i recapiti scendono sotto la
        // specializzazione, nella colonna del nome.
        const largRecapiti = Math.max(0, ...recapiti.map((r) => doc.getTextWidth(r)));
        doc.setFont(F, "bold"); doc.setFontSize(corpoNome);
        let largNome = doc.getTextWidth(san(nome));
        if (specializzazione) {
          doc.setFont(F, MODERNO ? "bold" : "normal"); doc.setFontSize(MODERNO ? 7.5 : 8);
          const spec = MODERNO ? san(specializzazione).toUpperCase() : san(specializzazione);
          largNome = Math.max(
            largNome, doc.getTextWidth(spec) + spaziaturaSpec * Math.max(spec.length - 1, 0),
          );
        }
        doc.setFont(F, "normal"); doc.setFontSize(corpoRecapiti);
        const affiancati = xNome + largNome + 6 <= MR - largRecapiti;
        if (affiancati || largRecapiti > MR - xNome) {
          recapiti.forEach((riga, i) => {
            stileRecapito(i);
            this.rigaCheSta(doc, riga, PW, (t) => doc.text(t, MR, y - 2.6 + i * rigaRecapiti, { align: "right" }));
          });
          y = Math.max(
            y + altezzaNome,
            y - 2.6 + recapiti.length * rigaRecapiti + 3,
            logo ? LOGO_TOP + LOGO_H + 3 : 0,
          );
        } else {
          const primo = y + primaSotto;
          recapiti.forEach((riga, i) => {
            stileRecapito(i);
            this.rigaCheSta(doc, riga, MR - xNome, (t) => doc.text(t, xNome, primo + i * rigaRecapiti));
          });
          y = Math.max(
            recapiti.length ? primo + (recapiti.length - 1) * rigaRecapiti + 3 : y + altezzaNome,
            logo ? LOGO_TOP + LOGO_H + 3 : 0,
          );
        }
      }
    }

    if (!int.cartaIntestata && !banda) {
      // Filetto doppio, grosso e sottile: separa la carta intestata dal
      // documento con piu' autorevolezza di una linea sola, e in bianco e nero
      // e' l'unico modo di dare peso a una separazione.
      // Nello stile moderno un filetto solo, nel colore del modello.
      this.dc(doc, ACCENTO); doc.setLineWidth(MODERNO ? 0.6 : 0.7);
      doc.line(ML, y, MR, y);
      if (!MODERNO) this.rule(doc, y + 1.1, ML, MR, 0.15);
      y += 4;
      this.segnaZona(doc, "intestazione", 0, y - 2);
    }

    // Il titolo del documento sulla stessa fascia grigia delle sezioni, piu'
    // alta e in corpo piu' grande: e' il primo livello della stessa
    // gerarchia. Proposta dal cardiologo l'11 settembre 2026, "come gia' fai
    // con i paragrafi anamnesi".
    const inizioTitolo = y;
    if (this.m.titolo.stile === "sinistra") {
      // A sinistra, com'e' scritto e grande, con una barretta del secondo
      // colore sotto: il titolo di un articolo invece che di un modulo.
      doc.setFont(F, "bold"); this.tc(doc, TITOLI);
      let corpo = 17;
      doc.setFontSize(corpo);
      while (corpo > 11 && doc.getTextWidth(san(title)) > PW) {
        corpo -= 0.5;
        doc.setFontSize(corpo);
      }
      this.rigaCheSta(doc, san(title), PW, (t) => doc.text(t, ML, y + 6.6));
      this.fascia(doc, ML, y + 9.2, 14, 1.1, SECONDO, 0.5);
      y += 10.3;
      if (subtitle) {
        doc.setFont(F, "normal"); doc.setFontSize(8.5); this.tc(doc, K80);
        this.rigaCheSta(doc, san(subtitle), PW, (t) => doc.text(t, ML, y + 4.4));
        y += 4.4;
      }
      this.segnaZona(doc, "titolo", inizioTitolo - 1, y + 1.5);
      return y + 5;
    }
    // Nello stile moderno il titolo e' piu' grande e piu' spaziato, su una
    // fascia piu' alta.
    const TITOLO_H = MODERNO ? 11 : 7.4;
    const spaziaturaTitolo = MODERNO ? 2 : SPAZIATURA_TITOLO;
    const stile = this.m.titolo.stile;
    if (stile === "fascia") {
      this.fascia(doc, ML, y, PW, TITOLO_H, FASCIA, 2);
    } else if (stile === "sfumato") {
      this.sfumatura(doc, ML, y, PW, TITOLO_H, FASCIA, SECONDO_TINTA, TONDI ? 2.5 : 0.01);
    }
    doc.setFont(F, "bold"); doc.setFontSize(MODERNO ? 15 : 11); this.tc(doc, TITOLI);
    // Il titolo si posiziona da sinistra su una larghezza misurata qui, invece
    // di lasciar fare a `align: "center"`.
    //
    // jsPDF centra sulla larghezza che gli da' `getStringUnitWidth`, e quella
    // **non conosce `charSpace`**: con la spaziatura fra le lettere il titolo
    // esce piu' largo di quanto il calcolo credeva e scivola a destra di mezza
    // spaziatura per lettera. Su "VISITA CARDIOLOGICA", 19 caratteri a 0,7 mm,
    // sono 6,3 mm su una fascia di 174: il margine sinistro ne restava 65 e il
    // destro 52, cioe' un titolo visibilmente storto.
    //
    // L'ultima lettera non porta spaziatura visibile, quindi gli spazi che
    // contano sono `n - 1`.
    const titolo = san(title).toUpperCase();
    // Dentro la fascia, con due millimetri per parte.
    this.rigaCheSta(doc, titolo, PW - 4, (t, larghezzaTitolo) => {
      doc.text(t, CX - larghezzaTitolo / 2, y + (MODERNO ? 7.4 : 5.1), {
        charSpace: spaziaturaTitolo,
      });
    }, spaziaturaTitolo);
    if (stile === "sottolineato") {
      this.dc(doc, ACCENTO); doc.setLineWidth(0.4);
      doc.line(ML, y + TITOLO_H - 0.3, MR, y + TITOLO_H - 0.3);
    }
    y += TITOLO_H;
    if (subtitle) {
      doc.setFont(F, "normal"); doc.setFontSize(8); this.tc(doc, K80);
      this.rigaCheSta(doc, san(subtitle), PW, (t) => doc.text(t, CX, y + 4.2, { align: "center" }));
      y += 4.2;
    }
    this.segnaZona(doc, "titolo", inizioTitolo - 1, y + 1.5);
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATIENT BLOCK
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawPatientBlock(
    doc: jsPDF, patient: Patient, visitDate: string,
    y: number, dateLabel = "Data visita", opts?: { showDate?: boolean; extraRight?: { label: string; value: string }[]; centrato?: boolean }
  ): number {
    // Data di nascita, sesso e codice fiscale li decide il modello.
    const mostra = this.m.paziente;
    const a = calcAge(patient.dataNascita);
    const nascita = patient.dataNascita
      ? `${fd(patient.dataNascita)}${a ? ` (${a} anni)` : ""}`
      : "";

    // Il nome prende due colonne **solo se in una non ci sta**. Allargarlo
    // sempre faceva scendere la data della visita anche per "PROVA Mario", che
    // in 43 millimetri sta larghissimo: una riga in piu' nell'anagrafica di
    // ogni referto per un problema che quel referto non aveva.
    //
    // Si misura con lo stesso carattere con cui la tabella lo scrivera'
    // (helvetica bold 9, perche' il nome e' in grassetto), sulla larghezza utile
    // della cella. Se non ci sta nemmeno in due colonne, ci pensa la tabella:
    // manda a capo dentro la cella e alza la riga.
    const nome = this.nomePaziente(patient);
    // Sul mezzo foglio quattro colonne sono 30 mm: il codice fiscale non ci
    // sta e andava a capo a meta'. Li' le colonne sono tre.
    const colonne = PW < 150 ? 3 : 4;
    doc.setFont(F, "bold"); doc.setFontSize(9);
    const spanNome = doc.getTextWidth(san(nome)) > PW / colonne - 4 ? 2 : 1;

    const voci = [
      {
        label: "Paziente",
        value: nome,
        forte: true,
        span: spanNome,
      },
      ...(!mostra.dataNascita
        ? []
        : [{ label: "Data di nascita", value: nascita }]),
      ...(mostra.luogoNascita && patient.luogoNascita?.trim()
        ? [{ label: "Luogo di nascita", value: patient.luogoNascita.trim() }]
        : []),
      ...(mostra.sesso && patient.sesso
        ? [{
            label: "Sesso",
            // "F" e "M", come sui documenti: per esteso la voce pesava piu'
            // del dato che porta.
            value: patient.sesso === "F" ? "F" : "M",
          }]
        : []),
      ...(opts?.showDate === false && !mostra.data
        ? []
        : [{ label: dateLabel, value: fd(visitDate) }]),
      ...(mostra.codiceFiscale && patient.codiceFiscale?.trim()
        ? [{ label: "Codice fiscale", value: patient.codiceFiscale.toUpperCase() }]
        : []),
      // La residenza la chiedono certificati e richieste: un indirizzo e'
      // lungo, e prende due colonne.
      ...(mostra.residenza && patient.indirizzo?.trim()
        ? [{ label: "Residenza", value: patient.indirizzo.trim(), span: 2 }]
        : []),
      ...(opts?.extraRight ?? []),
    ];

    const inizio = y;
    // Prima si prova tutta l'anagrafica su una riga sola, con le celle larghe
    // quanto il loro contenuto. La griglia a colonne uguali dava a "Sesso" gli
    // stessi 43 mm del codice fiscale e mandava a capo la quinta voce: nome,
    // nascita, sesso, data e codice fiscale su due righe, con mezzo foglio di
    // bianco a destra della seconda (Pablo, 7 novembre 2026). Solo se non ci
    // sta si torna alla griglia.
    const presenti = voci.filter((v) => v.value && v.value !== "-");
    if (mostra.riquadro) {
      const fine = this.righeAnagrafica(doc, presenti, y + 1.5, opts?.centrato, false);
      if (fine !== null) {
        // Come la griglia: i 3 mm di coda di `righeAnagrafica` diventano 1,5.
        y = fine - 3 + 1.5;
        this.dc(doc, TENUE); doc.setLineWidth(0.35);
        if (TONDI) doc.roundedRect(ML, inizio - 1, PW, y - inizio + 1, 2.2, 2.2, "S");
        else doc.rect(ML, inizio - 1, PW, y - inizio + 1, "S");
        this.segnaZona(doc, "paziente", inizio - 1.5, y + 1);
        return y + 5;
      }
    } else {
      this.rule(doc, y - 1, ML, MR, 0.2);
      const fine = this.righeAnagrafica(doc, presenti, y, opts?.centrato, true);
      if (fine !== null) {
        this.segnaZona(doc, "paziente", inizio - 1.5, fine + 1);
        return fine + 3;
      }
    }

    if (mostra.riquadro) {
      // Il riquadro sostituisce i filetti: dentro, celle senza righe, e un
      // millimetro e mezzo d'aria sopra e sotto.
      y = this.drawMisureTable(doc, y + 1.5, voci, colonne, undefined, opts?.centrato, false, true) - 3 + 1.5;
      this.dc(doc, TENUE); doc.setLineWidth(0.35);
      if (TONDI) doc.roundedRect(ML, inizio - 1, PW, y - inizio + 1, 2.2, 2.2, "S");
      else doc.rect(ML, inizio - 1, PW, y - inizio + 1, "S");
      this.segnaZona(doc, "paziente", inizio - 1.5, y + 1);
      return y + 5;
    }
    y = this.drawMisureTable(doc, y, voci, colonne, undefined, opts?.centrato, false);
    this.segnaZona(doc, "paziente", inizio - 1.5, y + 1);
    return y + 3;
  }

  /**
   * L'anagrafica su una riga; se non ci sta (un nome di quattro parole), il
   * nome da solo sulla prima e tutto il resto sulla seconda, ancora da filo a
   * filo. Restituisce `null` se nemmeno cosi' ci sta: allora la griglia.
   */
  private static righeAnagrafica(
    doc: jsPDF,
    voci: { label: string; value: string; forte?: boolean }[],
    y: number,
    centrato = false,
    filetti = true,
  ): number | null {
    const tutta = this.misuraRigaAnagrafica(doc, voci);
    if (tutta) return this.rigaAnagrafica(doc, voci, y, centrato, filetti);
    if (voci.length < 3 || !voci[0].forte) return null;
    const resto = voci.slice(1);
    if (!this.misuraRigaAnagrafica(doc, [voci[0]]) || !this.misuraRigaAnagrafica(doc, resto)) return null;
    // Fra le due righe il filetto solo dove ci sono i filetti; nel riquadro
    // basta l'aria.
    const meta = this.rigaAnagrafica(doc, [voci[0]], y, centrato, filetti)! - 3 + (filetti ? 0 : 1);
    return this.rigaAnagrafica(doc, resto, meta, centrato, filetti);
  }

  /** Se le voci stanno in una riga, con almeno 5 mm d'aria fra l'una e l'altra. */
  private static misuraRigaAnagrafica(
    doc: jsPDF, voci: { label: string; value: string; forte?: boolean }[],
  ): boolean {
    if (voci.length === 0) return false;
    const totale = this.larghezzeAnagrafica(doc, voci).reduce((s, w) => s + w, 0);
    return totale + 5 * (voci.length - 1) <= PW - 4;
  }

  /** Ogni voce larga quanto la piu' lunga fra etichetta e valore. */
  private static larghezzeAnagrafica(
    doc: jsPDF, voci: { label: string; value: string; forte?: boolean }[],
  ): number[] {
    return voci.map((v) => {
      doc.setFont(F, "normal"); doc.setFontSize(7);
      const lw = doc.getTextWidth(MODERNO ? san(v.label).toUpperCase() : san(v.label));
      doc.setFont(F, v.forte || VALORI_GRASSETTO ? "bold" : "normal"); doc.setFontSize(9);
      return Math.max(lw, doc.getTextWidth(sanValore(v.value)));
    });
  }

  /**
   * L'anagrafica in una riga sola, se ci sta: ogni voce larga quanto la piu'
   * lunga fra etichetta e valore, e lo spazio che avanza diviso in parti
   * uguali fra le voci, cosi' la riga va da filo a filo senza buchi. Fra una
   * voce e l'altra un filetto verticale sottile, che separa senza pesare.
   *
   * Allineata a sinistra la prima voce parte dal filo e l'ultima finisce
   * sull'altro; centrata (il referto, sotto il titolo centrato) ogni voce si
   * centra nel suo spazio. Restituisce la quota sotto la riga, o `null` se le
   * voci non ci stanno con almeno 5 mm d'aria fra l'una e l'altra.
   */
  private static rigaAnagrafica(
    doc: jsPDF,
    voci: { label: string; value: string; forte?: boolean }[],
    y: number,
    centrato = false,
    filettoSotto = true,
  ): number | null {
    if (voci.length === 0) return null;
    const BORDO = 2;
    const ARIA_MINIMA = 5;
    const etichetta = (l: string) => (MODERNO ? san(l).toUpperCase() : san(l));
    const grassetto = (v: { forte?: boolean }) => v.forte || VALORI_GRASSETTO;
    const larghezze = this.larghezzeAnagrafica(doc, voci);
    const totale = larghezze.reduce((s, w) => s + w, 0);
    const n = voci.length;
    const utile = PW - 2 * BORDO;
    if (totale + ARIA_MINIMA * (n - 1) > utile) return null;

    // Senza filo a filo una voce sola resta dov'e': centrata o a sinistra.
    const aria = centrato || n === 1
      ? (utile - totale) / n
      : (utile - totale) / (n - 1);
    const RIGA = 8.4;
    y = this.pb(doc, y, RIGA + 2);

    let x = ML + BORDO + (centrato ? aria / 2 : 0);
    voci.forEach((v, i) => {
      const w = larghezze[i];
      const cx = centrato ? x + w / 2 : x;
      const allinea = centrato ? "center" : "left";
      doc.setFont(F, "normal"); doc.setFontSize(7); this.tc(doc, MODERNO ? K140 : K80);
      doc.text(etichetta(v.label), cx, y + 3.2, { align: allinea });
      doc.setFont(F, grassetto(v) ? "bold" : "normal"); doc.setFontSize(9); this.tc(doc, K0);
      doc.text(sanValore(v.value), cx, y + 7.0, { align: allinea });
      // Con due voci sole ai due fili (la ricetta: nome e codice fiscale) un
      // filetto in mezzo a dieci centimetri di bianco non separa niente.
      if (i < n - 1 && aria <= 30) {
        const sx = x + w + aria / 2;
        this.dc(doc, MODERNO ? TENUE : K200); doc.setLineWidth(0.15);
        doc.line(sx, y + 1.2, sx, y + RIGA - 0.6);
      }
      x += w + aria;
    });

    if (filettoSotto) {
      this.dc(doc, MODERNO ? TENUE : K200); doc.setLineWidth(0.15);
      doc.line(ML, y + RIGA, MR, y + RIGA);
    }
    return y + RIGA + 3;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT SECTION
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawTextSection(
    doc: jsPDF, y: number, title: string,
    content: string | undefined | null, note?: string
  ): number {
    if (!content?.trim()) return y;
    // Stessa barra grigia delle altre sezioni: "Anamnesi" e "Esami
    // ematochimici" sono lo stesso livello e devono pesare uguale.
    //
    // Il titolo si porta dietro due righe di testo, non una: con una sola,
    // "Conclusioni e Terapia" poteva aprire in fondo alla pagina con un rigo
    // orfano e proseguire su quella dopo.
    y = this.sezione(
      doc, y, title,
      FASCIA_H + ARIA_SOTTO_FASCIA + PRIMA_RIGA_PROSA + 2 * LH_PROSA + 1,
    );
    y = this.block(doc, content, ML, y + PRIMA_RIGA_PROSA, PW, LH_PROSA, {
      font: F, style: "normal", fontSize: CORPO, color: K0,
    });
    if (note) {
      y += 1.5;
      doc.setFont(F, "italic"); doc.setFontSize(7); this.tc(doc, K140);
      y = this.block(doc, note, ML + 1, y, PW - 2, 3.8, {
        font: F, style: "italic", fontSize: 7, color: K140,
      });
    }
    // Nessun margine in coda: l'aria prima della fascia successiva e'
    // l'interlinea dell'ultima riga.
    return y;
  }

  /**
   * La prosa di una sezione in un riquadro colorato, in grassetto: e' come i
   * modelli che lo chiedono stampano le conclusioni, la cosa che chi riceve il
   * referto cerca per prima. Il riquadro si disegna solo se il testo ci sta
   * tutto nella pagina; se deve andare a capo pagina, esce come una sezione
   * normale, perche' un riquadro spezzato in due non evidenzia niente.
   */
  private static drawProsaInEvidenza(
    doc: jsPDF, y: number, title: string, content: string | undefined | null,
  ): number {
    if (!content?.trim()) return y;
    const testo = san(content).split(MARCATORE_GRASSETTO).join("");
    doc.setFont(F, "bold"); doc.setFontSize(CORPO);
    const righe = doc.splitTextToSize(testo, PW - 10) as string[];
    const altezza = righe.length * LH_PROSA + 5;
    y = this.sezione(doc, y, title, FASCIA_H + ARIA_SOTTO_FASCIA + Math.min(altezza, 2 * LH_PROSA + 6) + 1);
    if (y + altezza > LIMITE) {
      return this.block(doc, content, ML, y + PRIMA_RIGA_PROSA, PW, LH_PROSA, {
        font: F, style: "bold", fontSize: CORPO, color: K30,
      });
    }
    this.sfumatura(doc, ML, y, PW, altezza, FASCIA, SECONDO_TINTA, TONDI ? 2 : 0.01);
    doc.setFont(F, "bold"); doc.setFontSize(CORPO); this.tc(doc, K30);
    righe.forEach((riga, i) => doc.text(riga, ML + 5, y + 2.5 + PRIMA_RIGA_PROSA * 0.9 + i * LH_PROSA));
    return y + altezza + 2;
  }

  /**
   * Anamnesi strutturata: titolo "Anamnesi" + una riga per ciascuna categoria
   * valorizzata ("Familiare: ...", "Patologica: ..."), con etichetta in grassetto
   * e valore a capo con rientro. Salta le categorie vuote.
   */
  private static drawStructuredAnamnesi(
    doc: jsPDF, y: number, as: NonNullable<Visit["anamnesiStrutturata"]>,
    order?: string[],
    etichette?: Record<string, string>
  ): number {
    // Ordine configurato per il tipo di visita; le sezioni con dato ma non
    // incluse nell'ordine (predefinite o personalizzate) vengono comunque
    // stampate in coda (no perdita dati).
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const k of order ?? []) if (!seen.has(k)) { keys.push(k); seen.add(k); }
    for (const k of ALL_ANAMNESI_CAMPO_KEYS) if (!seen.has(k)) { keys.push(k); seen.add(k); }
    for (const k of Object.keys(as)) if (!seen.has(k)) { keys.push(k); seen.add(k); }

    const rows = keys
      .map((key) => ({
        label: resolveAnamnesiLabel(key, etichette),
        value: (as[key] ?? "").trim(),
      }))
      .filter((r) => r.value !== "");
    if (rows.length === 0) return y;

    // La prima riga si scrive sulla sua linea di base, un corpo 9,5 sotto il
    // filo del contenuto.
    y = this.sezione(doc, y, this.tit("anamnesi")) + 3.6;

    for (const r of rows) {
      const lbl = san(r.label) + ": ";
      doc.setFont(F, "bold"); doc.setFontSize(9.5);
      const lblW = doc.getTextWidth(lbl);
      const valLines: string[] = doc.splitTextToSize(san(r.value), PW - 2 - lblW);

      valLines.forEach((line, i) => {
        y = this.pb(doc, y, LH + 1);
        if (i === 0) {
          doc.setFont(F, "bold"); doc.setFontSize(9.5); this.tc(doc, K30);
          doc.text(lbl, ML + 1, y);
        }
        doc.setFont(F, "normal"); doc.setFontSize(9.5); this.tc(doc, K30);
        doc.text(line, ML + 1 + lblW, y);
        y += LH;
      });
      y += 1.2; // gap tra categorie
    }
    // Il gap dopo l'ultima categoria si restituisce: l'aria prima della
    // fascia successiva e' gia' l'interlinea.
    return y - 1.2;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IMAGE GALLERY
  // ─────────────────────────────────────────────────────────────────────────────
  /**
   * Converte in JPEG ridimensionando al lato lungo richiesto.
   *
   * Il ridimensionamento e' il punto: prima l'immagine entrava nel PDF alla
   * risoluzione nativa per essere disegnata larga otto centimetri, e quattro
   * foto di telefono facevano un referto da megabyte che poi doveva viaggiare
   * per posta elettronica. A 200 dpi sulla dimensione stampata non si perde
   * niente di quello che una laser sa rendere.
   */
  private static toJpeg(url: string, maxLatoPx: number): Promise<string> {
    return new Promise((res, rej) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        const scala = Math.min(
          1, maxLatoPx / Math.max(img.naturalWidth, img.naturalHeight, 1),
        );
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * scala));
        c.height = Math.max(1, Math.round(img.naturalHeight * scala));
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = () => rej(new Error("fail")); img.src = url;
    });
  }

  /**
   * Galleria degli allegati, in fondo al referto.
   *
   * Due larghezze invece di una: le immagini panoramiche — un tracciato ECG,
   * una striscia Holter — prendono la riga intera, le altre restano in coppia.
   * In una cella da 85 mm un tracciato lungo e basso e' decorativo e non
   * refertabile, e in un referto un'immagine che non si legge e' peggio di
   * un'immagine che manca.
   */
  private static async drawImages(doc: jsPDF, imgs: string[] | undefined, y: number): Promise<number> {
    if (!imgs?.length) return y;

    const GAP = 4;
    const MEZZA = (PW - GAP) / 2;
    /** Lato lungo massimo: 200 dpi sulla larghezza piena della colonna. */
    const MAX_PX = Math.round((PW / 25.4) * 200);
    /** Sopra questo rapporto base/altezza l'immagine prende la riga intera. */
    const PANORAMICA = 1.6;

    const convertite = await Promise.all(
      imgs.map((im) => this.toJpeg(im, MAX_PX).catch(() => null)),
    );
    const misurate = convertite.map((img) => {
      if (!img) return { img: null, ratio: 1, piena: false };
      try {
        const p = doc.getImageProperties(img);
        const ratio = p.width / p.height;
        return { img, ratio, piena: ratio >= PANORAMICA };
      } catch {
        return { img: null, ratio: 1, piena: false };
      }
    });

    y = this.sezione(doc, y, "Immagini ecografia");

    let i = 0;
    let numero = 1;
    while (i < misurate.length) {
      const corrente = misurate[i];
      const successiva = misurate[i + 1];
      // Una panoramica non si accompagna: prende la riga da sola.
      const coppia = !corrente.piena && successiva && !successiva.piena;
      const riga = coppia ? [corrente, successiva] : [corrente];
      const larghezza = corrente.piena ? PW : MEZZA;
      const altezza = corrente.piena ? 78 : 55;

      y = this.pb(doc, y, altezza + 10);
      riga.forEach((cella, col) => {
        const x = ML + col * (larghezza + GAP);
        this.dc(doc, K200); doc.setLineWidth(0.2);
        doc.rect(x, y, larghezza, altezza, "S");

        let disegnata = false;
        if (cella.img) {
          try {
            let w = larghezza - 3, h = w / cella.ratio;
            if (h > altezza - 3) { h = altezza - 3; w = h * cella.ratio; }
            doc.addImage(
              cella.img, "JPEG",
              x + (larghezza - w) / 2, y + (altezza - h) / 2, w, h,
            );
            disegnata = true;
          } catch { /* sotto esce la nota al posto dell'immagine */ }
        }
        if (!disegnata) {
          doc.setFont(F, "italic"); doc.setFontSize(7); this.tc(doc, K140);
          doc.text(
            "Immagine non disponibile",
            x + larghezza / 2, y + altezza / 2, { align: "center" },
          );
        }

        // La didascalia serve a poterla citare: "come da Fig. 2" nel testo del
        // referto non si puo' scrivere se le figure non hanno un numero.
        doc.setFont(F, "normal"); doc.setFontSize(6.5); this.tc(doc, K80);
        doc.text(`Fig. ${numero + col}`, x, y + altezza + 3.6);
      });

      numero += riga.length;
      i += riga.length;
      y += altezza + 7;
    }
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawFooter(
    doc: jsPDF,
    _doctor: Doctor | null,
    _vis?: FooterVisibilityOptions,
    pagina?: { numero: number; totale: number },
  ) {
    // Le tre scritte del piede sono a corpo 8. Erano a 5 e 6,5 e sul foglio
    // stampato non si leggevano ("sono troppo piccole", Pablo, 24 settembre
    // 2026): il piede sta in una posizione fissa, quindi ingrandirle non
    // allunga il referto di una riga.
    // La firma dell'applicazione, a sinistra sotto il filetto: in grigio
    // medio, piu' chiaro di data e pagina, perche' non e' un dato del referto.
    // Nello stile moderno il piede prende il colore del modello, schiarito.
    const colorePiede = MODERNO ? mescola(ACCENTO, BIANCO, 0.3) : K140;
    doc.setFont(F, "normal"); doc.setFontSize(8); this.tc(doc, colorePiede);
    doc.text("Creato con Corioli", ML, FOOT_Y + 4.5);

    this.rule(doc, FOOT_Y, ML, MR, 0.2, MODERNO ? TENUE : K200);

    // Al centro c'era "Emesso il ... - rif. ...": ora di stampa e codice
    // interno della visita. Tolto il 6 ottobre 2026 ("e' inutile", Pablo): il
    // codice non si puo' cercare da nessuna parte nell'app, quindi per chi
    // legge il foglio era una sigla senza senso.

    // I recapiti dello studio sono saliti nella carta intestata, dove si
    // cercano. Qui resta la numerazione, che serve solo al foglio stampato: si
    // stampa anche su una pagina sola, perche' e' il modo in cui il foglio
    // dichiara di essere completo.
    if (pagina && this.m.piede.numeroPagina) {
      doc.setFont(F, "normal"); doc.setFontSize(8); this.tc(doc, MODERNO ? colorePiede : K80);
      doc.text(
        `Pagina ${pagina.numero} di ${pagina.totale}`,
        MR, FOOT_Y + 4.5, { align: "right" },
      );
    }

    // Il testo libero del modello sta sopra il filetto, centrato: sotto,
    // accanto alla firma di Corioli e al numero di pagina, una frase lunga
    // avrebbe finito per sovrapporsi. Lo spazio l'ha gia' tolto al contenuto
    // `impostaModello` (vedi `LIMITE`).
    const righe = righePiede(this.m);
    if (righe.length) {
      doc.setFont(F, "normal"); doc.setFontSize(PIEDE_CORPO); this.tc(doc, K80);
      righe.forEach((riga, i) => {
        const testo = (doc.splitTextToSize(san(riga), PW) as string[])[0] ?? "";
        doc.text(testo, CX, FOOT_Y - 2 - (righe.length - 1 - i) * PIEDE_RIGA, { align: "center" });
      });
    }
    this.segnaZona(doc, "piede", FOOT_Y - 2 - righe.length * PIEDE_RIGA, Math.min(FOOT_Y + 7, PAGE_H));
  }

  /**
   * Chiude il documento: numera le pagine e ripete l'identita' del paziente.
   *
   * Si fa in coda perche' "Pagina 2 di 3" richiede un totale che si conosce
   * solo a documento finito. La riga di identificazione in testa alle pagine
   * successive e' la ragione per cui i referti ospedalieri la portano: un
   * foglio che si stacca dalla graffetta, o che viene fotocopiato da solo,
   * deve restare attribuibile al suo paziente.
   */
  private static finalizzaPagine(
    doc: jsPDF, patient: Patient, dataVisita: string,
    doctor: Doctor | null, opts: FooterVisibilityOptions,
  ): void {
    const totale = doc.getNumberOfPages();
    const autore = doctor
      ? san(`${titoloMedico(doctor)} ${doctor.nome} ${doctor.cognome}`.trim())
      : "";
    // Senza sesso indicato la riga non ne sceglie uno: "nato/a" e' la forma
    // che usano i referti quando il dato non c'e'.
    const nato =
      patient.sesso === "F" ? "nata" : patient.sesso === "M" ? "nato" : "nato/a";
    const identita = [
      san(this.nomePaziente(patient)),
      patient.dataNascita ? `${nato} il ${fd(patient.dataNascita)}` : "",
      dataVisita ? `visita del ${fd(dataVisita)}` : "",
    ].filter(Boolean).join("   -   ");

    for (let n = 1; n <= totale; n++) {
      doc.setPage(n);

      if (n > 1 && this.m.piede.pazienteSullePagine) {
        doc.setFont(F, "normal"); doc.setFontSize(7); this.tc(doc, MODERNO ? ACCENTO : K80);
        doc.text(identita, ML, ALTO + 12);
        // A destra chi lo ha scritto. La carta intestata sta sulla prima
        // pagina soltanto: da qui in poi un foglio che si stacca era
        // attribuibile al paziente ma non al suo autore, ed e' la meta' che
        // serve a chi lo riceve.
        if (autore) doc.text(autore, MR, ALTO + 12, { align: "right" });
        this.rule(doc, ALTO + 14.5, ML, MR, 0.2, MODERNO ? TENUE : K200);
      }

      this.drawFooter(doc, doctor, opts, { numero: n, totale });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGNATURE BLOCK — luogo + data (sinistra) e firma del medico (destra)
  // Stesso carattere del referto (helvetica); usato da ricetta, esame, certificato.
  // ─────────────────────────────────────────────────────────────────────────────
  private static async drawSignatureBlock(
    doc: jsPDF, doctor: Doctor | null, y: number, dataDocumento?: string,
    /** Falso quando le impostazioni tolgono la firma dal referto. */
    immagineAmmessa = true,
  ): Promise<number> {
    const sigW = LARGHEZZE_FIRMA[this.m.firma.grandezza]; // mm
    const sigH = sigW * (SIGNATURE_STAMP_PDF_LAYOUT_H / SIGNATURE_STAMP_PDF_LAYOUT_W);
    // Il modello puo' rinunciare all'immagine: resta lo spazio per la penna.
    const hasImg = immagineAmmessa && this.m.firma.immagine && Boolean(doctor?.signatureStampImage);
    const posizione = this.m.firma.posizione;
    // Il blocco della firma si allinea a un lato o al centro; luogo e data
    // stanno dall'altra parte (a sinistra quando la firma e' al centro).
    const lato: "left" | "center" | "right" =
      posizione === "sinistra" ? "left" : posizione === "centro" ? "center" : "right";
    const xFirma = lato === "left" ? ML : lato === "center" ? CX : MR;

    // Si riserva l'altezza reale del blocco, non una stima larga: riservando
    // sempre lo spazio del timbro anche quando il timbro non c'e', la firma
    // finiva su una pagina tutta sua con sopra tre centimetri di bianco.
    //
    //   aria sopra 6 + spazio per la firma a mano 10 + filetto e nome 4,5
    //   + nome 4 + qualifica 4 = 28,5 mm
    //
    y = this.pb(doc, y, hasImg ? sigH + 21 : 29);
    y += 6;
    const baseY = y;
    if (!this.m.firma.luogoData) dataDocumento = undefined;

    // Luogo e data (sinistra), come in calce a qualunque referto: la citta'
    // e' quella dell'ambulatorio in cui la prestazione e' stata eseguita, e
    // senza la data la firma non dice quando e' stata apposta.
    if (dataDocumento) {
      const amb = this.ambulatorio(doctor);
      const luogo = amb?.citta?.trim();
      doc.setFont(F, "normal"); doc.setFontSize(9); this.tc(doc, K30);
      const scritta = san(luogo ? `${luogo}, ${fd(dataDocumento)}` : fd(dataDocumento));
      if (lato === "left") doc.text(scritta, MR, baseY + 12, { align: "right" });
      else doc.text(scritta, ML, baseY + 12);
    }

    // Firma del medico (destra)
    const lineLeft = lato === "left" ? ML : lato === "center" ? CX - 31 : MR - 62;
    const lineRight = lineLeft + 62;
    const xImmagine = lato === "left" ? ML : lato === "center" ? CX - sigW / 2 : MR - sigW;
    let cy = baseY;

    if (hasImg) {
      try {
        const img = await normalizeSignatureStampImage(doctor!.signatureStampImage!);
        const fmt = signatureStampPdfFormat(img);
        doc.addImage(img, fmt, xImmagine, cy, sigW, sigH);
        cy += sigH + 2;
      } catch {
        cy += 10;
      }
    } else {
      // Spazio per la firma autografa sopra il filetto.
      cy += 10;
    }

    // Moderno: filetto tenue e nome nel colore del modello.
    this.dc(doc, MODERNO ? TENUE : K30); doc.setLineWidth(0.4); doc.line(lineLeft, cy, lineRight, cy);
    cy += 4.5;

    const rawName = san(`${doctor?.nome || ""} ${doctor?.cognome || ""}`.trim());
    const name = rawName ? `${titoloMedico(doctor)} ${rawName}` : "_______________________";
    doc.setFont(F, "bold"); doc.setFontSize(9.5); this.tc(doc, MODERNO ? ACCENTO : K0);
    doc.text(name, xFirma, cy, { align: lato });
    cy += 4;

    if (doctor?.specializzazione) {
      doc.setFont(F, "normal"); doc.setFontSize(8); this.tc(doc, K80);
      doc.text(san(doctor.specializzazione), xFirma, cy, { align: lato });
      cy += 4;
    }

    this.segnaZona(doc, "firma", baseY - 3, cy + 1);
    return cy + 4;
  }
  // ─────────────────────────────────────────────────────────────────────────────
  // TABELLE DI MISURE
  //
  // Una sezione senza nessuna misura valorizzata non si stampa: un referto
  // senza un esame non lascia intestazioni vuote nel foglio.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Tabella di misure a griglia: ogni cella ha l'etichetta piccola in alto e il
   * valore in grassetto sotto. Sostituisce la vecchia riga continua separata da
   * punti, che con dieci o piu' valori diventava una massa di testo illeggibile.
   *
   * Disegna solo le misure valorizzate e sceglie da sola quante righe servono;
   * le celle vuote dell'ultima riga restano bianche senza bordo.
   */
  private static drawMisureTable(
    doc: jsPDF, y: number,
    items: { label: string; value: string; forte?: boolean; span?: number }[],
    colonne = 3,
    titolo?: string,
    /**
     * Celle centrate invece che a bandiera. Serve all'anagrafica del referto,
     * che sta sotto il titolo centrato: allineate a sinistra, "Data di
     * nascita" e "Sesso" non cadevano simmetriche rispetto a "VISITA
     * CARDIOLOGICA" e il cardiologo lo vedeva storto (call dell'11 settembre
     * 2026). Centrate, la riga e' simmetrica sull'asse del foglio.
     */
    centrato = false,
    /**
     * Falso per l'anagrafica: li' il grassetto e' il nome del paziente, non un
     * valore fuori norma, e non va colorato.
     */
    evidenzia = true,
    /** Senza i filetti fra le righe: l'anagrafica nel riquadro. */
    senzaFiletti = false,
  ): number {
    const presenti = items.filter((i) => i.value && i.value !== "-");
    if (presenti.length === 0) return y;

    const colW = PW / colonne;

    // Si impagina una riga alla volta invece di riservare il blocco intero:
    // per una tabella di dodici misure lo spazio non c'e' quasi mai in fondo
    // alla pagina, e la tabella scivolava tutta a quella dopo lasciando mezzo
    // foglio bianco. Se il salto capita a meta', la pagina nuova riapre con il
    // nome del modulo. Le tabelle corte invece restano intere: lo decide chi
    // apre la sezione, con `spazioBlocco`.
    const righeTabella = this.righeMisure(doc, presenti, colonne);
    const altezze = righeTabella.map((r) => r.rowH);
    for (const [i, { riga, spezzate, rowH }] of righeTabella.entries()) {
      const prima = y;
      y = this.saltoPrimaDi(y, altezze, i) ? this.pb(doc, y, Number.POSITIVE_INFINITY) : this.pb(doc, y, rowH + 2);
      if (y !== prima) y = this.segue(doc, y, titolo);

      riga.forEach((cella, i) => {
        const maxW = cella.span * colW - 4;
        // Centrata, la cella si scrive dal suo asse invece che dal filo.
        const cx = centrato
          ? ML + (cella.col + cella.span / 2) * colW
          : ML + cella.col * colW + 2;
        const allinea = centrato ? "center" : "left";

        // Un valore fuori norma, nei modelli che lo vogliono a colori: la cella
        // su fondo tenue e il valore nel secondo colore.
        const acceso = evidenzia && EVIDENZA_COLORE && cella.item.forte;
        if (acceso) {
          this.fascia(doc, ML + cella.col * colW, y + 0.3, cella.span * colW - 2, rowH - 0.6, SECONDO_TINTA, 1.2);
        }

        doc.setFont(F, "normal"); doc.setFontSize(7); this.tc(doc, MODERNO ? K140 : K80);
        const etichetta = MODERNO ? san(cella.item.label).toUpperCase() : san(cella.item.label);
        doc.text(etichetta, cx, y + 3.2, { maxWidth: maxW, align: allinea });

        doc.setFont(F, cella.item.forte || VALORI_GRASSETTO ? "bold" : "normal");
        doc.setFontSize(9); this.tc(doc, acceso ? SECONDO : K0);
        spezzate[i].forEach((linea, n) => {
          doc.text(linea, cx, y + 7.0 + n * LH, { align: allinea });
        });
      });

      // 0,15 e non 0,1: sotto quello spessore il filetto sparisce in
      // fotocopia, ed e' quello che al referto succede quasi sempre.
      if (!senzaFiletti) {
        this.dc(doc, MODERNO ? TENUE : K200); doc.setLineWidth(0.15);
        doc.line(ML, y + rowH, MR, y + rowH);
      }
      y += rowH;
    }

    return y + 3;
  }

  /**
   * Le righe di una tabella di misure, con le celle gia' spezzate e l'altezza
   * di ciascuna. La usano il disegno e la misura (`altezzaMisure`): cosi'
   * lo spazio che una sezione chiede e' per costruzione quello che occupa.
   */
  private static righeMisure(
    doc: jsPDF,
    presenti: { label: string; value: string; forte?: boolean; span?: number }[],
    colonne: number,
  ) {
    const colW = PW / colonne;
    // 8,4 mm per riga: etichetta, valore e filetto con un millimetro d'aria
    // fra l'uno e l'altro. Erano 9, e con quattro righe di ecocardiogramma e
    // sei di ematochimici il mezzo millimetro si vedeva in fondo al foglio.
    const RIGA_BASE = 8.4;

    // Le celle si dispongono per larghezza, non contandole: una voce puo'
    // chiedere piu' colonne con `span`, e quando nella riga non ci sta piu' si
    // va a capo. Serve al nome del paziente, che in una cella da 43 mm veniva
    // troncato senza dirlo: un referto che tronca il cognome e' un referto
    // sbagliato, e mandare a capo il campo accanto costa una riga.
    type Cella = { item: (typeof presenti)[number]; col: number; span: number };
    const righe: Cella[][] = [];
    let corrente: Cella[] = [];
    let col = 0;
    for (const item of presenti) {
      const span = Math.min(Math.max(Math.round(item.span ?? 1), 1), colonne);
      if (col + span > colonne) {
        if (corrente.length) righe.push(corrente);
        corrente = [];
        col = 0;
      }
      corrente.push({ item, col, span });
      col += span;
    }
    if (corrente.length) righe.push(corrente);

    return righe.map((riga) => {
      // Il valore che non entra nella sua cella va a capo dentro la cella, e
      // la riga si alza per contenerlo. Prima veniva disegnata la sola prima
      // riga di testo e il resto spariva.
      const spezzate = riga.map((cella) => {
        doc.setFont(F, cella.item.forte || VALORI_GRASSETTO ? "bold" : "normal");
        doc.setFontSize(9);
        const maxW = cella.span * colW - 4;
        return doc.splitTextToSize(sanValore(cella.item.value), maxW) as string[];
      });
      const massimoRighe = Math.max(1, ...spezzate.map((l) => l.length));
      return { riga, spezzate, rowH: RIGA_BASE + (massimoRighe - 1) * LH };
    });
  }

  /**
   * Se la riga `i` deve andare a capo pagina anche se ci starebbe: succede
   * quando dopo di lei ne resta una sola, e quella sola finirebbe in cima alla
   * pagina dopo. Anticipando il salto di una riga, sulla pagina nuova ne
   * arrivano due.
   */
  private static saltoPrimaDi(y: number, altezze: number[], i: number): boolean {
    if (!this.controlloOrfani) return false;
    const n = altezze.length;
    if (n < RIGHE_MINIME * 2 || i !== n - RIGHE_MINIME) return false;
    const limite = LIMITE;
    const staQuesta = y + altezze[i] + 2 <= limite;
    const stannoTutte = y + altezze[i] + altezze[i + 1] + 2 <= limite;
    return staQuesta && !stannoTutte;
  }

  /**
   * Intestazione di sezione su fascia grigia.
   *
   * Restituisce la quota da cui comincia il contenuto, cioe' il bordo
   * inferiore della fascia piu' un soffio: le tabelle partono da li', la prosa
   * ci aggiunge la distanza della sua prima linea di base. Prima restituiva la
   * linea di base della prosa, e una tabella sotto la fascia aggiungeva la sua
   * distanza a quella: sette millimetri di bianco fra il titolo e i dati.
   *
   * La fascia comincia dove finisce il blocco precedente: l'aria fra i due la
   * lascia chi sta sopra, con l'interlinea della sua ultima riga.
   *
   * `need` e' quello che il titolo si porta dietro, la fascia e la prima riga
   * di contenuto, perche' non resti da solo in fondo alla pagina.
   */
  private static sezione(doc: jsPDF, y: number, titolo: string, need = 22): number {
    y = this.pb(doc, y, need, true);
    // Fascia grigio chiaro da margine a margine, uguale per tutte le sezioni:
    // prosa e dati pesano lo stesso. L'ha scelta il cardiologo sui referti
    // stampati (mail del 9 settembre 2026) al posto del filetto sotto la
    // parola, e l'11 settembre l'ha voluta anche su ogni esame, al posto del
    // titolo "Esami strumentali" che li raccoglieva: una fascia per voce e
    // nessun gruppo sopra.
    // Nei modelli che la vogliono sottolineata la fascia diventa un filetto:
    // stessa altezza, quindi stessa impaginazione.
    const stile = this.m.stileSezioni;
    const testo = san(titolo).toUpperCase();
    // La spaziatura fra le lettere fa leggere il maiuscoletto come
    // un'intestazione e non come una parola urlata.
    const spaziatura = stile === "centrate" ? 0.8 : MODERNO ? 0.6 : 0.35;
    if (stile === "centrate") {
      // Al centro fra due filetti sottili, come i capitoli di una lettera.
      doc.setFont(F, "bold"); doc.setFontSize(8.6);
      const filo = mescola(SECONDO, BIANCO, 0.3);
      // Un titolo rinominato lungo resta su una riga, dentro i margini e con
      // un pezzo di filetto per parte.
      this.rigaCheSta(doc, testo, PW - 10, (t, largo) => {
        const x = CX - largo / 2;
        this.rule(doc, y + 2.7, ML, Math.max(ML, x - 3.5), 0.25, filo);
        this.rule(doc, y + 2.7, Math.min(MR, x + largo + 3.5), MR, 0.25, filo);
        this.tc(doc, TITOLI);
        doc.text(t, x, y + 3.9, { charSpace: spaziatura });
      }, spaziatura);
      return y + FASCIA_H + ARIA_SOTTO_FASCIA;
    }
    if (stile === "sottolineato") {
      this.dc(doc, ACCENTO); doc.setLineWidth(0.3);
      doc.line(ML, y + FASCIA_H - 0.2, MR, y + FASCIA_H - 0.2);
    } else if (stile === "punto") {
      // Niente fasce ne' filetti: un quadratino del secondo colore davanti.
      doc.setFillColor(SECONDO[0], SECONDO[1], SECONDO[2]);
      if (TONDI) doc.circle(ML + 1.1, y + 2.85, 1.1, "F");
      else doc.rect(ML, y + 1.75, 2.2, 2.2, "F");
    } else if (stile === "piena") {
      // Fascia piena del colore principale e titolo in bianco: si vede da
      // lontano dove comincia ogni parte.
      this.fascia(doc, ML, y, PW, FASCIA_H, this.coloreBanda());
    } else {
      this.fascia(doc, ML, y, PW, FASCIA_H, FASCIA);
      // "barra": una barretta del colore principale sul filo sinistro.
      if (stile === "barra") {
        doc.setFillColor(ACCENTO[0], ACCENTO[1], ACCENTO[2]);
        doc.rect(ML, y, 1.3, FASCIA_H, "F");
      }
    }

    doc.setFont(F, "bold"); doc.setFontSize(8.6);
    this.tc(doc, stile === "piena" ? [255, 255, 255] : TITOLI);
    const xTitolo = stile === "sottolineato" ? ML
      : stile === "barra" ? ML + 4.5
        : stile === "punto" ? ML + 4.4
          : stile === "piena" ? ML + 2.5
            : ML + 2;
    // La fascia e' alta una riga: un titolo rinominato lungo non va a capo,
    // si stringe.
    this.rigaCheSta(doc, testo, MR - xTitolo - 2, (t) => {
      doc.text(t, xTitolo, y + 3.9, { charSpace: spaziatura });
    }, spaziatura);

    return y + FASCIA_H + ARIA_SOTTO_FASCIA;
  }

  /**
   * Ripete il nome del modulo in cima alla pagina quando la sua tabella si e'
   * spezzata.
   *
   * Senza, la pagina nuova si apriva con due righe di misure orfane: chi legge
   * trovava "STENOSI MASSIMA 35%" senza sapere a quale esame appartenesse,
   * perche' il titolo era rimasto sulla pagina prima.
   */
  private static segue(doc: jsPDF, y: number, titolo: string | undefined): number {
    if (!titolo) return y;
    doc.setFont(F, "bolditalic"); doc.setFontSize(7); this.tc(doc, K80);
    doc.text(san(`${titolo} (segue)`), ML, y + 2.4);
    return y + 5.5;
  }

  /**
   * Cognome in maiuscolo e nome in tondo: "PROVA Mario".
   *
   * Scritti tutti e due allo stesso modo non si capisce quale sia quale, e su
   * un referto che arriva sulla scrivania di qualcun altro e' la prima cosa
   * che si legge. E' la convenzione dei referti ospedalieri, e costa niente.
   */
  private static nomePaziente(patient: Patient): string {
    const cognome = (patient.cognome ?? "").trim();
    const nome = (patient.nome ?? "").trim();
    return [cognome.toUpperCase(), nome].filter(Boolean).join(" ");
  }

  /**
   * L'inquadramento clinico in riquadri, due per riga, come nel referto
   * "blu e azzurro" che Pablo ha mandato (30 ottobre 2026): ogni modulo in un
   * riquadro col nome nel secondo colore, le righe etichetta | valore e sotto
   * il testo del cardiologo. I due riquadri di una riga sono alti uguali;
   * l'ultimo, se resta solo, prende tutta la larghezza invece di lasciare un
   * buco accanto.
   *
   * Un riquadro non si spezza fra due pagine: se una riga di riquadri non sta
   * nemmeno in una pagina intera (un testo lunghissimo) restituisce `null`, e
   * chi chiama stampa l'elenco di sempre.
   */
  private static drawSchedeInRiquadri(
    doc: jsPDF, y: number, titolo: string, schede: SchedaInquadramento[],
  ): number | null {
    if (schede.length === 0) return y;
    const meta = (PW - RIQ_SPAZIO) / 2;
    const file: { x: number; w: number; s: SchedaInquadramento }[][] = [];
    for (let i = 0; i < schede.length; i += 2) {
      file.push(i + 1 < schede.length
        ? [{ x: ML, w: meta, s: schede[i] }, { x: ML + meta + RIQ_SPAZIO, w: meta, s: schede[i + 1] }]
        : [{ x: ML, w: PW, s: schede[i] }]);
    }
    const misurate = file.map((fila) => {
      const celle = fila.map((c) => ({ ...c, imp: this.impaginaScheda(doc, c.s, c.w) }));
      return { celle, h: Math.max(...celle.map((c) => c.imp.h)) };
    });
    const testata = FASCIA_H + ARIA_SOTTO_FASCIA;
    if (misurate.some((f) => f.h + 2 > LIMITE - INIZIO_SEGUENTI_REFERTO - testata)) return null;

    // Il titolo del gruppo non resta in fondo alla pagina senza la prima riga
    // di riquadri.
    y = this.sezione(doc, y, titolo, testata + misurate[0].h + 2);
    misurate.forEach(({ celle, h }, i) => {
      if (i > 0) y += RIQ_SPAZIO - 1;
      y = this.pb(doc, y, h + 2);
      for (const c of celle) this.disegnaScheda(doc, c.x, y, c.w, h, c.s, c.imp);
      y += h;
    });
    return y + 3;
  }

  /** Lo stile della prosa nei riquadri: quello del referto. */
  private static prosaScheda(): StileTesto {
    return { font: F, style: "normal", fontSize: CORPO, color: K0 };
  }

  /**
   * Le misure di un riquadro largo `w`: le righe gia' spezzate, le colonne e
   * l'altezza, prima di disegnarlo (il fondo va sotto il testo).
   */
  private static impaginaScheda(doc: jsPDF, s: SchedaInquadramento, w: number) {
    const interno = w - 2 * RIQ_PAD;
    // Le etichette lunghe ("ClCr (Cockcroft-Gault)") vanno a capo nella loro
    // colonna invece di allargarla: nei riquadri stretti il valore ha bisogno
    // dello spazio.
    const colonnaEtichette = Math.min(interno * 0.39, 34);
    const colonnaValori = interno - colonnaEtichette - 2;
    const righe = s.righe
      .filter((r) => r.value && r.value !== "-")
      .map((riga) => {
        const pillola = this.pillolaDi(riga);
        doc.setFont(F, "normal"); doc.setFontSize(8.2);
        const etichetta = doc.splitTextToSize(san(riga.label), colonnaEtichette - 1) as string[];
        doc.setFont(F, pillola || riga.forte || VALORI_GRASSETTO ? "bold" : "normal");
        doc.setFontSize(9);
        // La pillola ha un po' d'aria a destra del testo.
        const valore = doc.splitTextToSize(
          sanValore(riga.value), pillola ? colonnaValori - 2 : colonnaValori,
        ) as string[];
        const hValore = valore.length * LH;
        const hEtichetta = etichetta.length * RIQ_LH_ETICHETTA + (LH - RIQ_LH_ETICHETTA);
        return {
          riga, pillola, etichetta, valore, hValore, hEtichetta,
          h: Math.max(hValore, hEtichetta) + 1.6,
        };
      });
    const righeTesto = this.righeBlock(doc, s.testo, interno, this.prosaScheda());
    const hTesto = righeTesto ? 0.8 + PRIMA_RIGA_PROSA + (righeTesto - 1) * LH_PROSA + 1.6 : 0;
    const h = RIQ_TESTATA + righe.reduce((a, r) => a + r.h, 0) + hTesto + RIQ_FONDO;
    return { righe, interno, colonnaEtichette, h };
  }

  /**
   * La pillola di una riga del riquadro: la classe di rischio e, in bianco e
   * nero, i valori fuori norma. Senza il secondo colore quelli non si
   * distinguerebbero dagli altri, che nel moderno sono tutti in grassetto.
   */
  private static pillolaDi(riga: RigaScheda): RigaScheda["pillola"] {
    if (riga.pillola) return riga.pillola;
    return EVIDENZA_COLORE && riga.forte && this.m.pagina.colore === "nero" ? "accesa" : undefined;
  }

  private static disegnaScheda(
    doc: jsPDF, x: number, y: number, w: number, h: number,
    s: SchedaInquadramento, imp: ReturnType<typeof PdfService.impaginaScheda>,
  ) {
    const nero = this.m.pagina.colore === "nero";
    const fondo = mescola(FASCIA, BIANCO, 0.6);
    doc.setFillColor(fondo[0], fondo[1], fondo[2]);
    this.dc(doc, nero ? K200 : mescola(TENUE, BIANCO, 0.3)); doc.setLineWidth(0.3);
    if (TONDI) doc.roundedRect(x, y, w, h, 2, 2, "FD");
    else doc.rect(x, y, w, h, "FD");

    // Il nome del modulo come i sottotitoli dello stile moderno, con il
    // filetto per tutta la larghezza del riquadro.
    const xi = x + RIQ_PAD;
    doc.setFont(F, "bold"); doc.setFontSize(8.2); this.tc(doc, SECONDO);
    this.rigaCheSta(doc, san(s.titolo).toUpperCase(), imp.interno, (t) => {
      doc.text(t, xi, y + 5.4, { charSpace: 0.4 });
    }, 0.4);
    this.rule(doc, y + 6.9, xi, xi + imp.interno, 0.3, mescola(SECONDO, BIANCO, 0.45));

    let yr = y + RIQ_TESTATA;
    const xv = xi + imp.colonnaEtichette + 2;
    for (const { riga, pillola, etichetta, valore, hValore, hEtichetta, h: hr } of imp.righe) {
      // Etichetta e valore centrati l'uno sull'altro quando uno dei due va a
      // capo; su una riga sola stanno sulla stessa linea di base.
      const hc = Math.max(hValore, hEtichetta);
      const baseValore = yr + 4.1 + (hc - hValore) / 2;
      const baseEtichetta = yr + 4.1 + (hc - hEtichetta) / 2;

      doc.setFont(F, "normal"); doc.setFontSize(8.2); this.tc(doc, MODERNO ? K140 : K80);
      etichetta.forEach((t, n) => doc.text(t, xi + 1, baseEtichetta + n * RIQ_LH_ETICHETTA));

      let colore: readonly number[] = EVIDENZA_COLORE && riga.forte ? SECONDO : K0;
      doc.setFont(F, pillola || riga.forte || VALORI_GRASSETTO ? "bold" : "normal");
      doc.setFontSize(9);
      if (pillola) {
        const accesa = pillola === "accesa" && EVIDENZA_COLORE;
        const largo = Math.max(...valore.map((t) => doc.getTextWidth(t)));
        const alto = hValore;
        const fondoPillola = accesa ? SECONDO_TINTA : FASCIA;
        doc.setFillColor(fondoPillola[0], fondoPillola[1], fondoPillola[2]);
        const [px, py, pw] = [xv - 1.8, baseValore - 3.3, largo + 3.6];
        if (TONDI) doc.roundedRect(px, py, pw, alto, Math.min(alto / 2, 2.4), Math.min(alto / 2, 2.4), "F");
        else doc.rect(px, py, pw, alto, "F");
        colore = accesa ? SECONDO : TITOLI;
      }
      this.tc(doc, colore);
      valore.forEach((t, n) => doc.text(t, xv, baseValore + n * LH));

      yr += hr;
      this.rule(doc, yr, xi, xi + imp.interno, 0.15, nero ? K200 : TENUE);
    }

    this.block(
      doc, s.testo ?? "", xi, yr + 0.8 + PRIMA_RIGA_PROSA, imp.interno, LH_PROSA,
      this.prosaScheda(), false,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── REFERTO DI VISITA ─────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  // VISITA GINECOLOGICA E OSTETRICA
  // ─────────────────────────────────────────────────────────────────────────────

  private static mkGyn(vv: Visit): NonNullable<Visit["ginecologia"]> {
    const t = [vv.conclusioniDiagnostiche, vv.terapie].filter(Boolean).join("\n");
    return {
      gravidanze: 0, parti: 0, aborti: 0, ultimaMestruazione: "", prestazione: vv.anamnesi ?? "",
      problemaClinico: vv.descrizioneClinica ?? "", chirurgiaPregessa: "", allergie: "", familiarita: "",
      terapiaInAtto: "", vaccinazioneHPV: true, esameBimanuale: vv.esamiObiettivo ?? "", speculum: "",
      ecografiaTV: "", accertamenti: "", conclusione: vv.conclusioniDiagnostiche ?? "",
      terapiaSpecifica: t, ecografiaImmagini: []
    };
  }

  private static mkObs(vv: Visit): NonNullable<Visit["ostetricia"]> {
    const t = [vv.conclusioniDiagnostiche, vv.terapie].filter(Boolean).join("\n");
    return {
      settimaneGestazione: "", ultimaMestruazione: "", dataPresunta: "", modalitaConcepimento: "",
      problemaClinico: vv.descrizioneClinica ?? "", gravidanzePrec: 0, partiPrec: 0, abortiPrec: 0,
      pesoPreGravidanza: 0, pesoAttuale: 0, pressioneArteriosa: "", fumaInGravidanza: "",
      pacchettiSigaretteAlGiorno: 0, assunzioneAcidoFolico: "", altezzaUterina: "", battitiFetali: "",
      movimentiFetali: "", esamiEseguiti: "", ecografiaOffice: vv.esamiObiettivo ?? "",
      noteOstetriche: t, prestazione: vv.anamnesi ?? "", esameObiettivo: vv.esamiObiettivo ?? "",
      ecografiaImmagini: [], biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }
    };
  }

  /** Le visite salvate prima delle sezioni ginecologica e ostetrica, ricostruite dai campi piatti. */
  private static norm(visit: Visit): Visit {
    const isG = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica";
    const isO = visit.tipo === "ostetrica";
    const g = visit.ginecologia ?? (isG ? this.mkGyn(visit) : undefined);
    const o = visit.ostetricia ?? (isO ? this.mkObs(visit) : undefined);
    return (g || o) ? { ...visit, ginecologia: g, ostetricia: o } : visit;
  }

  /** Il referto con cui si stampa la visita: l'ostetrica ha il suo. */
  static documentoDellaVisita(visit: Pick<Visit, "tipo">): DocumentoReferto {
    return visit.tipo === "ostetrica" ? "refertoOstetrico" : "referto";
  }

  /** Il colore delle parti grafiche (barre dei percentili, curve): nero in bianco e nero. */
  private static coloreGrafico(): readonly number[] {
    return this.m.pagina.colore === "nero" ? K30 : ACCENTO;
  }

  /** Il bordo e l'intestazione delle tabelle di biometria e flussimetria. */
  private static bordoTabella(): readonly number[] {
    return this.m.pagina.colore === "nero" ? K200 : TENUE;
  }
  private static testoIntestazioneTabella(): readonly number[] {
    return this.m.pagina.colore === "nero" ? K30 : TITOLI;
  }

  /**
   * L'inquadramento in colonne, o nei riquadri dei modelli che li vogliono:
   * ogni colonna ("Datazione", "Storia ostetrica"...) diventa un riquadro col
   * suo nome. Se i riquadri non stanno in una pagina, le colonne di sempre.
   */
  private static drawInquadramentoGinecologico(
    doc: jsPDF, y: number, titolo: string,
    colonne: { header: string; items: { label: string; value: string; forte?: boolean }[] }[],
  ): number {
    if (this.m.inquadramentoInRiquadri) {
      const schede: SchedaInquadramento[] = colonne
        .map((c) => ({
          titolo: c.header,
          righe: c.items.filter((it) => !isInquadramentoValueEmpty(it.value)),
        }))
        .filter((s) => s.righe.length > 0);
      const fine = this.drawSchedeInRiquadri(doc, y, titolo, schede);
      if (fine != null) return fine;
    }
    return this.drawInquadramentoGrid(doc, y, titolo, colonne);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERCENTILE BAR  |----+-------◆--|  78°
  //
  // La barra in linea della biometria, come nel documento di riferimento di
  // Careggi. bx, by = filo sinistro e centro verticale; barW = larghezza a
  // disposizione; p5/p50/p95 = valori di riferimento; patVal = misura.
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawPercentileBar(
    doc: jsPDF,
    bx: number, by: number, barW: number,
    p5: number, p50: number, p95: number,
    patVal: number,
    showGrowthAlert: boolean = false,
    overrideRank?: number | null,
  ): void {
    const PAD_L = 3;
    const PAD_R = 16;  // spazio per il centile a destra
    const lineX0 = bx + PAD_L;
    const lineX1 = bx + barW - PAD_R;
    const lineW = lineX1 - lineX0;

    // Il rango centile determina SIA la posizione del rombo SIA l'etichetta,
    // così barra e numero sono sempre coerenti (anche con override manuale).
    const rank = overrideRank != null ? overrideRank : estimateCentileRank(patVal, p5, p50, p95);

    // Mappa un rango centile (0–100) sulla scala 5°–95° (clamp), identica alla UI:
    // 5° = estremo sinistro, 50° = centro, 95° = estremo destro.
    const toX = (r: number): number => {
      const clamped = Math.min(95, Math.max(5, r));
      return lineX0 + ((clamped - 5) / 90) * lineW;
    };

    const midY = by;
    const tratto = this.coloreGrafico();

    this.dc(doc, K30); doc.setLineWidth(0.35);
    doc.line(lineX0, midY, lineX1, midY);

    const tickH = 1.4;
    doc.setLineWidth(0.35);
    doc.line(lineX0, midY - tickH, lineX0, midY + tickH);
    doc.line(lineX1, midY - tickH, lineX1, midY + tickH);

    // 50° = centro
    const x50 = toX(50);
    doc.setLineWidth(0.3);
    doc.line(x50, midY - tickH * 1.1, x50, midY + tickH * 1.1);

    // Il rombo della paziente, sul percentile e non sul valore grezzo.
    const xPat = toX(rank);
    const dSize = 1.6;
    doc.setFillColor(tratto[0], tratto[1], tratto[2]); this.dc(doc, tratto); doc.setLineWidth(0.1);
    doc.moveTo(xPat, midY - dSize);
    doc.lineTo(xPat + dSize, midY);
    doc.lineTo(xPat, midY + dSize);
    doc.lineTo(xPat - dSize, midY);
    doc.lineTo(xPat, midY - dSize);
    (doc as unknown as { fillStroke: () => void }).fillStroke();

    let pctStr = formatCentileLabel(rank);
    if (showGrowthAlert && getGrowthCategory(rank) !== "AGA") {
      pctStr += ` (${getGrowthCategory(rank)})`; // es. "5° (SGA)"
      doc.setFont(F, "bold");
      this.tc(doc, EVIDENZA_COLORE ? SECONDO : K30);
    } else {
      doc.setFont(F, "normal");
      this.tc(doc, K30);
    }
    doc.setFontSize(7);
    doc.text(pctStr, lineX1 + 2, midY + 1);

    doc.setFont(F, "normal");
    this.tc(doc, K30);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BIOMETRIA FETALE CON LE BARRE DEI PERCENTILI
  //
  // Due misure per riga (DBP+CC, CA+FL), ciascuna con nome, valore e barra;
  // poi il peso fetale stimato a tutta larghezza.
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawBiometriaTable(
    doc: jsPDF, y: number, titolo: string,
    gaWeeks: number | null,
    bpd: number, hc: number, ac: number, fl: number,
    efwGrams: number,
    percentiles?: { bpd?: number; hc?: number; ac?: number; fl?: number; efw?: number },
    /** La formula del peso fetale usata, come la scrive la maschera ("Hadlock IV", "BPD, HC, AC, FL"). */
    formula?: { nome: string; descrizione: string },
  ): number {
    type BioItem = { label: string; unit: string; val: number; param: BiometryParam };
    const items: BioItem[] = [];
    if (bpd > 0) items.push({ label: "DBP", unit: "mm", val: bpd, param: "bpdMm" });
    if (hc > 0) items.push({ label: "CC", unit: "mm", val: hc, param: "hcMm" });
    if (ac > 0) items.push({ label: "CA", unit: "mm", val: ac, param: "acMm" });
    if (fl > 0) items.push({ label: "FL", unit: "mm", val: fl, param: "flMm" });

    const hasEfw = efwGrams > 0;
    if (!items.length && !hasEfw) return y;

    const ROW_H = 8;
    const PAD = 1.8;
    const BLOCK_W = PW / 2;
    const COL_A = 18;      // misura
    const COL_B = 22;      // valore
    const COL_C = BLOCK_W - COL_A - COL_B;  // barra
    const rowCount = Math.ceil(items.length / 2);
    const bordo = this.bordoTabella();
    const intestazione = this.testoIntestazioneTabella();

    // La tabella delle misure e' corta: si tiene intera col suo titolo.
    const tabella = items.length ? ROW_H * (1 + rowCount) : ROW_H * 2;
    y = this.sezione(doc, y, titolo, FASCIA_H + ARIA_SOTTO_FASCIA + tabella + 2);

    const drawHeaderBlock = (bx: number) => {
      this.fascia(doc, bx, y, BLOCK_W, ROW_H, FASCIA, 0.01);
      this.dc(doc, bordo); doc.setLineWidth(0.2);
      doc.rect(bx, y, BLOCK_W, ROW_H, "S");
      doc.setFont(F, "bold"); doc.setFontSize(7.5); this.tc(doc, intestazione);
      doc.text("Misura", bx + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, bordo); doc.setLineWidth(0.15);
      doc.line(bx + COL_A, y, bx + COL_A, y + ROW_H);
      doc.text("Valore", bx + COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      doc.line(bx + COL_A + COL_B, y, bx + COL_A + COL_B, y + ROW_H);
      doc.text("Percentile", bx + COL_A + COL_B + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
    };

    if (items.length > 0) {
      drawHeaderBlock(ML);
      if (items.length > 1) drawHeaderBlock(ML + BLOCK_W);
      this.dc(doc, bordo); doc.setLineWidth(0.2);
      doc.line(ML + BLOCK_W, y, ML + BLOCK_W, y + ROW_H + rowCount * ROW_H);
      y += ROW_H;
    }

    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      y = this.pb(doc, y, ROW_H + 2);
      [0, 1].forEach((side) => {
        const itemIdx = rowIdx * 2 + side;
        if (itemIdx >= items.length) return;
        const item = items[itemIdx];
        const bx = ML + side * BLOCK_W;

        this.dc(doc, bordo); doc.setLineWidth(0.15);
        doc.rect(bx, y, BLOCK_W, ROW_H, "S");

        doc.setFont(F, "bold"); doc.setFontSize(8.5); this.tc(doc, K30);
        doc.text(san(item.label), bx + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
        this.dc(doc, bordo); doc.setLineWidth(0.15);
        doc.line(bx + COL_A, y, bx + COL_A, y + ROW_H);

        doc.setFont(F, VALORI_GRASSETTO ? "bold" : "normal"); doc.setFontSize(8.5); this.tc(doc, K0);
        doc.text(sanValore(`${item.val} ${item.unit}`), bx + COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
        doc.line(bx + COL_A + COL_B, y, bx + COL_A + COL_B, y + ROW_H);

        if (gaWeeks !== null) {
          const ref = getBiometryReferenceAtGa(gaWeeks, item.param);
          if (ref) {
            let overrideRank: number | null | undefined;
            if (percentiles) {
              overrideRank =
                item.param === "bpdMm" ? percentiles.bpd :
                item.param === "hcMm" ? percentiles.hc :
                item.param === "acMm" ? percentiles.ac :
                item.param === "flMm" ? percentiles.fl :
                undefined;
            }
            this.drawPercentileBar(
              doc, bx + COL_A + COL_B, y + ROW_H / 2, COL_C,
              ref.p5, ref.p50, ref.p95, item.val, false, overrideRank,
            );
          }
        }
      });
      y += ROW_H;
    }

    // ── Peso fetale stimato, a tutta larghezza ────────────────────────────────
    if (hasEfw) {
      const EFW_COL_A = 52;   // largo per "PSF - Peso Stimato Fetale"
      const EFW_COL_B = 44;
      const EFW_COL_C = PW - EFW_COL_A - EFW_COL_B;

      if (items.length) y += 2;
      y = this.pb(doc, y, ROW_H * 2 + 2);

      this.fascia(doc, ML, y, PW, ROW_H, FASCIA, 0.01);
      this.dc(doc, bordo); doc.setLineWidth(0.2); doc.rect(ML, y, PW, ROW_H, "S");
      doc.setFont(F, "bold"); doc.setFontSize(7.5); this.tc(doc, intestazione);
      doc.text("Calcolo del peso fetale", ML + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      y += ROW_H;

      y = this.pb(doc, y, ROW_H + 2);
      this.dc(doc, bordo); doc.setLineWidth(0.15); doc.rect(ML, y, PW, ROW_H, "S");

      doc.setFont(F, "bold"); doc.setFontSize(8); this.tc(doc, K30);
      const efwLabel = "PSF - Peso Stimato Fetale";
      const efwLabelLines = doc.splitTextToSize(san(efwLabel), EFW_COL_A - PAD * 2);
      doc.text(efwLabelLines[0] ?? efwLabel, ML + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, bordo); doc.setLineWidth(0.15);
      doc.line(ML + EFW_COL_A, y, ML + EFW_COL_A, y + ROW_H);

      // Il centile del peso: quello inserito o corretto dal medico, se c'e';
      // altrimenti il calcolo Hadlock, come nella maschera.
      let efwRank: number | null = null;
      const storedEfwRank = percentiles?.efw ?? null;
      if (storedEfwRank != null) efwRank = storedEfwRank;
      else if (gaWeeks !== null) efwRank = getCentileForWeight(efwGrams, gaWeeks);
      let efwCentileStr = "";
      const fuoriCrescita = efwRank !== null && getGrowthCategory(efwRank) !== "AGA";
      if (efwRank !== null) {
        const cat = getGrowthCategory(efwRank);
        efwCentileStr = ` (${formatCentileLabel(efwRank)} centile${cat !== "AGA" ? ` - ${cat}` : ""})`;
      }
      doc.setFont(F, VALORI_GRASSETTO || fuoriCrescita ? "bold" : "normal"); doc.setFontSize(8.5);
      this.tc(doc, EVIDENZA_COLORE && fuoriCrescita ? SECONDO : K0);
      doc.text(`${efwGrams} g${efwCentileStr}`, ML + EFW_COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, bordo);
      doc.line(ML + EFW_COL_A + EFW_COL_B, y, ML + EFW_COL_A + EFW_COL_B, y + ROW_H);

      if (gaWeeks !== null) {
        const pesoRef = getWeightPercentiles(gaWeeks);
        if (pesoRef) {
          this.drawPercentileBar(
            doc, ML + EFW_COL_A + EFW_COL_B, y + ROW_H / 2, EFW_COL_C,
            pesoRef.p5, pesoRef.p50, pesoRef.p95, efwGrams, true, efwRank,
          );
        }
      }
      y += ROW_H;

      // La formula sotto la riga, per non sovrapporsi alla barra.
      doc.setFont(F, "italic"); doc.setFontSize(6.5); this.tc(doc, K140);
      // La formula davvero usata, scelta in Impostazioni: prima c'era scritto
      // sempre Hadlock con i quattro diametri, qualunque fosse.
      const nota = formula
        ? `EFW per ${formula.nome} (${formula.descrizione.replace(/BPD/g, "DBP").replace(/HC/g, "CC").replace(/AC/g, "CA").replace(/, /g, "-")})`
        : "EFW per Hadlock (DBP-CC-CA-FL)";
      doc.text(san(nota), ML + PAD, y + 3);
      y += 5;
    }

    return y + 3;
  }

  /**
   * Flussimetria Doppler dell'arteria ombelicale: PI e IR affiancati, ciascuno
   * con la sua barra del percentile. Dai valori diretti, o calcolati da
   * velocita' di picco, telediastolica e media.
   */
  private static drawFlussimetria(
    doc: jsPDF, y: number, titolo: string,
    dop: NonNullable<Visit["ostetricia"]>["flussimetriaOmbelicale"],
    ga: number | null,
  ): number {
    const hasDirect = dop && dop.pi != null && dop.ri != null;
    const hasRaw = dop && dop.psv != null && dop.edv != null && dop.velocitaMedia != null && dop.velocitaMedia !== 0;
    if (!dop || (!hasDirect && !hasRaw)) return y;
    let pi: number;
    let ri: number;
    if (hasDirect) {
      pi = Number(dop.pi);
      ri = Number(dop.ri);
    } else {
      const psv = Number(dop.psv);
      const edv = Number(dop.edv);
      const meanV = Number(dop.velocitaMedia);
      if (!isFinite(psv) || !isFinite(edv) || !isFinite(meanV) || meanV === 0) {
        pi = NaN;
        ri = NaN;
      } else {
        pi = (psv - edv) / meanV;
        ri = psv !== 0 ? (psv - edv) / psv : NaN;
      }
    }
    if (!Number.isFinite(pi) || !Number.isFinite(ri)) return y;

    const ROW_H = 8;
    const PAD = 1.8;
    const BLOCK_W = PW / 2;
    const COL_A = 28;
    const COL_B = 18;
    const COL_C = BLOCK_W - COL_A - COL_B;
    const bordo = this.bordoTabella();

    y = this.sezione(doc, y, titolo, FASCIA_H + ARIA_SOTTO_FASCIA + ROW_H + 2);
    [
      { label: "PI", val: pi, ref: ga != null ? getUmbilicalPiRef(ga) : null },
      { label: "IR", val: ri, ref: ga != null ? getUmbilicalRiRef(ga) : null },
    ].forEach((item, side) => {
      const bx = ML + side * BLOCK_W;
      this.dc(doc, bordo); doc.setLineWidth(0.15); doc.rect(bx, y, BLOCK_W, ROW_H, "S");
      doc.setFont(F, "bold"); doc.setFontSize(8); this.tc(doc, K30);
      doc.text(item.label, bx + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      doc.line(bx + COL_A, y, bx + COL_A, y + ROW_H);
      doc.setFont(F, VALORI_GRASSETTO ? "bold" : "normal"); doc.setFontSize(8.5); this.tc(doc, K0);
      doc.text(fmt2(item.val), bx + COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, bordo);
      doc.line(bx + COL_A + COL_B, y, bx + COL_A + COL_B, y + ROW_H);
      if (item.ref) {
        this.drawPercentileBar(doc, bx + COL_A + COL_B, y + ROW_H / 2, COL_C, item.ref.p5, item.ref.p50, item.ref.p95, item.val);
      }
    });
    return y + ROW_H + 3;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CURVE DI CRESCITA BIOMETRICA (DBP, CC, CA, FL)
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawBiometricCharts(
    doc: jsPDF, points: FetalGrowthPoint[], y: number, titolo: string,
  ): number {
    const GAP = 8;
    const ROW_H = 42;
    // Titolo, nota e due righe di grafici: restano insieme.
    y = this.sezione(doc, y, titolo, FASCIA_H + ARIA_SOTTO_FASCIA + 8 + 2 * ROW_H + 8);

    doc.setFont(F, "italic"); doc.setFontSize(6.5); this.tc(doc, K140);
    doc.text("Curve di riferimento: Hadlock. Valori in mm.", ML, y + 2.5);
    y += 8;

    const CW = (PW - GAP) / 2;
    const AX_L = 10;
    const AX_B = 6;
    const PLOT_W = CW - AX_L;
    const PLOT_H = ROW_H - AX_B - 5;
    const tratto = this.coloreGrafico();

    const drawOne = (
      bx: number, by: number,
      title: string,
      param: BiometryParam,
      yMax: number,
      key: "bpdMm" | "hcMm" | "acMm" | "flMm",
    ) => {
      this.dc(doc, K200); doc.setLineWidth(0.2);
      doc.rect(bx + AX_L, by, PLOT_W, PLOT_H, "S");

      // Asse X da 14 a 40 settimane
      const minW = 14, maxW = 40;
      const toX = (w: number) => bx + AX_L + ((w - minW) / (maxW - minW)) * PLOT_W;
      const toY = (v: number) => by + PLOT_H - (Math.max(0, Math.min(yMax, v)) / yMax) * PLOT_H;

      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.08);
      for (let w = 16; w <= 40; w += 4) doc.line(toX(w), by, toX(w), by + PLOT_H);
      const steps = 4;
      for (let i = 1; i < steps; i++) {
        const yy = by + PLOT_H - (PLOT_H / steps) * i;
        doc.line(bx + AX_L, yy, bx + AX_L + PLOT_W, yy);
      }

      doc.setFont(F, "bold"); doc.setFontSize(7); this.tc(doc, K80);
      doc.text(title, bx + AX_L + PLOT_W / 2, by - 1.5, { align: "center" });

      doc.setFont(F, "normal"); doc.setFontSize(5.5); this.tc(doc, K140);
      for (let w = 14; w <= 40; w += 4) {
        if (w === 14) continue;
        doc.text(String(w), toX(w), by + PLOT_H + 3, { align: "center" });
      }
      for (let i = 0; i <= steps; i++) {
        const val = Math.round((yMax / steps) * i);
        const yy = by + PLOT_H - (val / yMax) * PLOT_H;
        doc.text(String(val), bx + AX_L - 1.5, yy + 1, { align: "right" });
      }

      const weeks = Array.from({ length: maxW - minW + 1 }, (_, i) => minW + i);
      const drawCurve = (pKey: "p5" | "p50" | "p95", color: readonly number[], lw: number) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(lw);
        for (let i = 0; i < weeks.length - 1; i++) {
          const c1 = getBiometryReferenceAtGa(weeks[i], param);
          const c2 = getBiometryReferenceAtGa(weeks[i + 1], param);
          if (c1 && c2) doc.line(toX(weeks[i]), toY(c1[pKey]), toX(weeks[i + 1]), toY(c2[pKey]));
        }
      };
      drawCurve("p5", K200, 0.15);
      drawCurve("p50", K80, 0.25);
      drawCurve("p95", K200, 0.15);

      const validPoints = points
        .filter((p) => p.gaWeeks >= minW && p.gaWeeks <= maxW && (p[key] as number) > 0)
        .sort((a, b) => a.gaWeeks - b.gaWeeks);
      if (validPoints.length > 0) {
        this.dc(doc, tratto); doc.setLineWidth(0.35);
        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          doc.line(toX(p1.gaWeeks), toY(p1[key] as number), toX(p2.gaWeeks), toY(p2[key] as number));
        }
        validPoints.forEach((p, idx) => {
          const px = toX(p.gaWeeks);
          const py = toY(p[key] as number);
          if (idx === validPoints.length - 1) {
            this.dc(doc, tratto); doc.setFillColor(tratto[0], tratto[1], tratto[2]);
            doc.circle(px, py, 1.0, "FD");
          } else {
            this.dc(doc, K140); doc.setFillColor(K235[0], K235[1], K235[2]);
            doc.circle(px, py, 0.8, "FD");
          }
        });
      }
    };

    drawOne(ML, y, "DBP", "bpdMm", 110, "bpdMm");
    drawOne(ML + CW + GAP, y, "CC", "hcMm", 380, "hcMm");
    y += ROW_H + 4;
    drawOne(ML, y, "CA", "acMm", 420, "acMm");
    drawOne(ML + CW + GAP, y, "FL", "flMm", 90, "flMm");
    return y + ROW_H + 2;
  }

  /**
   * Le sezioni del referto ginecologico (anche pediatrico), ciascuna pronta da
   * disegnare nell'ordine del modello.
   */
  private static sezioniGinecologiche(
    doc: jsPDF, patient: Patient, visit: Visit, nv: Visit,
    prefs: Record<string, unknown> | null | undefined,
  ): Partial<Record<SezioneReferto, (y: number) => number | Promise<number>>> {
    const gyn = nv.ginecologia!;
    const isPed = visit.tipo === "ginecologica_pediatrica";
    const peso = Number(gyn.pesoCorporeo) || 0;
    const bmi = computeBmi(peso, patient?.altezza ?? 0);
    const homaIr = computeHomaIr(gyn.glicemiaDigiuno, gyn.insulinemiaDigiuno);
    const partiV = gyn.partiSpontanei != null || gyn.partiCesarei != null
      ? `${gyn.parti} (${gyn.partiSpontanei ?? 0} PS, ${gyn.partiCesarei ?? 0} TC)` : String(gyn.parti);
    const abortiV = gyn.abortiSpontanei != null || gyn.ivg != null
      ? `${gyn.aborti} (${gyn.abortiSpontanei ?? 0} AS, ${gyn.ivg ?? 0} IVG)` : String(gyn.aborti);

    const colonne = isPed
      ? [
          {
            header: "Sviluppo puberale",
            items: [
              { label: "Menarca", value: gyn.menarca ?? "-" },
              { label: "Stadio Tanner (F)", value: gyn.stadioTannerFemmina ?? "-" },
            ],
          },
          {
            header: "Profilassi",
            items: [{ label: "Vaccinazione HPV", value: gyn.vaccinazioneHPV ? "Sì" : "No" }],
          },
        ]
      : [
          {
            header: "Datazione",
            items: [{ label: "U.M.", value: gyn.ultimaMestruazione?.trim() ? fd(gyn.ultimaMestruazione) : "-" }],
          },
          {
            header: "Storia ginecologica",
            items: [
              { label: "Gravidanze (G)", value: String(gyn.gravidanze) },
              { label: "Parti (P)", value: partiV },
              { label: "Aborti (A)", value: abortiV },
            ],
          },
          // Peso e BMI stavano nel blocco della paziente: sono dati della
          // visita, e qui stanno con gli altri.
          {
            header: "Antropometria",
            items: [
              { label: "Peso", value: peso > 0 ? `${peso} kg` : "-" },
              // Fuori dalle fasce normali (le stesse dei chip della maschera) si
              // evidenziano come gli altri valori fuori norma.
              {
                label: "BMI",
                value: bmi != null && peso > 0 ? formatBmiWithBand(bmi) : "-",
                forte: bmi != null && peso > 0 && bmiBand(bmi).key !== "normopeso",
              },
            ],
          },
          ...(homaIr != null
            ? [{
                header: "Assetto metabolico (a digiuno)",
                items: [
                  { label: "Glicemia", value: `${gyn.glicemiaDigiuno} mg/dL` },
                  { label: "Insulinemia", value: `${gyn.insulinemiaDigiuno} microU/mL` },
                  {
                    label: "HOMA-IR",
                    value: formatHomaIrWithBand(homaIr),
                    forte: homaIrBand(homaIr).key !== "normale",
                  },
                ],
              }]
            : []),
        ];

    return {
      inquadramento: (y) => this.drawInquadramentoGinecologico(doc, y, this.tit("inquadramento"), colonne),
      motivo: (y) => this.drawTextSection(doc, y, this.tit("motivo"), gyn.problemaClinico),
      anamnesi: (y) => {
        if (hasAnamnesiStrutturataContent(nv.anamnesiStrutturata)) {
          const cfg = parseAnamnesiConfig(prefs)[isPed ? "ginecologica_pediatrica" : "ginecologica"];
          return this.drawStructuredAnamnesi(doc, y, nv.anamnesiStrutturata!, cfg.campi, cfg.etichette);
        }
        return this.drawTextSection(doc, y, this.tit("anamnesi"), gyn.prestazione);
      },
      esameObiettivo: (y) => this.drawTextSection(doc, y, this.tit("esameObiettivo"), gyn.esameBimanuale, NOTA_SIEOG),
      conclusioni: (y) => this.drawConclusioni(doc, y, gyn.terapiaSpecifica),
    };
  }

  /** Le sezioni del referto ostetrico. */
  private static sezioniOstetriche(
    doc: jsPDF, patient: Patient, nv: Visit,
    prefs: Record<string, unknown> | null | undefined,
    options: VisitPdfOptions | undefined,
  ): Partial<Record<SezioneReferto, (y: number) => number | Promise<number>>> {
    const obs = nv.ostetricia!;
    const formula = (prefs?.formulaPesoFetale as string) || "hadlock4";
    const bio = obs.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 };
    const stime = calcolaStimePesoFetale(bio);
    const stima = stime[formula as keyof typeof stime] ?? stime.hadlock4;
    const ga = parseGestationalWeeks(obs.settimaneGestazione ?? "");
    const efwGrams = (stima?.calcolabile && stima.pesoGrammi != null) ? stima.pesoGrammi : 0;

    const altezza = patient?.altezza ?? 0;
    const bmiDi = (kg: number) =>
      altezza > 0 && kg > 0 ? (kg / Math.pow(altezza / 100, 2)).toFixed(1) : "-";
    const bmiPre = bmiDi(Number(obs.pesoPreGravidanza));
    const bmiNow = bmiDi(Number(obs.pesoAttuale));
    const delta = obs.pesoAttuale && obs.pesoPreGravidanza
      ? `${(Number(obs.pesoAttuale) - Number(obs.pesoPreGravidanza)).toFixed(1)} kg` : "-";
    const fumaMap: Record<string, string> = {
      no: "No", meno_1: "<1 pacc./gg", "1": "1 pacc./gg", "2": "2 pacc./gg",
      "3": "3 pacc./gg", "4": "4 pacc./gg", "5_plus": "5+ pacc./gg",
    };
    const fumo = obs.fumaInGravidanza ? (fumaMap[obs.fumaInGravidanza] ?? obs.fumaInGravidanza)
      : obs.pacchettiSigaretteAlGiorno ? `${obs.pacchettiSigaretteAlGiorno} pacc./gg` : "-";
    const folico = obs.assunzioneAcidoFolico === "si" ? "Sì" : obs.assunzioneAcidoFolico === "no" ? "No" : "-";
    const concMap: Record<string, string> = {
      spontaneo: "Spontaneo", fivet: "FIVET", icsi: "ICSI",
      iui: "IUI/Inseminazione", donazione_ovociti: "Donazione ovociti", altra: "Altra",
    };
    const concep = obs.modalitaConcepimento ? (concMap[obs.modalitaConcepimento] ?? obs.modalitaConcepimento) : "-";
    const partiV = obs.partiPrecSpontanei != null || obs.partiPrecCesarei != null
      ? `${obs.partiPrec} (${obs.partiPrecSpontanei ?? 0} PS, ${obs.partiPrecCesarei ?? 0} TC)` : String(obs.partiPrec);
    const abortiV = obs.abortiPrecSpontanei != null || obs.ivgPrec != null
      ? `${obs.abortiPrec} (${obs.abortiPrecSpontanei ?? 0} AS, ${obs.ivgPrec ?? 0} IVG)` : String(obs.abortiPrec);

    const colonne = [
      {
        header: "Datazione",
        items: [
          { label: "U.M.", value: fd(obs.ultimaMestruazione) },
          { label: "D.P.P.", value: fd(obs.dataPresunta) },
          { label: "Epoca", value: v(obs.settimaneGestazione) },
          { label: "Concepimento", value: concep },
        ],
      },
      {
        header: "Storia ostetrica",
        items: [
          { label: "Gravidanze (G)", value: String(obs.gravidanzePrec) },
          { label: "Parti (P)", value: partiV },
          { label: "Aborti (A)", value: abortiV },
        ],
      },
      {
        header: "Parametri materni",
        items: [
          { label: "Pesi (Pre/Att)", value: `${obs.pesoPreGravidanza || "-"} / ${obs.pesoAttuale || "-"} kg` },
          { label: "Incr. pond.", value: delta },
          { label: "BMI (Pre/Att)", value: `${bmiPre} / ${bmiNow}` },
          { label: "PA", value: v(obs.pressioneArteriosa) },
          { label: "FC", value: obs.frequenzaCardiaca?.trim() ? `${obs.frequenzaCardiaca.trim()} bpm` : "-" },
          { label: "Stile di vita", value: `${fumo} fumo, ${folico} acido folico` },
        ],
      },
    ];

    return {
      inquadramento: (y) => this.drawInquadramentoGinecologico(doc, y, this.tit("inquadramento"), colonne),
      biometria: (y) => this.drawBiometriaTable(
        doc, y, this.tit("biometria"), ga,
        bio.bpdMm, bio.hcMm, bio.acMm, bio.flMm, efwGrams,
        {
          bpd: bio.bpdPercentile,
          hc: bio.hcPercentile,
          ac: bio.acPercentile,
          fl: bio.flPercentile,
          efw: bio.efwPercentile,
        },
        stima ? { nome: stima.nome, descrizione: stima.descrizione } : undefined,
      ),
      flussimetria: (y) => this.drawFlussimetria(doc, y, this.tit("flussimetria"), obs.flussimetriaOmbelicale, ga),
      motivo: (y) => this.drawTextSection(doc, y, this.tit("motivo"), obs.problemaClinico),
      anamnesi: (y) => {
        if (hasAnamnesiStrutturataContent(nv.anamnesiStrutturata)) {
          const cfg = parseAnamnesiConfig(prefs).ostetrica;
          return this.drawStructuredAnamnesi(doc, y, nv.anamnesiStrutturata!, cfg.campi, cfg.etichette);
        }
        return this.drawTextSection(doc, y, this.tit("anamnesi"), obs.prestazione);
      },
      esameObiettivo: (y) => this.drawTextSection(doc, y, this.tit("esameObiettivo"), obs.esameObiettivo, NOTA_SIEOG),
      conclusioni: (y) => this.drawConclusioni(doc, y, obs.noteOstetriche),
      // Le curve escono solo se chi stampa le chiede.
      curve: (y) => {
        if (!options?.includeFetalGrowthChart) return y;
        let pts = options.fetalGrowthDataPoints ? [...options.fetalGrowthDataPoints] : [];
        // Senza storico, un punto dalla visita corrente.
        if (pts.length === 0 && ga != null && ga >= 14 && ga <= 40) {
          pts.push({
            gaWeeks: ga,
            pesoGrammi: efwGrams,
            bpdMm: bio.bpdMm > 0 ? bio.bpdMm : undefined,
            hcMm: bio.hcMm > 0 ? bio.hcMm : undefined,
            acMm: bio.acMm > 0 ? bio.acMm : undefined,
            flMm: bio.flMm > 0 ? bio.flMm : undefined,
          });
        }
        // Solo lo storico fino a questa visita: nessun punto "futuro".
        if (ga != null && pts.length > 0) {
          const gaMax = ga + 0.5; // tolleranza stessa settimana
          pts = pts.filter((p) => p.gaWeeks <= gaMax).sort((a, b) => a.gaWeeks - b.gaWeeks);
        }
        return pts.length > 0 ? this.drawBiometricCharts(doc, pts, y, this.tit("curve")) : y;
      },
    };
  }

  /** Le conclusioni, nel riquadro colorato nei modelli che le vogliono in evidenza. */
  private static drawConclusioni(doc: jsPDF, y: number, testo: string | undefined): number {
    return this.m.conclusioniInEvidenza
      ? this.drawProsaInEvidenza(doc, y, this.tit("conclusioni"), testo)
      : this.drawTextSection(doc, y, this.tit("conclusioni"), testo);
  }

  /**
   * Il referto di una visita.
   *
   * Si impagina due volte al piu': con il controllo degli orfani (nessuna
   * tabella lascia una riga sola su un lato del salto pagina) e, se quel
   * controllo allunga il referto di una pagina, senza. Tenere insieme le righe
   * sposta i blocchi in basso, e sul referto di prova costava un quinto foglio
   * con una riga sola: il cardiologo aveva chiesto di ridurre le pagine, e
   * fra un orfano e un foglio in piu' il foglio in piu' pesa di piu'.
   */
  static async generateVisitPDF(
    patient: Patient,
    visit: Visit,
    options?: VisitPdfOptions,
  ): Promise<Blob | undefined> {
    return (await this.impaginaVisita(patient, visit, options))?.blob;
  }

  /** Il referto della visita ginecologica (anche pediatrica). */
  static async generateGynecologicalPDF(
    patient: Patient, visit: Visit, options?: VisitPdfOptions,
  ): Promise<Blob | undefined> {
    return this.generateVisitPDF(patient, visit, options);
  }

  /** Il referto della visita ostetrica. */
  static async generateObstetricPDF(
    patient: Patient, visit: Visit, options?: VisitPdfOptions,
  ): Promise<Blob | undefined> {
    return this.generateVisitPDF(patient, visit, options);
  }

  /**
   * Il referto con le misure del foglio e, con `conZone`, le parti che
   * l'editor dei modelli rende cliccabili sopra l'anteprima.
   */
  static async impaginaVisita(
    patient: Patient,
    visit: Visit,
    options?: VisitPdfOptions,
    conZone = false,
  ): Promise<DocumentoImpaginato | undefined> {
    return this.inFila(async () => {
      const modello = await this.modelloPer(this.documentoDellaVisita(visit), options?.modello);
      return this.conModello(modello, conZone, async () => {
        const curato = await this.componiReferto(patient, visit, options, true);
        if (!curato || curato.pagine <= 1) return curato;
        const compatto = await this.componiReferto(patient, visit, options, false);
        return compatto && compatto.pagine < curato.pagine ? compatto : curato;
      });
    });
  }

  /** Vedi `conModello`: le zone si raccolgono solo per l'editor. */
  private static raccogliZone = false;

  /**
   * Impagina con il modello dato e, finito il documento, rimette il
   * predefinito: un errore a meta' non deve lasciare i margini di un modello
   * al documento successivo.
   */
  private static async conModello<T>(
    modello: ModelloStampa, conZone: boolean, lavoro: () => Promise<T>,
  ): Promise<T> {
    this.m = modello;
    if (modello.pagina.carattere === "lato") {
      try {
        await caricaLato();
      } catch (e) {
        console.error("Carattere Lato non caricato: si usa Helvetica", e);
      }
    }
    impostaModello(modello);
    this.raccogliZone = conZone;
    this.zone = conZone ? [] : null;
    try {
      return await lavoro();
    } finally {
      this.m = modelloPredefinito("referto");
      impostaModello(this.m);
      this.raccogliZone = false;
      this.zone = null;
    }
  }

  /** Il documento chiuso, con le zone raccolte e le misure del foglio. */
  private static impaginato(doc: jsPDF): DocumentoImpaginato {
    return {
      blob: doc.output("blob") as Blob,
      pagine: doc.getNumberOfPages(),
      zone: this.zone ? [...this.zone] : [],
      larghezza: PAGE_W,
      altezza: PAGE_H,
      ml: ML,
      mr: MR,
    };
  }

  /** Il foglio del modello: A5 per chi lo sceglie su ricetta e certificato. */
  private static nuovoFoglio(): jsPDF {
    const doc = new jsPDF({ unit: "mm", format: PAGE_W === 148 ? "a5" : "a4", orientation: "portrait" });
    // Un carattere che non e' fra i tre di jsPDF va registrato in ogni documento.
    if (F === "lato" && LATO) {
      const stili: [string, string, string][] = [
        ["Lato-Regular.ttf", LATO.LATO_NORMALE, "normal"],
        ["Lato-Bold.ttf", LATO.LATO_GRASSETTO, "bold"],
        ["Lato-Italic.ttf", LATO.LATO_CORSIVO, "italic"],
        ["Lato-BoldItalic.ttf", LATO.LATO_GRASSETTO_CORSIVO, "bolditalic"],
      ];
      for (const [file, dati, stile] of stili) {
        doc.addFileToVFS(file, dati);
        doc.addFont(file, "lato", stile);
      }
    }
    return doc;
  }

  /** Una fascia piena, ad angoli vivi o arrotondati secondo il modello. */
  private static fascia(
    doc: jsPDF, x: number, y: number, w: number, h: number, colore: readonly number[], raggio = 1.3,
  ) {
    doc.setFillColor(colore[0], colore[1], colore[2]);
    if (TONDI) doc.roundedRect(x, y, w, h, raggio, raggio, "F");
    else doc.rect(x, y, w, h, "F");
  }

  /**
   * Una fascia sfumata da sinistra a destra, ritagliata ad angoli arrotondati.
   * jsPDF non sa fare sfumature: sono sessanta strisce di colore vicino, che a
   * stampa non si distinguono.
   */
  private static sfumatura(
    doc: jsPDF, x: number, y: number, w: number, h: number,
    da: readonly number[], a: readonly number[], raggio: number,
  ) {
    doc.saveGraphicsState();
    doc.roundedRect(x, y, w, h, raggio, raggio, null);
    doc.clip();
    doc.discardPath();
    const strisce = 60;
    for (let i = 0; i < strisce; i++) {
      const c = mescola(da, a, i / (strisce - 1));
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(x + (w * i) / strisce, y, w / strisce + 0.2, h, "F");
    }
    doc.restoreGraphicsState();
  }

  /**
   * Il referto, senza la firma sola sull'ultima pagina.
   *
   * Quando la pagina e' piena fino in fondo, il blocco firma non ci sta e
   * finiva da solo sul foglio dopo: una pagina con la sola firma e' brutta, e
   * una firma staccata dal testo che firma e' proprio quello che nei referti
   * si evita. jsPDF disegna subito e non si puo' spostare indietro quello che
   * e' gia' sulla pagina, quindi in quel caso il referto si impagina una
   * seconda volta andando a capo prima, in modo che le ultime righe passino
   * con la firma (vedi `saltoPerLaFirma`).
   */
  private static async componiReferto(
    patient: Patient,
    visit: Visit,
    options: VisitPdfOptions | undefined,
    controlloOrfani: boolean,
  ): Promise<DocumentoImpaginato | undefined> {
    try {
      const prima = await this.impaginaReferto(patient, visit, options, controlloOrfani, null);
      if (prima?.saltoPerLaFirma == null) return prima;
      return (await this.impaginaReferto(
        patient, visit, options, controlloOrfani, prima.saltoPerLaFirma,
      )) ?? prima;
    } finally {
      this.tracciaSalti = null;
      this.saltoForzato = null;
    }
  }

  /**
   * Dove andare a capo perche' la firma non resti sola: due chiamate a `pb`
   * prima della fine, cioe' le ultime due righe. Se cosi' un titolo restasse
   * in fondo alla pagina con meno di due righe sotto, si va a capo dal titolo.
   */
  private static saltoPerLaFirma(traccia: { apre: boolean }[]): number | null {
    let salto = traccia.length - 2;
    if (salto < 0) return null;
    let apertura = salto;
    while (apertura >= 0 && !traccia[apertura].apre) apertura--;
    if (apertura >= 0 && salto - apertura < 3) salto = apertura;
    return salto;
  }

  /**
   * La zona di una sezione del referto, anche quando passa da una pagina
   * all'altra: un rettangolo per pagina.
   */
  private static segnaSezione(
    doc: jsPDF, id: SezioneReferto, paginaInizio: number, y0: number, y1: number,
  ) {
    if (!this.zone) return;
    const paginaFine = doc.getNumberOfPages();
    const cima = INIZIO_SEGUENTI_REFERTO - 1;
    for (let p = paginaInizio; p <= paginaFine; p++) {
      const da = p === paginaInizio ? y0 : cima;
      const a = p === paginaFine ? y1 : LIMITE;
      if (a > da) this.zone.push({ zona: "sezione", sezione: id, pagina: p, y0: da, y1: a });
    }
  }

  private static async impaginaReferto(
    patient: Patient,
    visit: Visit,
    options: VisitPdfOptions | undefined,
    controlloOrfani: boolean,
    saltoForzato: number | null,
  ): Promise<(DocumentoImpaginato & { saltoPerLaFirma: number | null }) | undefined> {
    this.controlloOrfani = controlloOrfani;
    this.tracciaSalti = [];
    this.saltoForzato = saltoForzato;
    // Ogni impaginazione ricomincia le zone: vale quella che viene scelta.
    this.zone = this.raccogliZone ? [] : null;
    const nv = this.norm(visit);
    const ostetrica = this.documentoDellaVisita(visit) === "refertoOstetrico";
    if (ostetrica ? !nv.ostetricia : !nv.ginecologia) return;

    const [doctor, prefs] = await Promise.all([
      DoctorService.getDoctor(),
      PreferenceService.getPreferences(),
    ]);
    const fo: FooterVisibilityOptions = {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
    // Piedi differiti: la numerazione "Pagina 2 di 3" vuole un totale che si
    // conosce solo a documento chiuso.
    this.fCtx = { doctor, opts: fo, differita: true };
    const doc = this.nuovoFoglio();

    // Il referto viaggia: finisce in una cartella di rete, in un gestionale
    // documentale, in un allegato di posta. Senza proprieta' il file e' un
    // "documento senza titolo" che nessuna ricerca trova, mentre il nome del
    // paziente sta gia' nel nome del file e nel corpo del referto.
    // La visita pediatrica ha il suo titolo finche' il modello porta quello di
    // Corioli: un titolo scritto dal medico vale per tutte e due.
    const titoloModello = this.m.titolo.testo;
    const titolo =
      visit.tipo === "ginecologica_pediatrica" && /^visita ginecologica$/i.test(titoloModello.trim())
        ? `${titoloModello.trim()} pediatrica`
        : titoloModello;
    const tipoReferto = `Referto di ${titolo.toLowerCase()}`;
    doc.setProperties({
      title: `${tipoReferto} - ${this.nomePaziente(patient)} - ${fd(visit.dataVisita)}`,
      subject: tipoReferto,
      author: doctor ? `${titoloMedico(doctor)} ${doctor.nome} ${doctor.cognome}`.trim() : "",
      creator: "Corioli",
    });
    doc.setLanguage("it");

    let y = this.drawHeader(doc, titolo, this.m.titolo.sottotitolo, doctor, true, fo);
    // Anagrafica centrata sotto il titolo centrato: vedi `drawMisureTable`.
    y = this.drawPatientBlock(doc, patient, visit.dataVisita, y, "Data visita", {
      centrato: true,
    });

    // Le sezioni si disegnano nell'ordine del modello; quello predefinito e'
    // l'ordine del referto di prima dei modelli (vedi `SEZIONI_REFERTO`).
    const sezioni = ostetrica
      ? this.sezioniOstetriche(doc, patient, nv, prefs, options)
      : this.sezioniGinecologiche(doc, patient, visit, nv, prefs);

    // Una sezione nascosta nel modello non si stampa nemmeno se e' compilata:
    // e' una scelta di chi ha fatto il modello.
    for (const { id, visibile } of this.m.sezioni) {
      const disegna = sezioni[id];
      if (!visibile || !disegna) continue;
      const pagina = doc.getNumberOfPages();
      const inizio = y;
      y = await disegna(y);
      this.segnaSezione(doc, id, pagina, inizio, y);
    }

    // Il blocco firma vuoto (luogo, data e una riga su cui firmare) il
    // cardiologo lo ha tolto: chi firma a penna firma sul foglio stampato.
    // Chi ha caricato l'immagine della sua firma invece la vuole in calce
    // ("avete la firma olografica?", chiesto dal modulo contatti il 6 ottobre
    // 2026), e la puo' togliere dalle impostazioni. Sta prima degli allegati:
    // la firma chiude il referto, le immagini lo seguono. I modelli che la
    // rivogliono accendono la riga per la firma a penna.
    //
    // Senza luogo e data a sinistra, che ricetta e certificato invece hanno:
    // sul referto la data della visita sta gia' nell'intestazione e in cima a
    // ogni pagina, e ripetuta in calce "non convince" (Pablo, 6 ottobre 2026).
    // Anche qui decide il modello, e il predefinito non li ha.
    let saltoPerLaFirma: number | null = null;
    const firmaAmmessa = prefs?.firmaSulReferto !== false;
    const conImmagine =
      Boolean(doctor?.signatureStampImage) && firmaAmmessa && this.m.firma.immagine;
    if (conImmagine || this.m.firma.rigaAPenna) {
      const traccia = [...(this.tracciaSalti ?? [])];
      y = await this.drawSignatureBlock(
        doc, doctor, y, this.m.firma.luogoData ? visit.dataVisita : undefined, firmaAmmessa,
      );
      // Sulla pagina della firma devono esserci almeno due righe: meno, e la
      // firma e' andata a capo da sola o si e' portata dietro un rigo orfano.
      // Si rifa' il referto, una volta sola.
      const paginaFirma = doc.getNumberOfPages();
      const conLaFirma = traccia.filter((v) => v.pagina === paginaFirma).length;
      if (conLaFirma < 2 && paginaFirma > 1 && saltoForzato === null) {
        saltoPerLaFirma = this.saltoPerLaFirma(traccia);
      }
    }

    // Le immagini chiudono il referto, dopo le conclusioni. Stavano prima, e
    // con quattro allegati da 55 mm la sezione che il curante e il paziente
    // cercano per prima finiva dietro una galleria, a pagina tre. Un allegato
    // sta in fondo: e' quello che significa allegato.
    if (options?.includeEcografiaImages) {
      const immagini = ostetrica ? nv.ostetricia?.ecografiaImmagini : nv.ginecologia?.ecografiaImmagini;
      await this.drawImages(doc, immagini, y);
    }

    // Senza immagine della firma, niente blocco firma in calce al referto:
    // luogo, data e riga per la firma erano stati aggiunti sull'esempio dei
    // referti ospedalieri, il cardiologo li ha tolti. Il referto si chiude
    // sulle conclusioni, e il nome del medico e' gia' in testa a ogni pagina.
    // Ricetta, certificato e richiesta di esame la firma la tengono sempre:
    // senza, non varrebbero niente.
    try {
      this.finalizzaPagine(doc, patient, visit.dataVisita, doctor, fo);
      return { ...this.impaginato(doc), saltoPerLaFirma };
    } finally { this.fCtx = null; this.controlloOrfani = true; }
  }

  /**
   * Il titoletto sopra il testo di ricetta, certificato e richiesta, come lo
   * scrive il modello. Vuoto, niente titoletto: il testo parte poco sotto.
   */
  private static titoletto(doc: jsPDF, y: number, testo: string): number {
    if (testo.trim()) return this.heading(doc, y, testo.trim());
    return y + 3;
  }

  /** Telefono ed email, come li vogliono le impostazioni. */
  private static async visibilita(): Promise<FooterVisibilityOptions> {
    const prefs = await PreferenceService.getPreferences();
    return {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
  }

  /**
   * Il corpo di ricetta, certificato e richiesta, in scala con la grandezza
   * del testo del modello: col "normale" sono i corpi di sempre.
   */
  private static corpo(base: number): number {
    return base * (CORPO / 10.5);
  }

  // ─── RICHIESTA ESAME ──────────────────────────────────────────────────────
  static async generateRichiestaEsamePDF(
    patient: Patient, richiesta: RichiestaEsameComplementare, doctor: Doctor | null,
    modello?: ModelloStampa,
  ): Promise<Blob> {
    return (await this.impaginaRichiestaEsame(patient, richiesta, doctor, modello)).blob;
  }

  static async impaginaRichiestaEsame(
    patient: Patient, richiesta: RichiestaEsameComplementare, doctor: Doctor | null,
    modello?: ModelloStampa, conZone = false,
  ): Promise<DocumentoImpaginato> {
    return this.inFila(async () => this.conModello(
      await this.modelloPer("richiestaEsame", modello), conZone, async () => {
        const fo = await this.visibilita();
        this.fCtx = { doctor, opts: fo };
        const doc = this.nuovoFoglio();
        try {
          let y = this.drawHeader(doc, this.m.titolo.testo, this.m.titolo.sottotitolo, doctor, true, fo);
          y = this.drawPatientBlock(doc, patient, richiesta.dataRichiesta, y, "Data richiesta", { showDate: false });
          y += 2;
          const inizio = y;
          y = this.titoletto(doc, y, this.m.testi.principale);
          y = this.block(doc, richiesta.nome, ML + 1, y, PW - 2, this.corpo(LH), {
            font: F, style: "bold", fontSize: CORPO, color: K0,
          });
          if (richiesta.note?.trim()) {
            y += 3;
            y = this.titoletto(doc, y, this.m.testi.secondario);
            y = this.block(doc, richiesta.note, ML + 1, y, PW - 2, this.corpo(LH), {
              font: F, style: "normal", fontSize: this.corpo(9.5), color: K30,
            });
          }
          this.segnaZona(doc, "sezione", inizio - 4, y);
          await this.drawSignatureBlock(doc, doctor, y, richiesta.dataRichiesta);
          this.drawFooter(doc, doctor, fo);
          return this.impaginato(doc);
        } finally {
          this.fCtx = null;
        }
      },
    ));
  }

  // ─── CERTIFICATO ──────────────────────────────────────────────────────────
  static async generateCertificatoPDF(
    patient: Patient, certificato: CertificatoPaziente, doctor: Doctor | null,
    modello?: ModelloStampa,
  ): Promise<Blob> {
    return (await this.impaginaCertificato(patient, certificato, doctor, modello)).blob;
  }

  static async impaginaCertificato(
    patient: Patient, certificato: CertificatoPaziente, doctor: Doctor | null,
    modello?: ModelloStampa, conZone = false,
  ): Promise<DocumentoImpaginato> {
    return this.inFila(async () => this.conModello(
      await this.modelloPer("certificato", modello), conZone, async () => {
        const fo = await this.visibilita();
        this.fCtx = { doctor, opts: fo };
        const doc = this.nuovoFoglio();
        try {
          const tipoL: Record<CertificatoPaziente["tipo"], string> = {
            assenza_lavoro: "Assenza da lavoro", idoneita: "Idoneità", malattia: "Malattia", altro: "Altro",
          };
          // Senza sottotitolo nel modello, sotto il titolo va il tipo di certificato.
          const sottotitolo = this.m.titolo.sottotitolo || tipoL[certificato.tipo] || certificato.tipo;
          let y = this.drawHeader(doc, this.m.titolo.testo, sottotitolo, doctor, true, fo);
          y = this.drawPatientBlock(doc, patient, certificato.dataCertificato, y, "Data certificato", { showDate: false });
          y += 2;
          const inizio = y;
          y = this.titoletto(doc, y, this.m.testi.principale);
          y = this.block(doc, certificato.descrizione || "", ML + 1, y, PW - 2, this.corpo(LH + 0.6), {
            font: F, style: "normal", fontSize: this.corpo(10), color: K30,
          });
          this.segnaZona(doc, "sezione", inizio - 4, y);
          await this.drawSignatureBlock(doc, doctor, y, certificato.dataCertificato);
          this.drawFooter(doc, doctor, fo);
          return this.impaginato(doc);
        } finally {
          this.fCtx = null;
        }
      },
    ));
  }

  // ─── RICETTA ──────────────────────────────────────────────────────────────
  static async generateRicettaPDF(
    patient: Patient, ricetta: RicettaPaziente, doctor: Doctor | null,
    modello?: ModelloStampa,
  ): Promise<Blob> {
    return (await this.impaginaRicetta(patient, ricetta, doctor, modello)).blob;
  }

  static async impaginaRicetta(
    patient: Patient, ricetta: RicettaPaziente, doctor: Doctor | null,
    modello?: ModelloStampa, conZone = false,
  ): Promise<DocumentoImpaginato> {
    return this.inFila(async () => this.conModello(
      await this.modelloPer("ricetta", modello), conZone, async () => {
        const fo = await this.visibilita();
        this.fCtx = { doctor, opts: fo };
        const doc = this.nuovoFoglio();
        try {
          let y = this.drawHeader(doc, this.m.titolo.testo, this.m.titolo.sottotitolo, doctor, true, fo);
          y = this.drawPatientBlock(doc, patient, ricetta.dataRicetta, y, "Data ricetta", { showDate: false });
          y += 2;
          const inizio = y;
          y = this.titoletto(doc, y, this.m.testi.principale);

          const testoRicetta = getRicettaTesto(ricetta);
          if (testoRicetta.trim()) {
            y = this.block(doc, testoRicetta, ML + 1, y, PW - 2, this.corpo(LH + 0.6), {
              font: F, style: "normal", fontSize: CORPO, color: K30,
            });
          } else {
            doc.setFont(F, "italic"); doc.setFontSize(9); this.tc(doc, K140);
            doc.text("Nessuna prescrizione indicata.", ML + 1, y + 4);
            y += 10;
          }

          this.segnaZona(doc, "sezione", inizio - 4, y);
          await this.drawSignatureBlock(doc, doctor, y, ricetta.dataRicetta);
          this.drawFooter(doc, doctor, fo);
          return this.impaginato(doc);
        } finally {
          this.fCtx = null;
        }
      },
    ));
  }
}
