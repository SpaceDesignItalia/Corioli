// Tipi per i dati dell'applicazione offline
export interface Patient {
  /** Identificativo univoco del paziente (UUID). Non usare il codice fiscale come id. */
  id: string;
  /** Codice fiscale, opzionale (non tutti i pazienti lo hanno). */
  codiceFiscale?: string;
  /** True se il CF è stato generato automaticamente in fase di import */
  codiceFiscaleGenerato?: boolean;
  nome: string;
  cognome: string;
  dataNascita: string;
  luogoNascita: string;
  sesso: 'M' | 'F';
  indirizzo?: string;
  telefono?: string;
  email?: string;
  /** Campi clinici opzionali nel profilo */
  gruppoSanguigno?: string;
  allergie?: string;
  altezza?: number; // in cm
  peso?: number; // in kg (utile per BMI iniziale)
  /** Note rapide del medico (visibili in scheda paziente, modificabili al volo) */
  notaBene?: string;
  createdAt: string;
  updatedAt: string;
}

/** Richiesta di esame complementare: entità separata dalla visita, foglio dedicato */
export interface RichiestaEsameComplementare {
  id: string;
  patientId: string;
  nome: string;
  note?: string;
  dataRichiesta: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

/** Certificato medico rilasciato al paziente (assenze, idoneità, malattia, altro) */
export interface CertificatoPaziente {
  id: string;
  patientId: string;
  /** Tipo: assenza lavoro, idoneità, malattia, altro */
  tipo: 'assenza_lavoro' | 'idoneita' | 'malattia' | 'altro';
  dataCertificato: string; // ISO date
  descrizione: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Anamnesi suddivisa per categorie (referto strutturato in stile specialistico).
 * Condivisa tra tutti i tipi di visita. Tutti i campi sono facoltativi.
 * Se valorizzata, sostituisce l'anamnesi singola (`prestazione`) nel referto PDF.
 */
export interface AnamnesiStrutturata {
  familiare?: string;
  fisiologica?: string;
  patologica?: string;
  /** Anamnesi ginecologica (menarca, ciclo, screening, ecc.) */
  ginecologica?: string;
  farmacologica?: string;
  allergica?: string;
  /** Anamnesi del partner (utile in ostetricia/preconcezionale) */
  partner?: string;
  /**
   * Sezioni personalizzate aggiunte dal medico (chiave generata, es. "custom_xxx").
   * Il contenuto è indicizzato per chiave; le etichette stanno in `anamnesiConfig`.
   */
  [key: string]: string | undefined;
}

/** Singolo farmaco in una ricetta */
export interface RicettaFarmaco {
  nome: string;
  posologia: string;
  durata?: string;
}

/** Ricetta / promemoria terapia rilasciato al paziente (PDF cartaceo) */
export interface RicettaPaziente {
  id: string;
  patientId: string;
  /** SSN dematerializzata (promemoria), bianca fuori SSN, promemoria terapia */
  tipo: 'ssn' | 'bianca' | 'promemoria';
  dataRicetta: string; // ISO date
  /** Testo libero della prescrizione (farmaci, posologie e indicazioni insieme). */
  testo?: string;
  /** @deprecated Vecchio formato a elenco; conservato per retrocompatibilità in lettura. */
  farmaci?: RicettaFarmaco[];
  /** @deprecated Confluito in `testo`; conservato per retrocompatibilità in lettura. */
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Singolo campo modificato in una revisione della visita. I valori sono già formattati per la lettura. */
export interface VisitFieldChange {
  /** Chiave tecnica del campo (eventualmente con prefisso sezione, es. "ostetricia.pesoAttuale"). */
  field: string;
  /** Etichetta leggibile in italiano (es. "Ostetricia · Peso attuale"). */
  label: string;
  /** Valore precedente, formattato come stringa per la visualizzazione. */
  previousValue: string;
  /** Nuovo valore, formattato come stringa per la visualizzazione. */
  newValue: string;
}

/**
 * Una voce della cronologia delle modifiche di una visita.
 * Viene salvata in uno store dedicato e indipendente dalla visita/paziente:
 * non deve mai essere eliminata (né eliminando il paziente, né la visita, né col reset totale).
 * Per questo include uno snapshot dei dati di contesto (nome paziente, data visita...).
 */
export interface VisitRevision {
  id: string;
  /** Id della visita a cui si riferisce la modifica. */
  visitId: string;
  /** Id del paziente. */
  patientId: string;
  /** Nome del paziente al momento della modifica (resta leggibile anche se il paziente viene eliminato). */
  patientName?: string;
  /** Data della visita al momento della modifica (snapshot ISO). */
  visitDate: string;
  /** Tipo di visita al momento della modifica. */
  visitType?: string;
  /** Data e ora in cui la modifica è stata salvata (ISO). */
  modifiedAt: string;
  /** Elenco dei campi modificati con il relativo valore precedente. */
  changes: VisitFieldChange[];
}

export interface Visit {
  id: string;
  patientId: string;
  dataVisita: string;
  descrizioneClinica: string;
  anamnesi: string;
  esamiObiettivo: string;
  conclusioniDiagnostiche: string;
  terapie: string;
  tipo?: 'generale' | 'ginecologica' | 'ginecologica_pediatrica' | 'ostetrica';
  /**
   * Anamnesi strutturata condivisa (familiare, fisiologica, patologica, farmacologica, allergica, partner).
   * Presente solo se il medico usa la modalità "anamnesi strutturata". Se valorizzata,
   * ha priorità sull'anamnesi singola (`prestazione`) nella stampa del referto.
   */
  anamnesiStrutturata?: AnamnesiStrutturata;
  // Campi specifici ginecologia
  ginecologia?: {
    gravidanze: number;
    parti: number;
    partiSpontanei?: number;
    partiCesarei?: number;
    aborti: number;
    /** Aborti spontanei (AS) */
    abortiSpontanei?: number;
    /** Interruzioni volontarie gravidanza (IVG) */
    ivg?: number;
    /** Peso corporeo (kg) — usato per il calcolo del BMI */
    pesoCorporeo?: number;
    /** Glicemia a digiuno (mg/dL) — usata per il calcolo dell'HOMA-IR */
    glicemiaDigiuno?: number;
    /** Insulinemia a digiuno (microU/mL) — usata per il calcolo dell'HOMA-IR */
    insulinemiaDigiuno?: number;
    /** Menarca (eta o note) */
    menarca?: string;
    /** Stadio di Tanner (femmina) */
    stadioTannerFemmina?: string;
    ultimaMestruazione: string;
    prestazione: string;
    problemaClinico: string;
    chirurgiaPregessa: string;
    allergie: string;
    familiarita: string;
    terapiaInAtto: string;
    vaccinazioneHPV: boolean;
    esameBimanuale: string;
    speculum: string;
    ecografiaTV: string;
    accertamenti: string;
    conclusione: string;
    terapiaSpecifica: string;
    /** Data URL (base64) immagini ecografia */
    ecografiaImmagini?: string[];
  };
  // Campi specifici ostetricia
  ostetricia?: {
    settimaneGestazione: string;
    ultimaMestruazione: string;
    dataPresunta: string;
    /** Modalità di concepimento: spontaneo, FIVET, ICSI, IUI, donazione ovociti, altra */
    modalitaConcepimento?: string;
    problemaClinico: string;
    gravidanzePrec: number;
    partiPrec: number;
    partiPrecSpontanei?: number;
    partiPrecCesarei?: number;
    abortiPrec: number;
    /** Aborti spontanei precedenti (AS) */
    abortiPrecSpontanei?: number;
    /** Interruzioni volontarie gravidanza precedenti (IVG) */
    ivgPrec?: number;
    pesoPreGravidanza: number;
    pesoAttuale: number;
    pressioneArteriosa: string;
    /** Frequenza cardiaca materna (bpm) */
    frequenzaCardiaca?: string;
    /** Fuma in gravidanza: "si" | "no" */
    fumaInGravidanza?: string;
    /** Pacchetti di sigarette al giorno (se fumatrice) */
    pacchettiSigaretteAlGiorno?: number;
    /** Assunzione acido folico: "si" | "no" */
    assunzioneAcidoFolico?: string;
    altezzaUterina: string;
    battitiFetali: string;
    movimentiFetali: string;
    esamiEseguiti: string;
    ecografiaOffice: string;
    noteOstetriche: string;
    prestazione: string;
    esameObiettivo: string;
    /** CRL in mm (lunghezza vertice-sacro). Se lo scarto con le settimane supera la soglia ACOG, queste vengono aggiornate. */
    crlMm?: number;
    /** Data URL (base64) immagini ecografia */
    ecografiaImmagini?: string[];
    /** Biometria fetale per stima peso (mm). Usato per le 3 scale: Hadlock 4p, Shepard, Hadlock 3p */
    biometriaFetale?: {
      bpdMm: number;
      hcMm: number;
      acMm: number;
      flMm: number;
      /** Percentile BPD (calcolato o manuale) */
      bpdPercentile?: number;
      /** Percentile CC (calcolato o manuale) */
      hcPercentile?: number;
      /** Percentile CA (calcolato o manuale) */
      acPercentile?: number;
      /** Percentile FL (calcolato o manuale) */
      flPercentile?: number;
      /** Percentile peso fetale stimato / EFW (calcolato o manuale) */
      efwPercentile?: number;
    };
    /** Flussimetria Doppler arteria ombelicale. Inserire PI, IR, EDF (GA da Settimane di gestazione). */
    flussimetriaOmbelicale?: {
      /** Pulsatility Index (inserimento diretto) */
      pi?: number;
      /** Indice di resistenza (inserimento diretto) */
      ri?: number;
      /** End diastolic flow: positivo / assente / invertito */
      edf?: "positivo" | "assente" | "invertito";
      /** Percentile del PI (calcolato) */
      piPercentile?: number;
      /** Percentile dell'IR (calcolato) */
      riPercentile?: number;
      /** Retrocompatibilità: velocità per calcolo PI/RI da dati grezzi */
      psv?: number;
      edv?: number;
      velocitaMedia?: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface Ambulatorio {
  id: string;
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  telefono: string;
  email?: string;
  isPrimario: boolean;
}

export type TitoloMedico = "Dott." | "Dott.ssa" | "Prof." | "Prof.ssa";

export interface Doctor {
  id: string;
  /** Assente nei profili creati prima del campo: vale "Dott.". */
  titolo?: TitoloMedico;
  nome: string;
  cognome: string;
  email: string;
  telefono?: string;
  specializzazione?: string;
  /**
   * Partita IVA, solo le 11 cifre. Facoltativa: quando c'e' si stampa
   * nell'intestazione di referti e documenti, sotto i recapiti.
   */
  partitaIva?: string;
  /**
   * Email da stampare su referti e documenti (es. quella della segreteria).
   * Facoltativa: se vuota si stampa `email`, quella dell'account.
   */
  emailDocumenti?: string;
  /**
   * Ultima email confermata con il codice ricevuto (minuscola). Se diversa
   * da `email`, l'email del profilo non è ancora confermata.
   */
  emailVerificata?: string;
  /** Prova firmata dal server per `emailVerificata`. */
  emailVerificataProva?: string;
  ambulatori?: Ambulatorio[];
  /** Data URL (base64) della foto profilo */
  profileImage?: string;
  /** Data URL (base64) immagine timbro e/o firma per i PDF */
  signatureStampImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  /** Se valorizzato, documento associato a uno specifico paziente */
  patientId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'corso_aggiornamento' | 'certificato' | 'altro';
  uploadDate: string;
  expiryDate?: string;
  credits?: number; // Crediti ECM se applicabile
  fileData: string; // Base64 encoded file data
  createdAt: string;
  updatedAt: string;
}

export interface MedicalTemplate {
  id: string;
  category: 'ginecologia' | 'ostetricia' | 'terapie' | 'ricette' | 'esame_complementare' | 'certificato';
  section:
    | 'prestazione'
    | 'esameObiettivo'
    | 'conclusioni'
    | 'generale'
    | 'nome'
    | 'note'
    // Sotto-sezioni dell'anamnesi strutturata
    | 'anamnesiFamiliare'
    | 'anamnesiFisiologica'
    | 'anamnesiPatologica'
    | 'anamnesiGinecologica'
    | 'anamnesiFarmacologica'
    | 'anamnesiAllergica'
    | 'anamnesiPartner'
    // Sezioni personalizzate dell'anamnesi: chiave generata (es. "custom_xxx").
    // `string & {}` mantiene i suggerimenti sui valori noti pur accettando chiavi custom.
    | (string & {});
  label: string;
  text: string;
  note?: string;
  isDefault?: boolean;
}

/**
 * I documenti che Corioli stampa, ciascuno con i suoi modelli di stampa.
 * "referto" e' quello della visita ginecologica (anche pediatrica): la visita
 * ostetrica ha esami e sezioni sue, e quindi un referto e modelli suoi.
 */
export type DocumentoStampa = 'referto' | 'refertoOstetrico' | 'ricetta' | 'certificato' | 'richiestaEsame';

/** Le tinte pronte della tavolozza, o un colore libero "#rrggbb". */
export type ColoreStampa = 'nero' | 'blu' | 'verde' | 'bordeaux' | (string & {});

/**
 * Le sezioni dei referti di visita che il medico puo' spostare, nascondere e
 * rinominare. Biometria, flussimetria e curve di crescita ci sono solo nel
 * referto ostetrico. Le immagini dell'ecografia non ci sono: chiudono sempre
 * il referto.
 */
export type SezioneReferto =
  | 'inquadramento'
  | 'biometria'
  | 'flussimetria'
  | 'motivo'
  | 'anamnesi'
  | 'esameObiettivo'
  | 'conclusioni'
  | 'curve';

/**
 * Modello di stampa: come si impagina un documento, non cosa contiene.
 *
 * Non porta dati del medico ne' dei pazienti: nome, recapiti e firma si
 * leggono dal profilo al momento della stampa. Cosi' un modello si puo'
 * esportare e passare a un collega senza che i dati di chi l'ha fatto finiscano
 * sui referti dell'altro. Le sole cose personali sono quelle che il medico ci
 * scrive o ci carica apposta: il logo e le righe in piu' dell'intestazione.
 */
export interface ModelloStampa {
  id: string;
  documento: DocumentoStampa;
  nome: string;
  pagina: {
    carattere: 'helvetica' | 'times' | 'lato';
    /** Grandezza della prosa: quello che il medico scrive, non le tabelle. */
    testo: 'piccolo' | 'normale' | 'grande';
    margini: 'stretti' | 'normali' | 'larghi';
    /** Colore principale: una tinta della tavolozza o un "#rrggbb" scelto dal medico. */
    colore: ColoreStampa;
    /**
     * Secondo colore, per i particolari (specializzazione, sottotitoli, valori
     * fuori norma): "#rrggbb", o vuoto per usare il principale.
     */
    accento: string;
    /** A5 solo per ricetta, certificato e richiesta: il referto resta A4. */
    formato: 'A4' | 'A5';
    /**
     * Classico: l'impaginazione di sempre. Moderno: nome grande e colorato,
     * specializzazione in maiuscoletto, filetto singolo, etichette delle
     * tabelle in maiuscolo, piede e firma nel colore del modello.
     */
    stile: 'classico' | 'moderno';
    /** Come si segnala un valore fuori norma: in grassetto, o nel secondo colore su fondo tenue. */
    evidenza: 'grassetto' | 'colore';
    /** Angoli delle fasce e dei riquadri. */
    angoli: 'vivi' | 'arrotondati';
  };
  intestazione: {
    /** Si stampa su carta gia' intestata: niente intestazione, spazio vuoto. */
    cartaIntestata: boolean;
    /** Millimetri lasciati liberi in alto e in basso sulla carta intestata. */
    spazioAlto: number;
    spazioBasso: number;
    /**
     * Immagine della carta intestata (data URL JPEG o PNG), a foglio intero.
     * Con `sfondoInStampa` si stampa su ogni pagina (la carta intestata
     * digitale, per i PDF mandati per posta); senza, si vede solo
     * nell'anteprima dell'editor e serve ad allineare il testo alla carta
     * prestampata.
     */
    sfondo?: string;
    sfondoInStampa: boolean;
    /** "banda": nome e recapiti in bianco su una fascia piena in cima al foglio. */
    disposizione: 'lati' | 'centro' | 'banda';
    /** Data URL (PNG o JPEG) del logo dello studio. */
    logo?: string;
    grandezzaLogo: 'piccolo' | 'medio' | 'grande';
    specializzazione: boolean;
    /** Vuoto: l'ambulatorio "in uso" del profilo. */
    ambulatorioId?: string;
    ambulatorio: boolean;
    telefono: boolean;
    email: boolean;
    partitaIva: boolean;
    /** Righe libere sotto i recapiti, una per riga. */
    righeAggiuntive: string;
  };
  titolo: {
    testo: string;
    sottotitolo: string;
    /**
     * "sfumato": fascia arrotondata dal colore principale al secondo, tenui.
     * "sinistra": grande, com'e' scritto, allineato a sinistra con una barretta sotto.
     */
    stile: 'fascia' | 'sottolineato' | 'testo' | 'sfumato' | 'sinistra';
  };
  paziente: {
    /** I dati del paziente in un riquadro col bordo, invece che fra due filetti. */
    riquadro: boolean;
    dataNascita: boolean;
    luogoNascita: boolean;
    sesso: boolean;
    codiceFiscale: boolean;
    residenza: boolean;
    /** Ricetta, certificato e richiesta: la data accanto al paziente (il referto la ha sempre). */
    data: boolean;
  };
  /**
   * Ricetta, certificato e richiesta: i titoletti sopra il testo
   * ("Prescrizione", "Si certifica che"...). Vuoto: nessun titoletto.
   */
  testi: { principale: string; secondario: string };
  /** Solo referto: ordine, visibilita' e titolo (vuoto = quello di Corioli). */
  sezioni: { id: SezioneReferto; titolo: string; visibile: boolean }[];
  /**
   * "barra": fascia tenue con una barretta del colore principale a sinistra.
   * "centrate": al centro fra due filetti. "punto": un quadratino davanti,
   * niente fasce. "piena": fascia del colore principale, titolo in bianco.
   */
  stileSezioni: 'fascia' | 'sottolineato' | 'barra' | 'centrate' | 'punto' | 'piena';
  /** Solo referto: le conclusioni in un riquadro colorato, in grassetto. */
  conclusioniInEvidenza: boolean;
  /**
   * Solo referto: scompenso, fibrillazione atriale e rischio cardiovascolare
   * in riquadri affiancati, con la classe di rischio in una pillola, invece
   * che uno sotto l'altro.
   */
  inquadramentoInRiquadri: boolean;
  firma: {
    /** L'immagine della firma dal profilo, se c'e'. */
    immagine: boolean;
    luogoData: boolean;
    posizione: 'sinistra' | 'centro' | 'destra';
    grandezza: 'piccola' | 'normale' | 'grande';
    /** Solo referto: la riga per firmare a penna anche senza immagine. */
    rigaAPenna: boolean;
  };
  piede: {
    /** Solo referto: "Pagina 1 di 2". */
    numeroPagina: boolean;
    /** Solo referto: nome del paziente in cima alle pagine dopo la prima. */
    pazienteSullePagine: boolean;
    testo: string;
  };
  creatoIl: string;
  aggiornatoIl: string;
}

/** Tutti i modelli di stampa e quello in uso per ogni documento. */
export interface ArchivioModelliStampa {
  modelli: ModelloStampa[];
  /** Id del modello in uso; assente, il predefinito di Corioli. */
  inUso: Partial<Record<DocumentoStampa, string>>;
}

export interface AppData {
  /** Versione dello schema del backup (assente nei backup prodotti prima della 1.3.2). */
  schemaVersion?: number;
  /** Versione dell'app che ha generato il backup. */
  appVersion?: string;
  /** Data/ora di generazione (ISO). */
  exportedAt?: string;
  patients: Patient[];
  visits: Visit[];
  /** Cronologia delle modifiche delle visite (store indipendente, non viene mai cancellata). */
  visitRevisions?: VisitRevision[];
  richiesteEsami?: RichiestaEsameComplementare[];
  certificatiPaziente?: CertificatoPaziente[];
  ricettePaziente?: RicettaPaziente[];
  doctor: Doctor;
  documents: Document[];
  templates?: MedicalTemplate[];
  /** Modelli di stampa (assenti nei backup prodotti prima che ci fossero). */
  modelliStampa?: ArchivioModelliStampa;
  lastSync?: string;
}

export type BackupImportMode = 'replace' | 'merge';

export interface StorageService {
  // Pazienti
  getPatients(): Promise<Patient[]>;
  countPatients(): Promise<number>;
  getPatientById(id: string): Promise<Patient | null>;
  getPatientByCF(cf: string): Promise<Patient | null>;
  addPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient>;
  updatePatient(id: string, patient: Partial<Patient>): Promise<Patient>;
  deletePatient(id: string): Promise<void>;

  // Visite
  getVisits(): Promise<Visit[]>;
  /** Visite senza immagini ecografiche: solo per elenchi, non da salvare. */
  getVisitsWithoutImages(): Promise<Visit[]>;
  countVisits(): Promise<number>;
  getVisitsByPatientId(patientId: string): Promise<Visit[]>;
  getVisitById(id: string): Promise<Visit | null>;
  addVisit(visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Visit>;
  updateVisit(id: string, visit: Partial<Visit>): Promise<Visit>;
  deleteVisit(id: string): Promise<void>;

  /** Cronologia modifiche visite (store dedicato, mai cancellato dalle eliminazioni o dal reset). */
  getVisitRevisions(): Promise<VisitRevision[]>;

  // Richieste esami complementari (entità separata dalla visita)
  getAllRichiesteEsami(): Promise<RichiestaEsameComplementare[]>;
  getRichiesteEsamiByPatientId(patientId: string): Promise<RichiestaEsameComplementare[]>;
  getRichiestaEsameById(id: string): Promise<RichiestaEsameComplementare | null>;
  addRichiestaEsame(data: Omit<RichiestaEsameComplementare, 'id' | 'createdAt' | 'updatedAt'>): Promise<RichiestaEsameComplementare>;
  updateRichiestaEsame(id: string, data: Partial<RichiestaEsameComplementare>): Promise<RichiestaEsameComplementare>;
  deleteRichiestaEsame(id: string): Promise<void>;

  // Certificati paziente
  getCertificatiByPatientId(patientId: string): Promise<CertificatoPaziente[]>;
  getCertificatoById(id: string): Promise<CertificatoPaziente | null>;
  addCertificato(data: Omit<CertificatoPaziente, 'id' | 'createdAt' | 'updatedAt'>): Promise<CertificatoPaziente>;
  updateCertificato(id: string, data: Partial<CertificatoPaziente>): Promise<CertificatoPaziente>;
  deleteCertificato(id: string): Promise<void>;

  // Ricette paziente
  getRicetteByPatientId(patientId: string): Promise<RicettaPaziente[]>;
  getRicettaById(id: string): Promise<RicettaPaziente | null>;
  addRicetta(data: Omit<RicettaPaziente, 'id' | 'createdAt' | 'updatedAt'>): Promise<RicettaPaziente>;
  updateRicetta(id: string, data: Partial<RicettaPaziente>): Promise<RicettaPaziente>;
  deleteRicetta(id: string): Promise<void>;

  // Dottore
  getDoctor(): Promise<Doctor | null>;
  updateDoctor(doctor: Partial<Doctor>): Promise<Doctor>;

  // Documenti
  getDocuments(): Promise<Document[]>;
  countDocuments(): Promise<number>;
  getDocumentsByPatientId(patientId: string): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | null>;
  addDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document>;
  updateDocument(id: string, document: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Template
  getTemplates(): Promise<MedicalTemplate[]>;
  addTemplate(template: Omit<MedicalTemplate, 'id'>): Promise<MedicalTemplate>;
  updateTemplate(id: string, template: Partial<MedicalTemplate>): Promise<MedicalTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // Backup/Export
  exportData(): Promise<AppData>;
  importData(data: AppData, mode?: BackupImportMode): Promise<void>;
  clearAllData(): Promise<void>;
}
