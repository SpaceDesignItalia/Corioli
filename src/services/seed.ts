import { PatientService, VisitService, DoctorService, DocumentService } from "./OfflineServices";

function getSeedFlagKey(): string {
  return "appdottori_demo_seeded_v1";
}

export async function forceSeedDemoData(): Promise<void> {
  try {
    console.log("Forzando caricamento dati demo...");
    
    // Cancella il flag per forzare il re-seed
    localStorage.removeItem(getSeedFlagKey());
    
    // Cancella tutti i dati esistenti
    localStorage.removeItem('AppDottori_patients');
    localStorage.removeItem('AppDottori_visits');
    localStorage.removeItem('AppDottori_doctor');

    // Ensure default doctor exists
    await DoctorService.initializeDefaultDoctor();

    await loadDemoData();
  } catch (error) {
    console.error("Errore nel caricamento forzato dati demo:", error);
    throw error;
  }
}

export async function seedDemoDataIfNeeded(): Promise<void> {
  try {
    // Non caricare più dati demo automaticamente e ripulisci eventuali residui
    console.log("Demo data disabled - cleaning up any demo data");

    // Ensure default doctor exists
    await DoctorService.initializeDefaultDoctor();
    
    // Rimuovi pazienti/visite demo se presenti
    const demoCFs = new Set<string>([
      "RSSMRA80A01H501U",
      "BNCLRA90B10F205Z",
      "VRDGPP75C15L219X",
      "FRRGLI85D20H501T",
      "MRNLCU92E15F839K",
      "CSTFNC88F25L736W",
      "GRSMTT95G10A662R",
      "RCCSLV93H15L219B",
      "BRBMRC87I20D612Q",
      "PLLCLD91L30F205H",
    ]);
    const allPatients = await PatientService.getAllPatients();
    for (const p of allPatients) {
      if (demoCFs.has(p.codiceFiscale)) {
        await PatientService.deletePatient(p.id); // elimina anche le visite correlate
      }
    }

    // Rimuovi documenti demo se presenti (identificati per titolo/fileName)
    const allDocs = await DocumentService.getAllDocuments();
    if (allDocs && Array.isArray(allDocs)) {
      const demoTitles = new Set<string>([
        "Corso ECM - Aggiornamenti in Cardiologia 2024",
        "Certificato Specializzazione Medicina Interna",
        "Webinar: Nuove Linee Guida Diabete Tipo 2",
      ]);
      for (const d of allDocs) {
        if (demoTitles.has(d.title)) {
          await DocumentService.deleteDocument(d.id);
        }
      }
    }
  } catch (error) {
    console.error("Errore nell'inizializzazione:", error);
  }
}

async function loadDemoData(): Promise<void> {

    // Seed patients con dati realistici
    const p1 = await PatientService.addPatient({
      codiceFiscale: "RSSMRA80A01H501U",
      nome: "Mario",
      cognome: "Rossi",
      dataNascita: "1980-01-01",
      luogoNascita: "Roma",
      sesso: "M",
      email: "mario.rossi@example.com",
      telefono: "3331112222",
      indirizzo: "Via Roma 10, Roma",
    });

    const p2 = await PatientService.addPatient({
      codiceFiscale: "BNCLRA90B10F205Z",
      nome: "Laura",
      cognome: "Bianchi",
      dataNascita: "1990-02-10",
      luogoNascita: "Milano",
      sesso: "F",
      email: "laura.bianchi@example.com",
      telefono: "3332223333",
      indirizzo: "Corso Buenos Aires 20, Milano",
    });

    const p3 = await PatientService.addPatient({
      codiceFiscale: "VRDGPP75C15L219X",
      nome: "Giuseppe",
      cognome: "Verdi",
      dataNascita: "1975-03-15",
      luogoNascita: "Torino",
      sesso: "M",
      email: "giuseppe.verdi@example.com",
      telefono: "3334445555",
      indirizzo: "Via Po 5, Torino",
    });

    const p4 = await PatientService.addPatient({
      codiceFiscale: "FRRGLI85D20H501T",
      nome: "Giulia",
      cognome: "Ferrari",
      dataNascita: "1985-04-20",
      luogoNascita: "Napoli",
      sesso: "F",
      email: "giulia.ferrari@example.com",
      telefono: "3335556666",
      indirizzo: "Via Toledo 45, Napoli",
    });

    const p5 = await PatientService.addPatient({
      codiceFiscale: "MRNLCU92E15F839K",
      nome: "Luca",
      cognome: "Marini",
      dataNascita: "1992-05-15",
      luogoNascita: "Firenze",
      sesso: "M",
      email: "luca.marini@example.com",
      telefono: "3336667777",
      indirizzo: "Piazza del Duomo 8, Firenze",
    });

    const p6 = await PatientService.addPatient({
      codiceFiscale: "CSTFNC88F25L736W",
      nome: "Francesca",
      cognome: "Costa",
      dataNascita: "1988-06-25",
      luogoNascita: "Bologna",
      sesso: "F",
      email: "francesca.costa@example.com",
      telefono: "3337778888",
      indirizzo: "Via Indipendenza 12, Bologna",
    });

    const p7 = await PatientService.addPatient({
      codiceFiscale: "GRSMTT95G10A662R",
      nome: "Matteo",
      cognome: "Grassi",
      dataNascita: "1995-07-10",
      luogoNascita: "Palermo",
      sesso: "M",
      email: "matteo.grassi@example.com",
      telefono: "3338889999",
      indirizzo: "Via Maqueda 33, Palermo",
    });

    const p8 = await PatientService.addPatient({
      codiceFiscale: "RCCSLV93H15L219B",
      nome: "Silvia",
      cognome: "Ricci",
      dataNascita: "1993-06-15",
      luogoNascita: "Venezia",
      sesso: "F",
      email: "silvia.ricci@example.com",
      telefono: "3339990000",
      indirizzo: "Fondamenta delle Zattere 120, Venezia",
    });

    const p9 = await PatientService.addPatient({
      codiceFiscale: "BRBMRC87I20D612Q",
      nome: "Marco",
      cognome: "Barbieri",
      dataNascita: "1987-09-20",
      luogoNascita: "Genova",
      sesso: "M",
      email: "marco.barbieri@example.com",
      telefono: "3330001111",
      indirizzo: "Via del Campo 29, Genova",
    });

    const p10 = await PatientService.addPatient({
      codiceFiscale: "PLLCLD91L30F205H",
      nome: "Claudia",
      cognome: "Pellegrini",
      dataNascita: "1991-07-30",
      luogoNascita: "Bari",
      sesso: "F",
      email: "claudia.pellegrini@example.com",
      telefono: "3331112233",
      indirizzo: "Corso Vittorio Emanuele 88, Bari",
    });

    // Seed visits realistiche con date diverse
    const today = new Date();
    const getDateDaysAgo = (days: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return date.toISOString().slice(0, 10);
    };

    console.log("Aggiungendo visite per i pazienti...");
    
    // Visite per Mario Rossi (p1) - Ipertensione
    console.log("Aggiungendo visita per Mario Rossi, ID:", p1.id);
    await VisitService.addVisit({
      patientId: p1.id,
      dataVisita: getDateDaysAgo(0),
      descrizioneClinica: "Controllo pressione arteriosa e anamnesi generale.",
      anamnesi: "Ipertensione essenziale trattata con ACE-inibitori. Familiarità per cardiopatia ischemica.",
      esamiObiettivo: "PA 140/90 mmHg, FC 75 bpm regolare, BMI 26.5. Cuore: toni validi, soffio 1/6. Polmoni: MV presente bilateralmente.",
      conclusioniDiagnostiche: "Ipertensione arteriosa in discreto controllo farmacologico.",
      terapie: "Ramipril 5mg 1cp/die al mattino. Controllo PA domiciliare. Dieta iposodica.",
    });

    await VisitService.addVisit({
      patientId: p1.id,
      dataVisita: getDateDaysAgo(30),
      descrizioneClinica: "Controllo mensile ipertensione, aggiustamento terapia.",
      anamnesi: "Ipertensione in trattamento da 2 anni. Compliance buona.",
      esamiObiettivo: "PA 135/85 mmHg, FC 72 bpm, peso stabile. Esame obiettivo nella norma.",
      conclusioniDiagnostiche: "Miglioramento controllo pressorio.",
      terapie: "Proseguire Ramipril 5mg/die. Aggiunto Amlodipina 5mg/die.",
    });

    // Visite per Laura Bianchi (p2) - Controlli ginecologici
    await VisitService.addVisit({
      patientId: p2.id,
      dataVisita: getDateDaysAgo(5),
      descrizioneClinica: "Controllo ginecologico di routine e pap test.",
      anamnesi: "Nullipara, cicli regolari, ultimo pap test 3 anni fa negativo.",
      esamiObiettivo: "Esame ginecologico: genitali esterni nella norma, speculum: cervice rosea, perdite fisiologiche.",
      conclusioniDiagnostiche: "Controllo ginecologico nella norma.",
      terapie: "Pap test eseguito. Controllo tra 3 anni se negativo. Acido folico 400mcg/die.",
    });

    await VisitService.addVisit({
      patientId: p2.id,
      dataVisita: getDateDaysAgo(180),
      descrizioneClinica: "Visita per dismenorrea e controllo generale.",
      anamnesi: "Dismenorrea da alcuni mesi, dolore pelvico ciclico.",
      esamiObiettivo: "Addome: dolore in fossa iliaca dx durante palpazione. Resto nella norma.",
      conclusioniDiagnostiche: "Dismenorrea primaria. Da escludere endometriosi.",
      terapie: "FANS durante ciclo. Ecografia pelvica di controllo tra 1 mese.",
    });

    // Visite per Giuseppe Verdi (p3) - Problemi ortopedici
    await VisitService.addVisit({
      patientId: p3.id,
      dataVisita: getDateDaysAgo(10),
      descrizioneClinica: "Controllo post-fisioterapia per lombalgia cronica.",
      anamnesi: "Lombalgia cronica da 2 anni, lavoro sedentario, ha completato ciclo di fisioterapia.",
      esamiObiettivo: "Colonna: migliorata mobilità, ridotta contrattura paravertebrale L4-L5. Test di Lasegue negativo.",
      conclusioniDiagnostiche: "Miglioramento significativo della lombalgia.",
      terapie: "Proseguire esercizi domiciliari. Ergonomia lavorativa. Controllo tra 3 mesi.",
    });

    await VisitService.addVisit({
      patientId: p3.id,
      dataVisita: getDateDaysAgo(90),
      descrizioneClinica: "Prima visita per lombalgia cronica.",
      anamnesi: "Dolore lombare da 6 mesi, peggiora con posizione seduta prolungata.",
      esamiObiettivo: "Dolorabilità paravertebrale L4-L5, limitazione flessione anteriore, Test di Lasegue dubbio.",
      conclusioniDiagnostiche: "Lombalgia meccanica da postura scorretta.",
      terapie: "Fisioterapia 10 sedute, FANS al bisogno, correzione posturale.",
    });

    // Visite per Giulia Ferrari (p4) - Controlli cardiologici
    await VisitService.addVisit({
      patientId: p4.id,
      dataVisita: getDateDaysAgo(15),
      descrizioneClinica: "Controllo cardiologico per palpitazioni.",
      anamnesi: "Episodi di palpitazioni da stress lavorativo, ansia occasionale.",
      esamiObiettivo: "PA 120/80, FC 88 bpm regolare, cuore: toni validi, soffio innocente 2/6 mesosistolico.",
      conclusioniDiagnostiche: "Palpitazioni da stress, soffio funzionale.",
      terapie: "Tecniche di rilassamento, magnesio 300mg/die, controllo ECG tra 1 mese.",
    });

    // Visite per Luca Marini (p5) - Controlli dermatologici
    await VisitService.addVisit({
      patientId: p5.id,
      dataVisita: getDateDaysAgo(7),
      descrizioneClinica: "Controllo dermatologico per neo sospetto.",
      anamnesi: "Neo in regione dorsale modificato negli ultimi mesi, prurito occasionale.",
      esamiObiettivo: "Neo di 8mm, bordi irregolari, colore eterogeneo, asimmetrico.",
      conclusioniDiagnostiche: "Neo atipico da valutare con dermoscopia.",
      terapie: "Dermoscopia urgente. Eventuale asportazione chirurgica. Controllo altri nei.",
    });

    // Visite per Francesca Costa (p6) - Controlli endocrinologici
    await VisitService.addVisit({
      patientId: p6.id,
      dataVisita: getDateDaysAgo(20),
      descrizioneClinica: "Controllo tiroide e metabolismo.",
      anamnesi: "Astenia, aumento peso, capelli fragili da 6 mesi. Familiarità per ipotiroidismo.",
      esamiObiettivo: "Tiroide: lievemente aumentata di volume, consistenza parenchimatosa. Peso: +3kg in 6 mesi.",
      conclusioniDiagnostiche: "Sospetto ipotiroidismo subclinico.",
      terapie: "Esami: TSH, FT3, FT4, TPOAb. Dieta ipocalorica bilanciata. Controllo tra 1 mese.",
    });

    // Visite per Matteo Grassi (p7) - Controlli sportivi
    await VisitService.addVisit({
      patientId: p7.id,
      dataVisita: getDateDaysAgo(2),
      descrizioneClinica: "Visita medico-sportiva per idoneità agonistica.",
      anamnesi: "Atleta, calcio dilettantistico, nessuna patologia nota.",
      esamiObiettivo: "PA 110/70, FC 55 bpm (bradicardia da allenamento), cuore: toni validi, soffio funzionale.",
      conclusioniDiagnostiche: "Idoneità agonistica confermata.",
      terapie: "Proseguire attività sportiva. ECG sotto sforzo annuale. Controllo tra 1 anno.",
    });

    // Visite per Silvia Ricci (p8) - Controlli ginecologici e generali
    await VisitService.addVisit({
      patientId: p8.id,
      dataVisita: getDateDaysAgo(12),
      descrizioneClinica: "Controllo post-partum a 6 mesi.",
      anamnesi: "Parto naturale 6 mesi fa, allattamento in corso, ripresa ciclo mestruale.",
      esamiObiettivo: "Addome: utero involuto, cicatrice episiotomia guarita. Mammelle: in allattamento.",
      conclusioniDiagnostiche: "Decorso post-partum regolare.",
      terapie: "Proseguire allattamento. Integrazione ferro e vitamine. Controllo tra 6 mesi.",
    });

    // Visite per Marco Barbieri (p9) - Controlli gastroenterologici
    await VisitService.addVisit({
      patientId: p9.id,
      dataVisita: getDateDaysAgo(25),
      descrizioneClinica: "Controllo per disturbi gastrici ricorrenti.",
      anamnesi: "Episodi di gastrite da stress lavorativo, bruciore epigastrico post-prandiale.",
      esamiObiettivo: "Addome: dolore epigastrico alla palpazione, resto nella norma.",
      conclusioniDiagnostiche: "Gastrite da stress, possibile Helicobacter pylori.",
      terapie: "PPI 20mg/die per 4 settimane. Test per H.pylori. Dieta leggera.",
    });

    // Visite per Claudia Pellegrini (p10) - Controlli neurologici
    await VisitService.addVisit({
      patientId: p10.id,
      dataVisita: getDateDaysAgo(8),
      descrizioneClinica: "Controllo per cefalee ricorrenti.",
      anamnesi: "Cefalee frontali 2-3 volte/settimana, stress lavorativo, disturbi del sonno.",
      esamiObiettivo: "Esame neurologico: riflessi osteotendinei vivaci simmetrici, fundus oculi normale.",
      conclusioniDiagnostiche: "Cefalea tensiva da stress.",
      terapie: "Tecniche di rilassamento, igiene del sonno, paracetamolo al bisogno.",
    });

    // Visite aggiuntive per diversificare le date
    await VisitService.addVisit({
      patientId: p2.id,
      dataVisita: getDateDaysAgo(60),
      descrizioneClinica: "Controllo generale e screening preventivo.",
      anamnesi: "Controllo annuale, nessun sintomo particolare.",
      esamiObiettivo: "Esame obiettivo generale nella norma. PA 115/75, FC 70 bpm.",
      conclusioniDiagnostiche: "Stato di salute ottimale.",
      terapie: "Proseguire stile di vita sano. Controllo annuale.",
    });

    await VisitService.addVisit({
      patientId: p4.id,
      dataVisita: getDateDaysAgo(45),
      descrizioneClinica: "Follow-up cardiologico post-ECG.",
      anamnesi: "ECG precedente mostrava lieve alterazione ST, asintomatica.",
      esamiObiettivo: "PA 125/80, FC 75 bpm regolare, ECG: normalizzazione del tratto ST.",
      conclusioniDiagnostiche: "Normalizzazione ECG, probabile artefatto precedente.",
      terapie: "Nessuna terapia specifica. Controllo cardiologico annuale.",
    });

    await VisitService.addVisit({
      patientId: p6.id,
      dataVisita: getDateDaysAgo(75),
      descrizioneClinica: "Controllo endocrinologico post-esami.",
      anamnesi: "Esami tiroidei: TSH lievemente elevato, FT4 al limite inferiore.",
      esamiObiettivo: "Tiroide: volume normale, consistenza omogenea alla palpazione.",
      conclusioniDiagnostiche: "Ipotiroidismo subclinico confermato.",
      terapie: "Levotiroxina 25mcg/die al mattino a digiuno. Controllo TSH tra 6 settimane.",
    });

    await VisitService.addVisit({
      patientId: p8.id,
      dataVisita: getDateDaysAgo(100),
      descrizioneClinica: "Controllo pre-concezionale.",
      anamnesi: "Desiderio di gravidanza, cicli regolari, nessuna patologia nota.",
      esamiObiettivo: "Esame ginecologico nella norma, BMI 22, PA 110/70.",
      conclusioniDiagnostiche: "Idoneità alla gravidanza.",
      terapie: "Acido folico 400mcg/die da subito. Controlli pre-natali standard.",
    });

    await VisitService.addVisit({
      patientId: p9.id,
      dataVisita: getDateDaysAgo(50),
      descrizioneClinica: "Controllo gastroenterologico post-terapia.",
      anamnesi: "Completato ciclo PPI, miglioramento sintomatologia gastrica.",
      esamiObiettivo: "Addome: non più dolorabile, peristalsi presente, fegato nei limiti.",
      conclusioniDiagnostiche: "Risoluzione gastrite, H.pylori negativo.",
      terapie: "Sospendere PPI gradualmente. Dieta regolare. Controllo tra 6 mesi.",
    });

    // Seed documenti demo
    console.log("Aggiungendo documenti demo...");
    
    // Documento 1 - Corso ECM
    await DocumentService.addDocument({
      title: "Corso ECM - Aggiornamenti in Cardiologia 2024",
      description: "Corso di aggiornamento professionale sui nuovi protocolli cardiologici e linee guida ESC 2024",
      fileName: "corso_cardiologia_2024.pdf",
      fileSize: 2458672, // ~2.4MB
      mimeType: "application/pdf",
      category: "corso_aggiornamento",
      uploadDate: getDateDaysAgo(30),
      expiryDate: "2027-12-31",
      credits: 15,
      fileData: "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooQ29yc28gRUNNIENhcmRpb2xvZ2lhIDIwMjQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNSAwMDAwMCBuIAowMDAwMDAwMjk5IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzY2CiUlRU9G" // PDF base64 demo
    });

    // Documento 2 - Certificato
    await DocumentService.addDocument({
      title: "Certificato Specializzazione Medicina Interna",
      description: "Certificato di specializzazione in Medicina Interna conseguito presso Università La Sapienza",
      fileName: "certificato_specializzazione.pdf",
      fileSize: 1024567,
      mimeType: "application/pdf",
      category: "certificato",
      uploadDate: "2020-07-15",
      credits: 0,
      fileData: "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA1MAo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooQ2VydGlmaWNhdG8gU3BlY2lhbGl6emF6aW9uZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjA1IDAwMDAwIG4gCjAwMDAwMDAzMDUgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgozNzIKJSVFT0Y="
    });

    // Documento 3 - Corso recente
    await DocumentService.addDocument({
      title: "Webinar: Nuove Linee Guida Diabete Tipo 2",
      description: "Webinar formativo sulle nuove linee guida ADA/EASD per il trattamento del diabete tipo 2",
      fileName: "webinar_diabete_2024.pdf",
      fileSize: 892341,
      mimeType: "application/pdf",
      category: "corso_aggiornamento",
      uploadDate: getDateDaysAgo(5),
      expiryDate: "2026-12-31",
      credits: 5,
      fileData: "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0Mgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooV2ViaW5hciBEaWFiZXRlIDIwMjQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIwNSAwMDAwMCBuIAowMDAwMDAwMjk3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzY0CiUlRU9G"
    });

    localStorage.setItem(getSeedFlagKey(), "true");
    console.log("Dati demo caricati con successo! 10 pazienti, 15+ visite e 3 documenti aggiunti.");
}


