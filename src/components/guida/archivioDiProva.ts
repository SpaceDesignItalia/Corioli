/**
 * L'archivio della prova guidata: dieci pazienti inventate, con le visite
 * degli ultimi mesi.
 *
 * Serve a far vedere l'app com'e' dopo qualche mese di lavoro, non il primo
 * giorno: le gravidanze in corso nella dashboard, i controlli precedenti che
 * disegnano le curve di crescita, le visite ginecologiche da riaprire. Vive
 * solo in memoria finche' la guida e' aperta (`apriArchivioDiProva`):
 * uscendo, il medico ritrova il suo archivio com'era.
 *
 * Le date si contano da oggi, cosi' la dashboard ha sempre visite recenti e
 * gravidanze in corso. La paziente della prova e' Ferraro: alla 26ª
 * settimana, con i controlli del primo trimestre, della morfologica e della
 * 24ª settimana.
 */

import type {
  Patient,
  RicettaPaziente,
  RichiestaEsameComplementare,
  Visit,
} from "../../types/Storage";
import type { ContenutoArchivioDiProva } from "../../services/StorageServiceFallback";
import { toLocalIsoDate } from "../../utils/dateUtils";
import { codiceFiscaleControlChar } from "../../utils/codiceFiscale";

/** Un codice fiscale valido: i primi 15 caratteri e il carattere di controllo. */
function cf(primi15: string): string {
  return primi15 + codiceFiscaleControlChar(primi15);
}

/** La paziente che la guida fa cercare e visitare. */
export const PAZIENTE_DELLA_PROVA = {
  id: "prova-ferraro",
  cognome: "Ferraro",
  codiceFiscale: cf("FRRCHR92C54G702"),
} as const;

type DatiGinecologia = NonNullable<Visit["ginecologia"]>;
type DatiOstetricia = NonNullable<Visit["ostetricia"]>;

export function creaArchivioDiProva(oggi: Date = new Date()): ContenutoArchivioDiProva {
  /** La data di `n` giorni fa (o fra `-n` giorni), `aaaa-mm-gg`. */
  const fa = (n: number) => {
    const d = new Date(oggi);
    d.setDate(d.getDate() - n);
    return toLocalIsoDate(d);
  };
  const istante = (n: number) => `${fa(n)}T10:00:00.000Z`;
  /** "26+2" per una gravidanza iniziata `giorniUm` giorni prima di oggi, alla visita di `giorniVisita` fa. */
  const epoca = (giorniUm: number, giorniVisita: number) => {
    const g = giorniUm - giorniVisita;
    return `${Math.floor(g / 7)}+${g % 7}`;
  };

  const paziente = (
    id: string, cognome: string, nome: string, nascita: string, primi15: string,
    altro: Partial<Patient> = {},
  ): Patient => ({
    id,
    cognome,
    nome,
    dataNascita: nascita,
    luogoNascita: "Pisa",
    sesso: "F",
    codiceFiscale: cf(primi15),
    telefono: "333 000 0000",
    altezza: 165,
    createdAt: istante(400),
    updatedAt: istante(400),
    ...altro,
  });

  const patients: Patient[] = [
    paziente(PAZIENTE_DELLA_PROVA.id, PAZIENTE_DELLA_PROVA.cognome, "Chiara", "1992-03-14", "FRRCHR92C54G702", { altezza: 168 }),
    paziente("prova-galli", "Galli", "Sara", "1988-07-02", "GLLSRA88L42G702"),
    paziente("prova-rinaldi", "Rinaldi", "Francesca", "1995-11-21", "RNLFNC95S61G702"),
    paziente("prova-moretti", "Moretti", "Elena", "1979-02-08", "MRTLNE79B48G702"),
    paziente("prova-conti", "Conti", "Laura", "1985-05-30", "CNTLRA85E70G702", { altezza: 160 }),
    paziente("prova-esposito", "Esposito", "Giorgia", "1999-09-12", "SPSGRG99P52G702"),
    paziente("prova-bruno", "Bruno", "Anna", "1968-12-03", "BRNNNA68T43G702"),
    paziente("prova-ricci", "Ricci", "Valentina", "1990-04-17", "RCCVLN90D57G702"),
    paziente("prova-marino", "Marino", "Silvia", "1983-08-25", "MRNSLV83M65G702"),
    paziente("prova-colombo", "Colombo", "Martina", "2012-06-10", "CLMMTN12H50G702", { altezza: 152 }),
  ];

  const base = (id: string, patientId: string, giorni: number): Omit<Visit, "tipo"> => ({
    id,
    patientId,
    dataVisita: fa(giorni),
    descrizioneClinica: "",
    anamnesi: "",
    esamiObiettivo: "",
    conclusioniDiagnostiche: "",
    terapie: "",
    createdAt: istante(giorni),
    updatedAt: istante(giorni),
  });

  const ginecologica = (
    id: string, patientId: string, giorni: number, dati: Partial<DatiGinecologia>,
  ): Visit => ({
    ...base(id, patientId, giorni),
    tipo: "ginecologica",
    ginecologia: {
      gravidanze: 0, parti: 0, aborti: 0, ultimaMestruazione: "",
      prestazione: "", problemaClinico: "", chirurgiaPregessa: "", allergie: "",
      familiarita: "", terapiaInAtto: "", vaccinazioneHPV: true, esameBimanuale: "",
      speculum: "", ecografiaTV: "", accertamenti: "", conclusione: "",
      terapiaSpecifica: "", ecografiaImmagini: [],
      ...dati,
    },
  });

  const ostetrica = (
    id: string, patientId: string, giorni: number, giorniUm: number,
    dati: Partial<DatiOstetricia>,
  ): Visit => ({
    ...base(id, patientId, giorni),
    tipo: "ostetrica",
    ostetricia: {
      settimaneGestazione: epoca(giorniUm, giorni),
      ultimaMestruazione: fa(giorniUm),
      dataPresunta: fa(giorniUm - 280),
      modalitaConcepimento: "spontaneo",
      problemaClinico: "", gravidanzePrec: 0, partiPrec: 0, abortiPrec: 0,
      pesoPreGravidanza: 60, pesoAttuale: 60, pressioneArteriosa: "110/70",
      fumaInGravidanza: "no", assunzioneAcidoFolico: "si",
      altezzaUterina: "", battitiFetali: "", movimentiFetali: "",
      esamiEseguiti: "", ecografiaOffice: "", noteOstetriche: "",
      prestazione: "", esameObiettivo: "", ecografiaImmagini: [],
      biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 },
      ...dati,
    },
  });

  // Ferraro: ultima mestruazione 184 giorni fa, oggi alla 26ª settimana.
  const UM_FERRARO = 184;
  const ANAMNESI_FERRARO =
    "Primigravida. Cicli regolari. Nessuna patologia di rilievo, nega allergie. Gruppo sanguigno 0 Rh positivo. Rosolia immune, toxoplasma non immune.";
  const visits: Visit[] = [
    ostetrica("prova-v-ferraro-1", PAZIENTE_DELLA_PROVA.id, 97, UM_FERRARO, {
      problemaClinico: "Prima visita in gravidanza. Nausea mattutina, nessuna perdita ematica.",
      prestazione: ANAMNESI_FERRARO,
      pesoPreGravidanza: 58, pesoAttuale: 59, pressioneArteriosa: "108/68",
      esameObiettivo:
        "ECOGRAFIA OSTETRICA: feto singolo in utero, attività cardiaca presente e regolare. CRL in accordo con l'epoca di amenorrea. Translucenza nucale nella norma.",
      crlMm: 62,
      noteOstetriche: "Gravidanza in accordo con l'epoca. Test combinato a basso rischio. Prossimo controllo con ecografia morfologica a 20 settimane.",
    }),
    ostetrica("prova-v-ferraro-2", PAZIENTE_DELLA_PROVA.id, 43, UM_FERRARO, {
      problemaClinico: "Controllo con ecografia morfologica. Movimenti fetali percepiti da qualche giorno.",
      prestazione: ANAMNESI_FERRARO,
      pesoPreGravidanza: 58, pesoAttuale: 62, pressioneArteriosa: "110/70",
      biometriaFetale: { bpdMm: 48, hcMm: 176, acMm: 152, flMm: 33 },
      esameObiettivo:
        "ECOGRAFIA MORFOLOGICA: anatomia fetale nei limiti per l'epoca. Placenta anteriore alta. Liquido amniotico nella norma.",
      noteOstetriche: "Morfologia fetale regolare. Curva da carico di glucosio a 24-28 settimane.",
    }),
    ostetrica("prova-v-ferraro-3", PAZIENTE_DELLA_PROVA.id, 16, UM_FERRARO, {
      problemaClinico: "Controllo della 24ª settimana. Nessun disturbo.",
      prestazione: ANAMNESI_FERRARO,
      pesoPreGravidanza: 58, pesoAttuale: 64, pressioneArteriosa: "112/70",
      biometriaFetale: { bpdMm: 60, hcMm: 222, acMm: 196, flMm: 44 },
      flussimetriaOmbelicale: { pi: 1.12, ri: 0.69, edf: "positivo" },
      esameObiettivo:
        "ECOGRAFIA OSTETRICA: feto singolo, presentazione podalica, attività cardiaca regolare. Biometria in accordo con l'epoca. Liquido amniotico nella norma.",
      noteOstetriche: "Crescita regolare. Prossimo controllo a 26-28 settimane con curva da carico.",
    }),

    ostetrica("prova-v-galli-1", "prova-galli", 30, 237, {
      gravidanzePrec: 1, partiPrec: 1, partiPrecSpontanei: 1,
      problemaClinico: "Controllo del terzo trimestre.",
      pesoPreGravidanza: 62, pesoAttuale: 71,
      biometriaFetale: { bpdMm: 76, hcMm: 279, acMm: 258, flMm: 57 },
      esameObiettivo: "ECOGRAFIA OSTETRICA: feto cefalico, attività cardiaca regolare, liquido nella norma.",
      noteOstetriche: "Gravidanza a decorso regolare.",
    }),
    ostetrica("prova-v-galli-2", "prova-galli", 3, 237, {
      gravidanzePrec: 1, partiPrec: 1, partiPrecSpontanei: 1,
      problemaClinico: "Controllo a 33 settimane. Contrazioni occasionali serali.",
      pesoPreGravidanza: 62, pesoAttuale: 73,
      biometriaFetale: { bpdMm: 83, hcMm: 302, acMm: 287, flMm: 63 },
      esameObiettivo: "ECOGRAFIA OSTETRICA: feto cefalico, dorso a sinistra. Placenta posteriore normoinserita.",
      noteOstetriche: "Crescita regolare. Tampone vagino-rettale a 36 settimane.",
    }),

    ostetrica("prova-v-rinaldi-1", "prova-rinaldi", 5, 63, {
      problemaClinico: "Test di gravidanza positivo. Lievi perdite ematiche una settimana fa, ora assenti.",
      prestazione: "Primigravida. Nega patologie e allergie.",
      esameObiettivo: "ECOGRAFIA OSTETRICA: camera gestazionale in utero con embrione, battito cardiaco presente. Non distacchi.",
      crlMm: 21,
      noteOstetriche: "Gravidanza intrauterina evolutiva in accordo con l'amenorrea. Esami del primo trimestre.",
    }),

    ginecologica("prova-v-moretti-1", "prova-moretti", 180, {
      gravidanze: 2, parti: 2, partiSpontanei: 2, pesoCorporeo: 68,
      ultimaMestruazione: fa(190),
      problemaClinico: "Menorragia da alcuni mesi.",
      esameBimanuale: "Utero aumentato di volume per fibroma intramurale fundico di 34 mm. Annessi nella norma.",
      terapiaSpecifica: "Fibromatosi uterina. Emocromo e ferritina. Controllo ecografico a sei mesi.",
    }),
    ginecologica("prova-v-moretti-2", "prova-moretti", 12, {
      gravidanze: 2, parti: 2, partiSpontanei: 2, pesoCorporeo: 68,
      ultimaMestruazione: fa(20),
      problemaClinico: "Controllo del fibroma. Flusso migliorato con l'acido tranexamico.",
      esameBimanuale: "Fibroma intramurale fundico di 36 mm, stabile. Endometrio regolare.",
      terapiaSpecifica: "Fibroma stabile. Prosegue la terapia al bisogno, controllo fra un anno.",
    }),

    ginecologica("prova-v-conti-1", "prova-conti", 25, {
      pesoCorporeo: 78, glicemiaDigiuno: 102, insulinemiaDigiuno: 18,
      ultimaMestruazione: fa(70),
      problemaClinico: "Oligomenorrea e acne. Desiderio di gravidanza.",
      esameBimanuale: "Ovaie di aspetto multifollicolare bilateralmente, endometrio sottile.",
      terapiaSpecifica: "Quadro compatibile con sindrome dell'ovaio policistico e insulino-resistenza. Dieta e attività fisica, inositolo. Dosaggi ormonali.",
    }),

    ginecologica("prova-v-esposito-1", "prova-esposito", 60, {
      pesoCorporeo: 55, ultimaMestruazione: fa(68),
      problemaClinico: "Richiesta di contraccezione.",
      esameBimanuale: "Genitali esterni e vagina regolari. Utero e annessi nella norma all'ecografia.",
      terapiaSpecifica: "Avviata contraccezione estroprogestinica. Controllo a tre mesi.",
    }),

    ginecologica("prova-v-bruno-1", "prova-bruno", 40, {
      gravidanze: 3, parti: 2, partiSpontanei: 2, aborti: 1, abortiSpontanei: 1,
      pesoCorporeo: 70,
      problemaClinico: "Vampate e disturbi del sonno. Ultima mestruazione un anno fa.",
      esameBimanuale: "Atrofia vaginale lieve. Endometrio di 3 mm.",
      terapiaSpecifica: "Menopausa. Estriolo vaginale due volte alla settimana. Mammografia e densitometria.",
    }),

    ostetrica("prova-v-ricci-1", "prova-ricci", 120, 370, {
      problemaClinico: "Controllo a 35 settimane.",
      pesoPreGravidanza: 57, pesoAttuale: 67,
      biometriaFetale: { bpdMm: 86, hcMm: 316, acMm: 304, flMm: 66 },
      esameObiettivo: "ECOGRAFIA OSTETRICA: feto cefalico, crescita regolare.",
      noteOstetriche: "In attesa del parto.",
    }),
    ginecologica("prova-v-ricci-2", "prova-ricci", 48, {
      gravidanze: 1, parti: 1, partiSpontanei: 1, pesoCorporeo: 59,
      problemaClinico: "Controllo in puerperio, sei settimane dopo il parto.",
      esameBimanuale: "Utero involuto, perineo ben cicatrizzato. Endometrio sottile.",
      terapiaSpecifica: "Puerperio regolare. Ripresa della contraccezione.",
    }),

    {
      ...ginecologica("prova-v-colombo-1", "prova-colombo", 50, {
        menarca: "12 anni",
        stadioTannerFemmina: "IV",
        problemaClinico: "Cicli irregolari dal menarca.",
        esameBimanuale: "Ecografia sovrapubica: utero e ovaie di aspetto adeguato all'età.",
        terapiaSpecifica: "Irregolarità mestruale fisiologica dei primi anni. Diario dei cicli e controllo a sei mesi.",
      }),
      tipo: "ginecologica_pediatrica",
    },

    ginecologica("prova-v-marino-1", "prova-marino", 8, {
      pesoCorporeo: 62, ultimaMestruazione: fa(15),
      problemaClinico: "Dismenorrea e dispareunia profonda.",
      esameBimanuale: "Formazione cistica ovarica sinistra di 30 mm a contenuto ground glass.",
      terapiaSpecifica: "Endometrioma ovarico sinistro. Dienogest in continuo, controllo a tre mesi.",
    }),
  ];

  const ricettePaziente: RicettaPaziente[] = [
    {
      id: "prova-r-ferraro",
      patientId: PAZIENTE_DELLA_PROVA.id,
      tipo: "bianca",
      dataRicetta: fa(97),
      testo: "Acido folico 400 mcg: 1 cp al giorno fino alla 12ª settimana",
      createdAt: istante(97),
      updatedAt: istante(97),
    },
  ];
  const richiesteEsami: RichiestaEsameComplementare[] = [
    {
      id: "prova-e-ferraro",
      patientId: PAZIENTE_DELLA_PROVA.id,
      nome: "Curva da carico di glucosio (75 g)",
      note: "Gravidanza di 24 settimane, screening del diabete gestazionale.",
      dataRichiesta: fa(16),
      createdAt: istante(16),
      updatedAt: istante(16),
    },
  ];

  return { patients, visits, ricettePaziente, richiesteEsami };
}
