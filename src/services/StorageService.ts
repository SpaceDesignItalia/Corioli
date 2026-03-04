import { StorageService, Patient, Visit, Doctor, AppData, BackupImportMode, RichiestaEsameComplementare } from '../types/Storage';

class LocalStorageService implements StorageService {
  private dbName = 'AppDottoriDB';
  private version = 2;
  private db: IDBDatabase | null = null;

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    // Controlla se IndexedDB è disponibile
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB non è disponibile in questo ambiente');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store per i pazienti
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
          patientStore.createIndex('codiceFiscale', 'codiceFiscale', { unique: true });
          patientStore.createIndex('nome', 'nome');
          patientStore.createIndex('cognome', 'cognome');
        }

        // Store per le visite
        if (!db.objectStoreNames.contains('visits')) {
          const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
          visitStore.createIndex('patientId', 'patientId');
          visitStore.createIndex('dataVisita', 'dataVisita');
        }

        // Store per il dottore
        if (!db.objectStoreNames.contains('doctor')) {
          db.createObjectStore('doctor', { keyPath: 'id' });
        }

        // Store per richieste esami complementari (entità separata dalla visita)
        if (!db.objectStoreNames.contains('richieste_esami')) {
          const reStore = db.createObjectStore('richieste_esami', { keyPath: 'id' });
          reStore.createIndex('patientId', 'patientId');
        }
      };
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const hex = '0123456789abcdef';
    const r = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
    return `${r(8)}-${r(4)}-4${r(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${r(3)}-${r(12)}`;
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  // Pazienti
  async getPatients(): Promise<Patient[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['patients'], 'readonly');
      const store = transaction.objectStore('patients');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPatientById(id: string): Promise<Patient | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['patients'], 'readonly');
      const store = transaction.objectStore('patients');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getPatientByCF(cf: string): Promise<Patient | null> {
    const normalizedCf = String(cf || '').trim().toUpperCase();
    if (!normalizedCf) return null;
    const patients = await this.getPatients();
    return (
      patients.find(
        (p) => String(p.codiceFiscale || "").trim().toUpperCase() === normalizedCf
      ) || null
    );
  }

  async addPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient> {
    const db = await this.initDB();
    const cfValue = patientData.codiceFiscale != null ? String(patientData.codiceFiscale).trim() : '';
    const normalizedCf = cfValue ? cfValue.toUpperCase() : '';
    if (normalizedCf) {
      const existingPatients = await this.getPatients();
      const duplicate = existingPatients.some(
        (p) => String(p.codiceFiscale || '').trim().toUpperCase() === normalizedCf
      );
      if (duplicate) throw new Error('Codice fiscale già presente');
    }
    const patient: Patient = {
      ...patientData,
      codiceFiscale: normalizedCf || undefined,
      id: this.generateUuid(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['patients'], 'readwrite');
      const store = transaction.objectStore('patients');
      const request = store.add(patient);

      request.onsuccess = () => resolve(patient);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePatient(id: string, patientData: Partial<Patient>): Promise<Patient> {
    const db = await this.initDB();
    const existingPatient = await this.getPatientById(id);
    
    if (!existingPatient) {
      throw new Error('Paziente non trovato');
    }

    const rawNextCf = patientData.codiceFiscale ?? existingPatient.codiceFiscale;
    const nextCf = rawNextCf != null ? String(rawNextCf).trim().toUpperCase() : '';
    if (nextCf) {
      const patients = await this.getPatients();
      const duplicate = patients.some(
        (p) =>
          p.id !== id &&
          String(p.codiceFiscale || '').trim().toUpperCase() === nextCf
      );
      if (duplicate) throw new Error('Codice fiscale già presente');
    }

    const updatedPatient: Patient = {
      ...existingPatient,
      ...patientData,
      codiceFiscale: nextCf || undefined,
      id,
      updatedAt: this.getCurrentTimestamp()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['patients'], 'readwrite');
      const store = transaction.objectStore('patients');
      const request = store.put(updatedPatient);

      request.onsuccess = () => resolve(updatedPatient);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePatient(id: string): Promise<void> {
    const db = await this.initDB();
    
    const visits = await this.getVisitsByPatientId(id);
    for (const visit of visits) {
      await this.deleteVisit(visit.id);
    }
    const richieste = await this.getRichiesteEsamiByPatientId(id);
    for (const r of richieste) {
      await this.deleteRichiestaEsame(r.id);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['patients'], 'readwrite');
      const store = transaction.objectStore('patients');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRichiesteEsamiByPatientId(patientId: string): Promise<RichiestaEsameComplementare[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['richieste_esami'], 'readonly');
      const store = transaction.objectStore('richieste_esami');
      const index = store.index('patientId');
      const request = index.getAll(patientId);
      request.onsuccess = () => {
        const list = (request.result || []).sort((a: RichiestaEsameComplementare, b: RichiestaEsameComplementare) => {
          const dateDiff = new Date(b.dataRichiesta).getTime() - new Date(a.dataRichiesta).getTime();
          if (dateDiff !== 0) return dateDiff;
          // Se la data richiesta è uguale, ordina per data di creazione (più recente prima)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getRichiestaEsameById(id: string): Promise<RichiestaEsameComplementare | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['richieste_esami'], 'readonly');
      const store = transaction.objectStore('richieste_esami');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addRichiestaEsame(data: Omit<RichiestaEsameComplementare, 'id' | 'createdAt' | 'updatedAt'>): Promise<RichiestaEsameComplementare> {
    const db = await this.initDB();
    const richiesta: RichiestaEsameComplementare = {
      ...data,
      id: this.generateId(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp(),
    };
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['richieste_esami'], 'readwrite');
      const store = transaction.objectStore('richieste_esami');
      const request = store.add(richiesta);
      request.onsuccess = () => resolve(richiesta);
      request.onerror = () => reject(request.error);
    });
  }

  async updateRichiestaEsame(id: string, data: Partial<RichiestaEsameComplementare>): Promise<RichiestaEsameComplementare> {
    const existing = await this.getRichiestaEsameById(id);
    if (!existing) throw new Error('Richiesta esame non trovata');
    const updated: RichiestaEsameComplementare = {
      ...existing,
      ...data,
      id,
      updatedAt: this.getCurrentTimestamp(),
    };
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['richieste_esami'], 'readwrite');
      const store = transaction.objectStore('richieste_esami');
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRichiestaEsame(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['richieste_esami'], 'readwrite');
      const store = transaction.objectStore('richieste_esami');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Visite
  async getVisits(): Promise<Visit[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readonly');
      const store = transaction.objectStore('visits');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getVisitsByPatientId(patientId: string): Promise<Visit[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readonly');
      const store = transaction.objectStore('visits');
      const index = store.index('patientId');
      const request = index.getAll(patientId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getVisitById(id: string): Promise<Visit | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readonly');
      const store = transaction.objectStore('visits');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addVisit(visitData: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Visit> {
    const db = await this.initDB();
    const visit: Visit = {
      ...visitData,
      id: this.generateId(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readwrite');
      const store = transaction.objectStore('visits');
      const request = store.add(visit);

      request.onsuccess = () => resolve(visit);
      request.onerror = () => reject(request.error);
    });
  }

  async updateVisit(id: string, visitData: Partial<Visit>): Promise<Visit> {
    const db = await this.initDB();
    const existingVisit = await this.getVisitById(id);
    
    if (!existingVisit) {
      throw new Error('Visita non trovata');
    }

    const updatedVisit: Visit = {
      ...existingVisit,
      ...visitData,
      id,
      updatedAt: this.getCurrentTimestamp()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readwrite');
      const store = transaction.objectStore('visits');
      const request = store.put(updatedVisit);

      request.onsuccess = () => resolve(updatedVisit);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVisit(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['visits'], 'readwrite');
      const store = transaction.objectStore('visits');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Dottore
  async getDoctor(): Promise<Doctor | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['doctor'], 'readonly');
      const store = transaction.objectStore('doctor');
      const request = store.getAll();

      request.onsuccess = () => {
        const doctors = request.result;
        resolve(doctors.length > 0 ? doctors[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateDoctor(doctorData: Partial<Doctor>): Promise<Doctor> {
    const db = await this.initDB();
    const existingDoctor = await this.getDoctor();
    
    const doctor: Doctor = existingDoctor ? {
      ...existingDoctor,
      ...doctorData,
      updatedAt: this.getCurrentTimestamp()
    } : {
      id: this.generateId(),
      nome: '',
      cognome: '',
      email: '',
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp(),
      ...doctorData
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['doctor'], 'readwrite');
      const store = transaction.objectStore('doctor');
      const request = store.put(doctor);

      request.onsuccess = () => resolve(doctor);
      request.onerror = () => reject(request.error);
    });
  }

  // Backup/Export
  async exportData(): Promise<AppData> {
    const [patients, visits, doctor] = await Promise.all([
      this.getPatients(),
      this.getVisits(),
      this.getDoctor()
    ]);

    return {
      patients,
      visits,
      doctor: doctor || {
        id: this.generateId(),
        nome: '',
        cognome: '',
        email: '',
        telefono: '',
        specializzazione: '',
        createdAt: this.getCurrentTimestamp(),
        updatedAt: this.getCurrentTimestamp()
      },
      lastSync: this.getCurrentTimestamp()
    };
  }

  async importData(data: AppData, mode: BackupImportMode = 'replace'): Promise<void> {
    if (mode === 'replace') {
      await this.clearAllData();
      const db = await this.initDB();

      if (data.patients && data.patients.length > 0) {
        const transaction = db.transaction(['patients'], 'readwrite');
        const store = transaction.objectStore('patients');
        for (const patient of data.patients) store.add(patient);
      }

      if (data.visits && data.visits.length > 0) {
        const transaction = db.transaction(['visits'], 'readwrite');
        const store = transaction.objectStore('visits');
        for (const visit of data.visits) store.add(visit);
      }

      if (data.doctor) {
        const transaction = db.transaction(['doctor'], 'readwrite');
        const store = transaction.objectStore('doctor');
        store.add(data.doctor);
      }
      return;
    }

    // Merge base: mantiene i dati correnti e aggiunge solo record nuovi.
    const [existingPatients, existingVisits, existingDoctor] = await Promise.all([
      this.getPatients(),
      this.getVisits(),
      this.getDoctor(),
    ]);

    const byCf = new Set(existingPatients.map((p) => String(p.codiceFiscale || '').toUpperCase()).filter(Boolean));
    const visitKeys = new Set(
      existingVisits.map((v) => `${v.patientId}::${v.dataVisita}::${(v.descrizioneClinica || '').trim().toLowerCase()}`)
    );

    const db = await this.initDB();
    const tx = db.transaction(['patients', 'visits', 'doctor'], 'readwrite');
    const patientStore = tx.objectStore('patients');
    const visitStore = tx.objectStore('visits');
    const doctorStore = tx.objectStore('doctor');

    for (const p of data.patients || []) {
      const cf = String(p.codiceFiscale || '').toUpperCase();
      if (cf && byCf.has(cf)) continue;
      patientStore.put(p);
      if (cf) byCf.add(cf);
    }

    for (const v of data.visits || []) {
      const key = `${v.patientId}::${v.dataVisita}::${(v.descrizioneClinica || '').trim().toLowerCase()}`;
      if (!visitKeys.has(key)) {
        visitStore.put(v);
        visitKeys.add(key);
      }
    }

    if (data.doctor) {
      if (!existingDoctor) {
        doctorStore.put(data.doctor);
      } else {
        const currentAmbulatori = existingDoctor.ambulatori || [];
        const incomingAmbulatori = data.doctor.ambulatori || [];
        const mergedAmbulatori = [...currentAmbulatori];
        const keyOf = (a: any) =>
          `${String(a?.nome || '').trim().toLowerCase()}::${String(a?.indirizzo || '').trim().toLowerCase()}::${String(a?.citta || '').trim().toLowerCase()}`;
        const existingKeys = new Set(mergedAmbulatori.map((a) => keyOf(a)));

        for (const amb of incomingAmbulatori) {
          const k = keyOf(amb);
          if (!existingKeys.has(k)) {
            mergedAmbulatori.push(amb);
            existingKeys.add(k);
          }
        }

        const hasPrimary = mergedAmbulatori.some((a) => a.isPrimario);
        if (!hasPrimary) {
          const incomingPrimaryKey = keyOf(incomingAmbulatori.find((a) => a.isPrimario));
          if (incomingPrimaryKey) {
            for (const amb of mergedAmbulatori) {
              amb.isPrimario = keyOf(amb) === incomingPrimaryKey;
            }
          } else if (mergedAmbulatori.length > 0) {
            mergedAmbulatori[0].isPrimario = true;
          }
        }

        const mergedDoctor: Doctor = {
          ...existingDoctor,
          nome: existingDoctor.nome || data.doctor.nome,
          cognome: existingDoctor.cognome || data.doctor.cognome,
          email: existingDoctor.email || data.doctor.email,
          telefono: existingDoctor.telefono || data.doctor.telefono,
          specializzazione: existingDoctor.specializzazione || data.doctor.specializzazione,
          profileImage: existingDoctor.profileImage || data.doctor.profileImage,
          ambulatori: mergedAmbulatori,
          updatedAt: this.getCurrentTimestamp(),
        };

        doctorStore.put(mergedDoctor);
      }
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.initDB();
    
    const transaction = db.transaction(['patients', 'visits', 'doctor'], 'readwrite');
    
    transaction.objectStore('patients').clear();
    transaction.objectStore('visits').clear();
    transaction.objectStore('doctor').clear();
  }
}

export const storageService = new LocalStorageService();
