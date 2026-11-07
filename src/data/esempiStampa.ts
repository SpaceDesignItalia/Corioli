import type {
  CertificatoPaziente,
  Patient,
  RichiestaEsameComplementare,
  RicettaPaziente,
  Visit,
} from "../types/Storage";
import type { FetalGrowthPoint } from "../services/PdfService";

/**
 * Paziente e documenti inventati per l'anteprima dell'editor dei modelli di
 * stampa. Non stanno nell'archivio e non ci finiscono mai: servono a vedere il
 * foglio con tutte le sezioni piene, che e' l'unico modo di decidere come
 * impaginarle. L'intestazione e la firma invece sono quelle vere del profilo.
 *
 * I due referti di prova sono compilati **tutti**: ogni sezione e ogni misura
 * che il PDF sa stampare, qualche valore fuori norma (per vedere come il
 * modello li evidenzia) e un grassetto nelle conclusioni. Un modello si
 * giudica sul referto piu' lungo che dovra' impaginare, non su quello piu'
 * corto. Il caso e' uno solo e coerente, perche' lo legge un medico: la stessa
 * paziente prima della gravidanza e al terzo trimestre.
 */

const OGGI = new Date().toISOString().slice(0, 10);

/** Una data di qualche giorno fa (o dopo, con un numero negativo). */
function giorniFa(giorni: number): string {
  return new Date(Date.now() - giorni * 86_400_000).toISOString().slice(0, 10);
}

export const PAZIENTE_ESEMPIO: Patient = {
  id: "esempio-modelli-stampa",
  nome: "Giulia",
  cognome: "Bianchi",
  dataNascita: "1991-05-18",
  luogoNascita: "Pisa",
  sesso: "F",
  indirizzo: "Via Roma 12, 56126 Pisa",
  telefono: "333 123 4567",
  altezza: 165,
  codiceFiscale: "BNCGLI91E58G702K",
  createdAt: OGGI,
  updatedAt: OGGI,
};

/** Campi piatti della visita, che i due referti non usano. */
const BASE = {
  patientId: PAZIENTE_ESEMPIO.id,
  dataVisita: OGGI,
  descrizioneClinica: "",
  anamnesi: "",
  esamiObiettivo: "",
  conclusioniDiagnostiche: "",
  terapie: "",
  createdAt: OGGI,
  updatedAt: OGGI,
};

export const VISITA_ESEMPIO: Visit = {
  ...BASE,
  id: "esempio-visita",
  tipo: "ginecologica",
  ginecologia: {
    gravidanze: 1,
    parti: 1,
    partiSpontanei: 1,
    partiCesarei: 0,
    aborti: 0,
    abortiSpontanei: 0,
    ivg: 0,
    pesoCorporeo: 63,
    glicemiaDigiuno: 98,
    insulinemiaDigiuno: 15,
    ultimaMestruazione: giorniFa(16),
    prestazione:
      "Menarca a 12 anni, cicli regolari di 28 giorni con flusso abbondante nei primi due giorni. Un parto spontaneo nel 2021, decorso regolare. Contraccezione con profilattico. Pap test negativo nel 2024. Nega allergie a farmaci. Madre con endometriosi.",
    problemaClinico:
      "Dismenorrea ingravescente da circa un anno, poco responsiva ai FANS, con dispareunia profonda. Desiderio di una seconda gravidanza nei prossimi mesi.",
    chirurgiaPregessa: "",
    allergie: "",
    familiarita: "",
    terapiaInAtto: "",
    vaccinazioneHPV: true,
    esameBimanuale:
      "Utero antiversoflesso, di volume regolare, mobile. Dolorabilità alla mobilizzazione e al fornice posteriore. Ecografia transvaginale: endometrio lineare di 6 mm in fase proliferativa. Ovaio sinistro con formazione cistica uniloculare a contenuto ground glass di 32 x 28 mm, compatibile con endometrioma. Ovaio destro nei limiti, con follicoli antrali. Non versamento nel Douglas.",
    speculum: "",
    ecografiaTV: "",
    accertamenti: "",
    conclusione: "",
    terapiaSpecifica:
      "Quadro compatibile con **endometriosi ovarica sinistra**.\nDienogest 2 mg: 1 cp al giorno in continuo per 6 mesi.\nCA-125 ed ecografia di controllo fra tre mesi. Rivalutazione del desiderio di gravidanza al termine della terapia.",
    ecografiaImmagini: [],
  },
};

export const VISITA_OSTETRICA_ESEMPIO: Visit = {
  ...BASE,
  id: "esempio-visita-ostetrica",
  tipo: "ostetrica",
  ostetricia: {
    settimaneGestazione: "28+3",
    ultimaMestruazione: giorniFa(199),
    dataPresunta: giorniFa(-81),
    modalitaConcepimento: "spontaneo",
    problemaClinico:
      "Controllo del terzo trimestre. Riferisce movimenti fetali ben percepiti. Lieve edema serale alle caviglie.",
    gravidanzePrec: 1,
    partiPrec: 1,
    partiPrecSpontanei: 1,
    partiPrecCesarei: 0,
    abortiPrec: 0,
    abortiPrecSpontanei: 0,
    ivgPrec: 0,
    pesoPreGravidanza: 60,
    pesoAttuale: 69,
    pressioneArteriosa: "118/72",
    frequenzaCardiaca: "84",
    fumaInGravidanza: "no",
    assunzioneAcidoFolico: "si",
    altezzaUterina: "",
    battitiFetali: "",
    movimentiFetali: "",
    esamiEseguiti: "",
    ecografiaOffice: "",
    noteOstetriche:
      "Gravidanza a decorso regolare, crescita fetale **nei limiti** per l'epoca.\nCurva da carico di glucosio a 24 settimane negativa. Prossimo controllo a 32 settimane con ecografia di accrescimento. Proseguire con ferro e acido folico.",
    prestazione:
      "Secondigravida, un parto spontaneo a termine nel 2021. Pregressa endometriosi ovarica sinistra trattata con dienogest. Gruppo sanguigno A Rh positivo. Toxo e rosolia immune.",
    esameObiettivo:
      "Feto singolo in presentazione cefalica, dorso a sinistra. Battito cardiaco fetale presente e ritmico, 142 bpm. Placenta anteriore alta, normoinserita. Liquido amniotico nella norma (falda massima 52 mm). Movimenti fetali attivi.",
    ecografiaImmagini: [],
    biometriaFetale: { bpdMm: 72, hcMm: 263, acMm: 239, flMm: 53 },
    flussimetriaOmbelicale: { pi: 1.05, ri: 0.66, edf: "positivo" },
  },
};

/** Le visite precedenti della gravidanza, per le curve di crescita. */
export const CRESCITA_ESEMPIO: FetalGrowthPoint[] = [
  { gaWeeks: 20.4, pesoGrammi: 340, bpdMm: 48, hcMm: 178, acMm: 153, flMm: 33 },
  { gaWeeks: 24.3, pesoGrammi: 650, bpdMm: 60, hcMm: 222, acMm: 196, flMm: 44 },
  { gaWeeks: 28.4, pesoGrammi: 1150, bpdMm: 72, hcMm: 263, acMm: 239, flMm: 53 },
];

export const RICETTA_ESEMPIO: RicettaPaziente = {
  id: "esempio-ricetta",
  patientId: PAZIENTE_ESEMPIO.id,
  tipo: "bianca",
  dataRicetta: OGGI,
  testo:
    "Dienogest 2 mg: 1 cp al giorno in continuo | 6 mesi\nIbuprofene 600 mg: 1 cp al bisogno, al massimo 3 al giorno, a stomaco pieno\n\nIn caso di sanguinamenti irregolari prolungati contattare lo studio.",
  createdAt: OGGI,
  updatedAt: OGGI,
};

export const CERTIFICATO_ESEMPIO: CertificatoPaziente = {
  id: "esempio-certificato",
  patientId: PAZIENTE_ESEMPIO.id,
  tipo: "idoneita",
  dataCertificato: OGGI,
  descrizione:
    "la paziente, visitata in data odierna, in gravidanza alla 28ª settimana a decorso regolare, può svolgere attività fisica moderata come camminata, nuoto e ginnastica dolce, evitando gli sport di contatto e quelli con rischio di caduta.\nIl presente certificato vale fino al termine della gravidanza.",
  createdAt: OGGI,
  updatedAt: OGGI,
};

export const RICHIESTA_ESEMPIO: RichiestaEsameComplementare = {
  id: "esempio-richiesta",
  patientId: PAZIENTE_ESEMPIO.id,
  nome: "Ecografia ostetrica di accrescimento fetale con flussimetria Doppler",
  note:
    "Gravidanza di 28 settimane a decorso regolare. Controllo dell'accrescimento fetale e della flussimetria dell'arteria ombelicale a 32 settimane.",
  dataRichiesta: OGGI,
  createdAt: OGGI,
  updatedAt: OGGI,
};
