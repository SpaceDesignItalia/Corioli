import { StorageService, Patient, Visit, Doctor, Document, AppData, MedicalTemplate, BackupImportMode, RichiestaEsameComplementare } from '../types/Storage';
import { MedicalTemplates } from '../data/medicalTemplates';

declare global {
  interface Window {
    electronAPI?: {
      kvGet: (key: string) => Promise<string | null>;
      kvSet: (key: string, value: string) => Promise<void>;
      kvRemove: (key: string) => Promise<void>;
      kvClearAppDottori: () => Promise<void>;
    };
  }
}

function useSqlite(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.kvGet;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = '0123456789abcdef';
  const r = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${r(8)}-${r(4)}-4${r(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${r(3)}-${r(12)}`;
}

class LocalStorageFallbackService implements StorageService {
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  private getStorageKey(key: string): string {
    return `AppDottori_${key}`;
  }

  private async getFromStorage<T>(key: string): Promise<T[]> {
    try {
      const fullKey = this.getStorageKey(key);
      let data: string | null;
      if (useSqlite()) {
        data = await window.electronAPI!.kvGet(fullKey);
      } else {
        data = localStorage.getItem(fullKey);
      }
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Errore nel recupero dei dati per ${key}:`, error);
      return [];
    }
  }

  private async saveToStorage<T>(key: string, data: T[]): Promise<void> {
    try {
      const fullKey = this.getStorageKey(key);
      const value = JSON.stringify(data);
      if (useSqlite()) {
        await window.electronAPI!.kvSet(fullKey, value);
      } else {
        localStorage.setItem(fullKey, value);
      }
    } catch (error) {
      console.error(`Errore nel salvataggio dei dati per ${key}:`, error);
      throw error;
    }
  }

  /** Chiave/valore per preferenze e altri dati (in Electron usa il db). */
  async getPreference(key: string): Promise<string | null> {
    const fullKey = this.getStorageKey(key);
    if (useSqlite()) {
      return await window.electronAPI!.kvGet(fullKey);
    }
    return localStorage.getItem(fullKey);
  }

  async setPreference(key: string, value: string): Promise<void> {
    const fullKey = this.getStorageKey(key);
    if (useSqlite()) {
      await window.electronAPI!.kvSet(fullKey, value);
    } else {
      localStorage.setItem(fullKey, value);
    }
  }

  // Pazienti
  async getPatients(): Promise<Patient[]> {
    return await this.getFromStorage<Patient>('patients');
  }

  async getPatientById(id: string): Promise<Patient | null> {
    const patients = await this.getPatients();
    return patients.find(p => p.id === id) || null;
  }

  async getPatientByCF(cf: string): Promise<Patient | null> {
    const normalizedCf = String(cf || "").trim().toUpperCase();
    const patients = await this.getPatients();
    return (
      patients.find(
        (p) => String(p.codiceFiscale || "").trim().toUpperCase() === normalizedCf
      ) || null
    );
  }

  async addPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient> {
    const patients = await this.getPatients();
    const cfValue = patientData.codiceFiscale != null ? String(patientData.codiceFiscale).trim() : '';
    const normalizedCf = cfValue ? cfValue.toUpperCase() : '';
    if (normalizedCf) {
      const duplicate = patients.some(
        (p) => String(p.codiceFiscale || '').trim().toUpperCase() === normalizedCf
      );
      if (duplicate) throw new Error('Codice fiscale già presente');
    }
    const patient: Patient = {
      ...patientData,
      codiceFiscale: normalizedCf || undefined,
      id: generateUuid(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp()
    };

    patients.push(patient);
    await this.saveToStorage('patients', patients);
    return patient;
  }

  async updatePatient(id: string, patientData: Partial<Patient>): Promise<Patient> {
    const patients = await this.getPatients();
    const index = patients.findIndex(p => p.id === id);

    if (index === -1) {
      throw new Error('Paziente non trovato');
    }

    const rawNextCf = patientData.codiceFiscale ?? patients[index].codiceFiscale;
    const nextCf = rawNextCf != null ? String(rawNextCf).trim().toUpperCase() : '';
    if (nextCf) {
      const duplicate = patients.some(
        (p) => p.id !== id && String(p.codiceFiscale || '').trim().toUpperCase() === nextCf
      );
      if (duplicate) throw new Error('Codice fiscale già presente');
    }

    patients[index] = {
      ...patients[index],
      ...patientData,
      codiceFiscale: nextCf || undefined,
      id,
      updatedAt: this.getCurrentTimestamp()
    };

    await this.saveToStorage('patients', patients);
    return patients[index];
  }

  async deletePatient(id: string): Promise<void> {
    const patients = await this.getPatients();
    const visits = await this.getVisits();
    const richiesteEsami = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');

    const filteredVisits = visits.filter(v => v.patientId !== id);
    await this.saveToStorage('visits', filteredVisits);

    const filteredRichieste = richiesteEsami.filter(r => r.patientId !== id);
    await this.saveToStorage('richieste_esami', filteredRichieste);

    const filteredPatients = patients.filter(p => p.id !== id);
    await this.saveToStorage('patients', filteredPatients);
  }

  // Richieste esami complementari
  async getRichiesteEsamiByPatientId(patientId: string): Promise<RichiestaEsameComplementare[]> {
    const list = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');
    return list.filter(r => r.patientId === patientId).sort((a, b) => new Date(b.dataRichiesta).getTime() - new Date(a.dataRichiesta).getTime());
  }

  async getRichiestaEsameById(id: string): Promise<RichiestaEsameComplementare | null> {
    const list = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');
    return list.find(r => r.id === id) || null;
  }

  async addRichiestaEsame(data: Omit<RichiestaEsameComplementare, 'id' | 'createdAt' | 'updatedAt'>): Promise<RichiestaEsameComplementare> {
    const list = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');
    const richiesta: RichiestaEsameComplementare = {
      ...data,
      id: this.generateId(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp(),
    };
    list.push(richiesta);
    await this.saveToStorage('richieste_esami', list);
    return richiesta;
  }

  async updateRichiestaEsame(id: string, data: Partial<RichiestaEsameComplementare>): Promise<RichiestaEsameComplementare> {
    const list = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');
    const index = list.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Richiesta esame non trovata');
    list[index] = {
      ...list[index],
      ...data,
      id,
      updatedAt: this.getCurrentTimestamp(),
    };
    await this.saveToStorage('richieste_esami', list);
    return list[index];
  }

  async deleteRichiestaEsame(id: string): Promise<void> {
    const list = await this.getFromStorage<RichiestaEsameComplementare>('richieste_esami');
    const filtered = list.filter(r => r.id !== id);
    await this.saveToStorage('richieste_esami', filtered);
  }

  // Visite
  async getVisits(): Promise<Visit[]> {
    return await this.getFromStorage<Visit>('visits');
  }

  async getVisitsByPatientId(patientId: string): Promise<Visit[]> {
    const visits = await this.getVisits();
    return visits.filter(v => v.patientId === patientId);
  }

  async getVisitById(id: string): Promise<Visit | null> {
    const visits = await this.getVisits();
    return visits.find(v => v.id === id) || null;
  }

  async addVisit(visitData: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Visit> {
    const visits = await this.getVisits();
    const visit: Visit = {
      ...visitData,
      id: this.generateId(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp()
    };

    visits.push(visit);
    await this.saveToStorage('visits', visits);
    return visit;
  }

  async updateVisit(id: string, visitData: Partial<Visit>): Promise<Visit> {
    const visits = await this.getVisits();
    const index = visits.findIndex(v => v.id === id);

    if (index === -1) {
      throw new Error('Visita non trovata');
    }

    visits[index] = {
      ...visits[index],
      ...visitData,
      id,
      updatedAt: this.getCurrentTimestamp()
    };

    await this.saveToStorage('visits', visits);
    return visits[index];
  }

  async deleteVisit(id: string): Promise<void> {
    const visits = await this.getVisits();
    const filteredVisits = visits.filter(v => v.id !== id);
    await this.saveToStorage('visits', filteredVisits);
  }

  // Documenti
  async getDocuments(): Promise<Document[]> {
    return await this.getFromStorage<Document>('documents');
  }

  async getDocumentById(id: string): Promise<Document | null> {
    const documents = await this.getDocuments();
    return documents.find(d => d.id === id) || null;
  }

  async addDocument(documentData: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const documents = await this.getDocuments();
    const document: Document = {
      ...documentData,
      id: this.generateId(),
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp()
    };

    documents.push(document);
    await this.saveToStorage('documents', documents);
    return document;
  }

  async updateDocument(id: string, documentData: Partial<Document>): Promise<Document> {
    const documents = await this.getDocuments();
    const index = documents.findIndex(d => d.id === id);

    if (index === -1) {
      throw new Error('Documento non trovato');
    }

    documents[index] = {
      ...documents[index],
      ...documentData,
      id,
      updatedAt: this.getCurrentTimestamp()
    };

    await this.saveToStorage('documents', documents);
    return documents[index];
  }

  async deleteDocument(id: string): Promise<void> {
    const documents = await this.getDocuments();
    const filteredDocuments = documents.filter(d => d.id !== id);
    await this.saveToStorage('documents', filteredDocuments);
  }

  // Dottore
  async getDoctor(): Promise<Doctor | null> {
    try {
      const fullKey = this.getStorageKey('doctor');
      let data: string | null;
      if (useSqlite()) {
        data = await window.electronAPI!.kvGet(fullKey);
      } else {
        data = localStorage.getItem(fullKey);
      }
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Errore nel recupero dei dati del dottore:', error);
      return null;
    }
  }

  async updateDoctor(doctorData: Partial<Doctor>): Promise<Doctor> {
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

    try {
      const fullKey = this.getStorageKey('doctor');
      const value = JSON.stringify(doctor);
      if (useSqlite()) {
        await window.electronAPI!.kvSet(fullKey, value);
      } else {
        localStorage.setItem(fullKey, value);
      }
    } catch (error) {
      console.error('Errore nel salvataggio dei dati del dottore:', error);
      throw error;
    }

    return doctor;
  }

  // Template
  async getTemplates(): Promise<MedicalTemplate[]> {
    const templates = await this.getFromStorage<MedicalTemplate>('templates');
    const generateId = () => this.generateId();

    if (templates.length === 0) {
      // Initialize with defaults if empty
      const defaultTemplates: MedicalTemplate[] = [];

      // Ginecologia
      MedicalTemplates.ginecologia.prestazione.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ginecologia', section: 'prestazione', label: t.label, text: t.text, isDefault: true }));
      MedicalTemplates.ginecologia.esameObiettivo.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ginecologia', section: 'esameObiettivo', label: t.label, text: t.text, isDefault: true }));
      MedicalTemplates.ginecologia.conclusioni.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ginecologia', section: 'conclusioni', label: t.label, text: t.text, isDefault: true }));

      // Ostetricia
      MedicalTemplates.ostetricia.prestazione.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ostetricia', section: 'prestazione', label: t.label, text: t.text, isDefault: true }));
      MedicalTemplates.ostetricia.esameObiettivo.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ostetricia', section: 'esameObiettivo', label: t.label, text: t.text, isDefault: true }));
      MedicalTemplates.ostetricia.conclusioni.forEach(t => defaultTemplates.push({ id: generateId(), category: 'ostetricia', section: 'conclusioni', label: t.label, text: t.text, isDefault: true }));

      // Terapie
      MedicalTemplates.terapie.forEach(t => defaultTemplates.push({ id: generateId(), category: 'terapie', section: 'generale', label: t.label, text: t.text, isDefault: true }));

      // Esami complementari
      MedicalTemplates.esami_complementari.forEach(t => defaultTemplates.push({ id: generateId(), category: 'esame_complementare', section: 'nome', label: t.label, text: t.text, note: t.note, isDefault: true }));

      await this.saveToStorage('templates', defaultTemplates);
      return defaultTemplates;
    }

    // For existing users: seed esame_complementare if not yet present
    if (!templates.some(t => t.category === 'esame_complementare')) {
      const examDefaults: MedicalTemplate[] = MedicalTemplates.esami_complementari.map(t => ({
        id: generateId(),
        category: 'esame_complementare' as const,
        section: 'nome' as const,
        label: t.label,
        text: t.text,
        note: t.note,
        isDefault: true,
      }));
      const updated = [...templates, ...examDefaults];
      await this.saveToStorage('templates', updated);
      return updated;
    }

    // Fix: aggiorna template esami esistenti se mancano le note (per backward compatibility fix)
    let needsUpdate = false;
    const fixedTemplates = templates.map(t => {
      if (t.category === 'esame_complementare' && t.isDefault && (!t.note || t.note === "")) {
        const original = MedicalTemplates.esami_complementari.find(m => m.label === t.label);
        if (original?.note) {
          needsUpdate = true;
          return { ...t, note: original.note };
        }
      }
      return t;
    });

    if (needsUpdate) {
      await this.saveToStorage('templates', fixedTemplates);
      return fixedTemplates;
    }

    return templates;
  }


  async addTemplate(templateData: Omit<MedicalTemplate, 'id'>): Promise<MedicalTemplate> {
    const templates = await this.getTemplates();
    const template: MedicalTemplate = {
      ...templateData,
      id: this.generateId(),
      isDefault: false
    };
    templates.push(template);
    await this.saveToStorage('templates', templates);
    return template;
  }

  async updateTemplate(id: string, templateData: Partial<MedicalTemplate>): Promise<MedicalTemplate> {
    const templates = await this.getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Template non trovato');

    // Prevent modification of isDefault property if it was true (optional logic)
    // but allow user to change text even of defaults if needed, or maybe clone.
    // For now, allow edit.

    templates[index] = { ...templates[index], ...templateData };
    await this.saveToStorage('templates', templates);
    return templates[index];
  }

  async deleteTemplate(id: string): Promise<void> {
    const templates = await this.getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    await this.saveToStorage('templates', filtered);
  }

  // Backup/Export
  async exportData(): Promise<AppData> {
    const [patients, visits, richiesteEsami, doctor, documents, templates] = await Promise.all([
      this.getPatients(),
      this.getVisits(),
      this.getFromStorage<RichiestaEsameComplementare>('richieste_esami'),
      this.getDoctor(),
      this.getDocuments(),
      this.getTemplates()
    ]);

    return {
      patients,
      visits,
      richiesteEsami,
      documents,
      templates,
      doctor: doctor || {
        id: this.generateId(),
        nome: 'Dottore',
        cognome: 'Default',
        email: 'dottore@example.com',
        createdAt: this.getCurrentTimestamp(),
        updatedAt: this.getCurrentTimestamp()
      },
      lastSync: this.getCurrentTimestamp()
    };
  }

  async importData(data: AppData, mode: BackupImportMode = 'replace'): Promise<void> {
    if (mode === 'replace') {
      await this.clearAllData();

      if (data.patients && data.patients.length > 0) {
        await this.saveToStorage('patients', data.patients);
      }

      if (data.visits && data.visits.length > 0) {
        await this.saveToStorage('visits', data.visits);
      }

      if (data.richiesteEsami && data.richiesteEsami.length > 0) {
        await this.saveToStorage('richieste_esami', data.richiesteEsami);
      }

      if (data.doctor) {
        const fullKey = this.getStorageKey('doctor');
        const value = JSON.stringify(data.doctor);
        if (useSqlite()) {
          await window.electronAPI!.kvSet(fullKey, value);
        } else {
          localStorage.setItem(fullKey, value);
        }
      }

      if (data.documents && data.documents.length > 0) {
        await this.saveToStorage('documents', data.documents);
      }

      if (data.templates && data.templates.length > 0) {
        await this.saveToStorage('templates', data.templates);
      }
      return;
    }

    // Modalità merge: mantiene i dati attuali e aggiunge solo quelli non presenti.
    const [currentPatients, currentVisits, currentRichiesteEsami, currentDocuments, currentTemplates, currentDoctor] = await Promise.all([
      this.getPatients(),
      this.getVisits(),
      this.getFromStorage<RichiestaEsameComplementare>('richieste_esami'),
      this.getDocuments(),
      this.getTemplates(),
      this.getDoctor(),
    ]);

    const incomingPatients = data.patients || [];
    const incomingVisits = data.visits || [];
    const incomingRichiesteEsami = data.richiesteEsami || [];
    const incomingDocuments = data.documents || [];
    const incomingTemplates = data.templates || [];

    const mergedPatients = [...currentPatients];
    const mergedVisits = [...currentVisits];
    const mergedRichiesteEsami = [...currentRichiesteEsami];
    const mergedDocuments = [...currentDocuments];
    const mergedTemplates = [...currentTemplates];

    const patientIdMap = new Map<string, string>();
    const existingPatientIds = new Set(currentPatients.map((p) => p.id));
    const patientByCf = new Map<string, Patient>();
    for (const p of currentPatients) {
      const cf = String(p.codiceFiscale || '').trim().toUpperCase();
      if (cf) patientByCf.set(cf, p);
    }
    const patientById = new Map(currentPatients.map((p) => [p.id, p]));

    for (const p of incomingPatients) {
      const existingById = patientById.get(p.id);
      if (existingById) {
        patientIdMap.set(p.id, existingById.id);
        continue;
      }
      const cf = String(p.codiceFiscale || '').trim().toUpperCase();
      const existingByCf = cf ? patientByCf.get(cf) : undefined;
      if (existingByCf) {
        patientIdMap.set(p.id, existingByCf.id);
        continue;
      }

      const nextId = existingPatientIds.has(p.id) ? generateUuid() : p.id;
      existingPatientIds.add(nextId);
      const patientToAdd: Patient = { ...p, id: nextId };
      mergedPatients.push(patientToAdd);
      patientById.set(nextId, patientToAdd);
      if (cf) patientByCf.set(cf, patientToAdd);
      patientIdMap.set(p.id, nextId);
    }

    const existingVisitIds = new Set(currentVisits.map((v) => v.id));
    const existingVisitKeys = new Set(
      currentVisits.map((v) => `${v.patientId}::${v.dataVisita}::${(v.descrizioneClinica || '').trim().toLowerCase()}`)
    );
    for (const v of incomingVisits) {
      const mappedPatientId = patientIdMap.get(v.patientId) || v.patientId;
      const visitKey = `${mappedPatientId}::${v.dataVisita}::${(v.descrizioneClinica || '').trim().toLowerCase()}`;
      if (existingVisitKeys.has(visitKey)) continue;
      const nextId = existingVisitIds.has(v.id) ? this.generateId() : v.id;
      existingVisitIds.add(nextId);
      mergedVisits.push({ ...v, id: nextId, patientId: mappedPatientId });
      existingVisitKeys.add(visitKey);
    }

    const existingRichiestaIds = new Set(currentRichiesteEsami.map((r) => r.id));
    for (const r of incomingRichiesteEsami) {
      const mappedPatientId = patientIdMap.get(r.patientId) || r.patientId;
      if (!existingPatientIds.has(mappedPatientId)) continue;
      const nextId = existingRichiestaIds.has(r.id) ? this.generateId() : r.id;
      existingRichiestaIds.add(nextId);
      mergedRichiesteEsami.push({ ...r, id: nextId, patientId: mappedPatientId });
    }

    const existingDocumentIds = new Set(currentDocuments.map((d) => d.id));
    const existingDocumentKeys = new Set(
      currentDocuments.map((d) => `${d.fileName}::${d.uploadDate}::${d.fileSize}`)
    );
    for (const d of incomingDocuments) {
      const docKey = `${d.fileName}::${d.uploadDate}::${d.fileSize}`;
      if (existingDocumentKeys.has(docKey)) continue;
      const nextId = existingDocumentIds.has(d.id) ? this.generateId() : d.id;
      existingDocumentIds.add(nextId);
      mergedDocuments.push({ ...d, id: nextId });
      existingDocumentKeys.add(docKey);
    }

    const existingTemplateIds = new Set(currentTemplates.map((t) => t.id));
    const existingTemplateKeys = new Set(
      currentTemplates.map((t) => `${t.category}::${t.section}::${t.label}::${t.text}`)
    );
    for (const t of incomingTemplates) {
      const tplKey = `${t.category}::${t.section}::${t.label}::${t.text}`;
      if (existingTemplateKeys.has(tplKey)) continue;
      const nextId = existingTemplateIds.has(t.id) ? this.generateId() : t.id;
      existingTemplateIds.add(nextId);
      mergedTemplates.push({ ...t, id: nextId });
      existingTemplateKeys.add(tplKey);
    }

    await Promise.all([
      this.saveToStorage('patients', mergedPatients),
      this.saveToStorage('visits', mergedVisits),
      this.saveToStorage('richieste_esami', mergedRichiesteEsami),
      this.saveToStorage('documents', mergedDocuments),
      this.saveToStorage('templates', mergedTemplates),
    ]);

    if (data.doctor) {
      const incomingDoctor = data.doctor;

      if (!currentDoctor) {
        const fullKey = this.getStorageKey('doctor');
        const value = JSON.stringify(incomingDoctor);
        if (useSqlite()) {
          await window.electronAPI!.kvSet(fullKey, value);
        } else {
          localStorage.setItem(fullKey, value);
        }
      } else {
        const currentAmbulatori = currentDoctor.ambulatori || [];
        const incomingAmbulatori = incomingDoctor.ambulatori || [];
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

        // Mantieni "In uso" esistente se presente; altrimenti usa quello del backup.
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
          ...currentDoctor,
          nome: currentDoctor.nome || incomingDoctor.nome,
          cognome: currentDoctor.cognome || incomingDoctor.cognome,
          email: currentDoctor.email || incomingDoctor.email,
          telefono: currentDoctor.telefono || incomingDoctor.telefono,
          specializzazione: currentDoctor.specializzazione || incomingDoctor.specializzazione,
          profileImage: currentDoctor.profileImage || incomingDoctor.profileImage,
          ambulatori: mergedAmbulatori,
          updatedAt: this.getCurrentTimestamp(),
        };

        const fullKey = this.getStorageKey('doctor');
        const value = JSON.stringify(mergedDoctor);
        if (useSqlite()) {
          await window.electronAPI!.kvSet(fullKey, value);
        } else {
          localStorage.setItem(fullKey, value);
        }
      }
    }
  }

  async clearAllData(): Promise<void> {
    if (useSqlite()) {
      await window.electronAPI!.kvClearAppDottori();
    } else {
      localStorage.removeItem(this.getStorageKey('patients'));
      localStorage.removeItem(this.getStorageKey('visits'));
      localStorage.removeItem(this.getStorageKey('richieste_esami'));
      localStorage.removeItem(this.getStorageKey('doctor'));
      localStorage.removeItem(this.getStorageKey('documents'));
      localStorage.removeItem(this.getStorageKey('templates'));
      localStorage.removeItem(this.getStorageKey('preferences'));
      localStorage.removeItem(this.getStorageKey('recent_patient_searches'));
    }
  }
}

// Usa sempre localStorage per semplicità in Electron
export const storageService = new LocalStorageFallbackService();
