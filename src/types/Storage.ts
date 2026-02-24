// Tipi per i dati dell'applicazione offline
export interface Patient {
  id: string;
  codiceFiscale: string;
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
    altezzaUterina: string;
    battitiFetali: string;
    movimentiFetali: string;
    esamiEseguiti: string;
    ecografiaOffice: string;
    noteOstetriche: string;
    prestazione: string;
    esameObiettivo: string;
    /** Data URL (base64) immagini ecografia */
    ecografiaImmagini?: string[];
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

export interface Doctor {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono?: string;
  specializzazione?: string;
  ambulatori?: Ambulatorio[];
  /** Data URL (base64) della foto profilo */
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
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
  category: 'ginecologia' | 'ostetricia' | 'terapie' | 'esame_complementare';
  section: 'prestazione' | 'esameObiettivo' | 'conclusioni' | 'generale' | 'nome' | 'note';
  label: string;
  text: string;
  note?: string;
  isDefault?: boolean;
}

export interface AppData {
  patients: Patient[];
  visits: Visit[];
  richiesteEsami?: RichiestaEsameComplementare[];
  doctor: Doctor;
  documents: Document[];
  templates?: MedicalTemplate[];
  lastSync?: string;
}

export type BackupImportMode = 'replace' | 'merge';

export interface StorageService {
  // Pazienti
  getPatients(): Promise<Patient[]>;
  getPatientById(id: string): Promise<Patient | null>;
  getPatientByCF(cf: string): Promise<Patient | null>;
  addPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient>;
  updatePatient(id: string, patient: Partial<Patient>): Promise<Patient>;
  deletePatient(id: string): Promise<void>;

  // Visite
  getVisits(): Promise<Visit[]>;
  getVisitsByPatientId(patientId: string): Promise<Visit[]>;
  getVisitById(id: string): Promise<Visit | null>;
  addVisit(visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Visit>;
  updateVisit(id: string, visit: Partial<Visit>): Promise<Visit>;
  deleteVisit(id: string): Promise<void>;

  // Richieste esami complementari (entità separata dalla visita)
  getRichiesteEsamiByPatientId(patientId: string): Promise<RichiestaEsameComplementare[]>;
  getRichiestaEsameById(id: string): Promise<RichiestaEsameComplementare | null>;
  addRichiestaEsame(data: Omit<RichiestaEsameComplementare, 'id' | 'createdAt' | 'updatedAt'>): Promise<RichiestaEsameComplementare>;
  updateRichiestaEsame(id: string, data: Partial<RichiestaEsameComplementare>): Promise<RichiestaEsameComplementare>;
  deleteRichiestaEsame(id: string): Promise<void>;

  // Dottore
  getDoctor(): Promise<Doctor | null>;
  updateDoctor(doctor: Partial<Doctor>): Promise<Doctor>;

  // Documenti
  getDocuments(): Promise<Document[]>;
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
