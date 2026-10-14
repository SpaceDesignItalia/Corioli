import { codiceFiscaleControlChar } from "../../../utils/codiceFiscale";
import { Doctor, Patient, Visit } from "../../../types/Storage";
import { CdaRsaInput, OID } from "../CdaRsaBuilder";

/** Dati interamente fittizi per test e dimostrazioni. */
const cf = (first15: string) => first15 + codiceFiscaleControlChar(first15);

export const pazienteDemo: Patient = {
  id: "paz-demo-001",
  codiceFiscale: cf("NREGLI94C55D612"),
  nome: "Giulia",
  cognome: "Neri",
  dataNascita: "1994-03-15",
  luogoNascita: "Firenze",
  sesso: "F",
  altezza: 165,
  createdAt: "2026-09-28T09:00:00.000Z",
  updatedAt: "2026-09-28T09:00:00.000Z",
};

export const medicoDemo: Doctor = {
  id: "med-demo-001",
  nome: "Laura",
  cognome: "Conti",
  email: "demo@example.com",
  specializzazione: "Ginecologia e Ostetricia",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const visitaDemo: Visit = {
  id: "vis-demo-001",
  patientId: pazienteDemo.id,
  dataVisita: "2026-09-28",
  tipo: "ginecologica",
  descrizioneClinica: "",
  anamnesi: "",
  esamiObiettivo: "",
  conclusioniDiagnostiche: "",
  terapie: "",
  anamnesiStrutturata: {
    familiare: "Madre con diabete mellito tipo 2.",
    fisiologica: "Non fumatrice. Attività fisica saltuaria. Non utilizza contraccezione ormonale.",
    patologica: "Nulla di rilevante.",
    ginecologica: "Menarca a 12 anni. Cicli irregolari da circa un anno (intervallo 40-60 giorni). Ultimo Pap test 2025 negativo.",
    farmacologica: "Nessuna terapia in atto.",
    allergica: "Nessuna allergia nota.",
  },
  ginecologia: {
    gravidanze: 0,
    parti: 0,
    aborti: 0,
    pesoCorporeo: 72,
    glicemiaDigiuno: 92,
    insulinemiaDigiuno: 16,
    ultimaMestruazione: "2026-08-05",
    prestazione: "",
    problemaClinico: "Cicli mestruali irregolari da circa un anno e acne lieve. Richiede inquadramento diagnostico.",
    chirurgiaPregessa: "",
    allergie: "",
    familiarita: "",
    terapiaInAtto: "",
    vaccinazioneHPV: true,
    esameBimanuale:
      "Genitali esterni normoconformati. Speculum: collo roseo, secrezioni fisiologiche.\n" +
      "Ecografia transvaginale: utero anteverso di dimensioni regolari, endometrio lineare di 6 mm. " +
      "Ovaie aumentate di volume (dx 12 ml, sx 11 ml) con oltre 20 follicoli per ovaio di 2-9 mm a disposizione periferica. " +
      "Non versamento nel Douglas.",
    speculum: "",
    ecografiaTV: "",
    accertamenti: "",
    conclusione: "",
    terapiaSpecifica:
      "Quadro clinico-ecografico compatibile con sindrome dell'ovaio policistico (criteri di Rotterdam: " +
      "oligo-anovulazione e morfologia ovarica policistica), associato a insulino-resistenza.\n" +
      "Si consigliano dosaggi ormonali in fase follicolare precoce (LH, FSH, testosterone totale, SHBG, " +
      "17-OH progesterone, AMH, TSH, prolattina) e curva da carico orale di glucosio.\n" +
      "Modifiche dello stile di vita con obiettivo di riduzione ponderale del 5-10%. Controllo con gli esiti degli esami.",
  },
  createdAt: "2026-09-28T09:00:00.000Z",
  updatedAt: "2026-09-28T09:00:00.000Z",
};

export const inputDemo: CdaRsaInput = {
  patient: pazienteDemo,
  visit: visitaDemo,
  doctor: medicoDemo,
  codiceFiscaleMedico: cf("CNTLRA80A41D612"),
  struttura: {
    nome: "Poliambulatorio Demo",
    codiceSts11: "999999",
    codiceReparto: "99999937",
    oidDocumenti: "2.16.840.1.113883.2.9.2.90.4.4",
  },
  prestazioni: [
    {
      codice: "89.26",
      descrizione: "VISITA GINECOLOGICA",
      codeSystem: OID.CATALOGO_NAZIONALE_PRESTAZIONI,
      codeSystemName: "Catalogo Nazionale Prestazioni",
    },
    {
      codice: "88.79.7",
      descrizione: "ECOGRAFIA TRANSVAGINALE",
      codeSystem: OID.CATALOGO_NAZIONALE_PRESTAZIONI,
      codeSystemName: "Catalogo Nazionale Prestazioni",
    },
  ],
  quesito: {
    codice: "626.1",
    descrizione: "Mestruazioni scarse o infrequenti",
    codeSystem: OID.ICD9CM,
    codeSystemName: "ICD-9-CM",
  },
  diagnosi: [
    {
      codice: "256.4",
      descrizione: "Sindrome dell'ovaio policistico",
      codeSystem: OID.ICD9CM,
      codeSystemName: "ICD-9-CM",
    },
  ],
  dataCompilazione: new Date(2026, 8, 28, 11, 30, 0),
};
