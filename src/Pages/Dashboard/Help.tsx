import React, { useState } from "react";
import {
  Accordion,
  AccordionItem,
  Input,
  Textarea,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@nextui-org/react";
import {
  HelpCircle,
  MessageSquare,
  Send,
  LifeBuoy,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";

export default function HelpAndFeedback() {
  const [feedbackData, setFeedbackData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedbackData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setSubmitStatus('success');
      setIsSubmitting(false);
      setFeedbackData({ name: "", email: "", message: "" });
      
      // Reset status after 3 seconds
      setTimeout(() => setSubmitStatus('idle'), 3000);
    }, 1500);
  };

  const faqGroups = [
    {
      category: "Gestione Pazienti",
      items: [
        {
          title: "Come aggiungo un nuovo paziente?",
          content: "Vai alla sezione 'Pazienti' (o Dashboard) e clicca sul pulsante '+ Nuovo Paziente' in alto a destra. Compila i campi obbligatori (Nome, Cognome, Data di nascita, Sesso) e salva. Il Codice Fiscale verrà calcolato automaticamente se non inserito."
        },
        {
          title: "Come posso cercare un paziente?",
          content: "Nella Dashboard o nella sezione Pazienti, usa la barra di ricerca in alto. Puoi cercare per Nome, Cognome o Codice Fiscale. Il sistema riconosce automaticamente se stai inserendo un CF (alfanumerico) o un nome."
        },
        {
          title: "Cosa significa l'asterisco rosso (*) accanto al Codice Fiscale?",
          content: "Indica che il Codice Fiscale è stato generato automaticamente (presunto) e non verificato. Si consiglia di controllarlo con la tessera sanitaria del paziente e correggerlo se necessario modificando l'anagrafica."
        },
        {
          title: "Come modifico o elimino un paziente?",
          content: "Dalla lista pazienti, clicca sulla card del paziente per aprire la sua scheda. Usa il pulsante 'Modifica' (icona matita) in alto a destra per cambiare i dati. Per eliminare, usa il pulsante 'Elimina' (icona cestino) nel modal di modifica. Attenzione: l'eliminazione cancella anche tutte le visite associate."
        }
      ]
    },
    {
      category: "Visite e Referti",
      items: [
        {
          title: "Come creo una nuova visita?",
          content: "Dalla scheda del paziente, clicca su '+ Nuova Visita'. Puoi scegliere tra visita Ginecologica, Ginecologica Pediatrica (se abilitata in Impostazioni) e Ostetrica usando le schede in alto. I campi cambieranno in base al tipo selezionato."
        },
        {
          title: "Come funziona il calcolo automatico della gravidanza?",
          content: "Nella visita Ostetrica, inserendo la 'Data Ultima Mestruazione' (LMP), il sistema calcola automaticamente la Data Presunta del Parto (DPP) e le Settimane di Gestazione attuali (es. 15+3). Puoi comunque modificare manualmente questi valori."
        },
        {
          title: "Come uso i modelli (template) nei referti?",
          content: "Nei campi di testo (es. Anamnesi, Esame Obiettivo), trovi un pulsante 'Modello'. Cliccandolo puoi inserire testi predefiniti. Puoi creare nuovi modelli in 'Impostazioni > Modelli Referti'. La categoria del modello viene selezionata automaticamente in base alla sezione in cui ti trovi."
        },
        {
          title: "Come stampo o salvo il referto in PDF?",
          content: "Dalla schermata di compilazione visita o dallo storico, clicca su 'Stampa'. Verrà generato un PDF professionale con l'intestazione del medico, i dati del paziente e il referto completo, pronto per essere stampato o salvato."
        }
      ]
    },
    {
      category: "Esami e Documenti",
      items: [
        {
          title: "Come prescrivo esami complementari?",
          content: "Dalla scheda paziente, nella colonna di destra 'Esami', clicca su 'Nuovo Esame'. Puoi scegliere un esame dalla lista dei modelli (es. Colposcopia, Pap Test) o scriverne uno nuovo. Anche qui puoi generare un PDF di richiesta/prescrizione."
        },
        {
          title: "Posso allegare file esterni?",
          content: "Attualmente il sistema gestisce i documenti generati internamente. In futuro sarà possibile allegare referti esterni (PDF/Immagini) alla scheda paziente."
        }
      ]
    },
    {
      category: "Impostazioni e Dati",
      items: [
        {
          title: "Come modifico l'intestazione dei referti?",
          content: "Vai su 'Impostazioni > Ambulatori'. Qui puoi inserire i tuoi dati (Nome, Specializzazione) e aggiungere uno o più ambulatori (Indirizzo, Città, Contatti). L'ambulatorio impostato come 'Primario' apparirà nell'intestazione dei PDF."
        },
        {
          title: "I miei dati sono al sicuro? Dove vengono salvati?",
          content: "Sì, Corioli funziona completamente offline (Local First). I dati vengono salvati in un database locale criptato sul tuo computer. Nessun dato viene inviato a server esterni o cloud, garantendo la massima privacy e conformità GDPR per l'uso locale."
        },
        {
          title: "Come faccio il backup dei dati?",
          content: "Vai su 'Impostazioni > Backup e Dati'. Clicca su 'Esporta Backup' per scaricare un file unico (.json) contenente tutti i pazienti, visite e impostazioni. Puoi usare questo file per ripristinare i dati su un altro computer o per sicurezza."
        }
      ]
    },
    {
      category: "Altro",
      items: [
        {
          title: "Quali scorciatoie da tastiera posso usare?",
          content: "Ctrl+N (o Cmd+N): Nuova Visita rapida. Ctrl+P (o Cmd+P): Nuovo Paziente. Esc: Chiudi finestre modali. Invio: Conferma/Salva nei form (dove supportato)."
        },
        {
          title: "Come installare l'aggiornamento?",
          content: "Se è disponibile una nuova versione, il sistema ti avviserà o potrai scaricare l'installer aggiornato. Installando sopra la versione precedente, i dati verranno mantenuti (ma è sempre consigliato un backup prima di aggiornare)."
        }
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Assistenza e Feedback"
        subtitle="Siamo qui per aiutarti. Trova risposte o contattaci direttamente."
        icon={LifeBuoy}
        iconColor="primary"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: FAQ */}
        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader className="flex gap-3 px-6 pt-6">
              <HelpCircle className="w-6 h-6 text-primary" />
              <div className="flex flex-col">
                <p className="text-md font-bold">Domande Frequenti</p>
                <p className="text-small text-default-500">Risposte immediate ai dubbi più comuni</p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="px-6 py-6 space-y-8">
              {faqGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 ml-1 border-b border-primary/10 pb-2">
                    {group.category}
                  </h4>
                  <Accordion selectionMode="multiple" variant="light" className="px-0">
                    {group.items.map((item, index) => (
                      <AccordionItem
                        key={index}
                        aria-label={item.title}
                        title={
                          <span className="font-medium text-gray-700 text-sm">{item.title}</span>
                        }
                        className="group"
                        classNames={{ title: "text-sm", content: "text-sm text-gray-600" }}
                      >
                        <p className="pb-2">
                          {item.content}
                        </p>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Feedback Form */}
        <div className="space-y-6">
          <Card className="shadow-md h-full">
            <CardHeader className="flex gap-3 px-6 pt-6 bg-gray-50/50">
              <MessageSquare className="w-6 h-6 text-secondary" />
              <div className="flex flex-col">
                <p className="text-md font-bold">Inviaci un Messaggio</p>
                <p className="text-small text-default-500">Feedback, bug o richieste funzionali</p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="p-6 gap-6">
              {submitStatus === 'success' ? (
                <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mb-4 text-success">
                    <Send size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Grazie!</h3>
                  <p className="text-gray-500">Il tuo feedback è stato inviato correttamente.</p>
                  <Button
                    color="primary"
                    variant="flat"
                    className="mt-6"
                    onPress={() => setSubmitStatus('idle')}
                  >
                    Invia un altro
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <Input
                    name="name"
                    label="Nome"
                    placeholder="Il tuo nome"
                    value={feedbackData.name}
                    onChange={handleChange}
                    variant="bordered"
                    labelPlacement="outside"
                    isRequired
                  />
                  <Input
                    name="email"
                    type="email"
                    label="Email"
                    placeholder="tua@email.com"
                    value={feedbackData.email}
                    onChange={handleChange}
                    variant="bordered"
                    labelPlacement="outside"
                    isRequired
                  />
                  
                  <Textarea
                    name="message"
                    label="Messaggio"
                    placeholder="Scrivi qui il tuo messaggio..."
                    value={feedbackData.message}
                    onChange={handleChange}
                    variant="bordered"
                    labelPlacement="outside"
                    minRows={4}
                    isRequired
                  />

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full font-medium"
                    size="lg"
                    isLoading={isSubmitting}
                    startContent={!isSubmitting && <Send size={18} />}
                    isDisabled={!feedbackData.name || !feedbackData.email || !feedbackData.message}
                  >
                    Invia Feedback
                  </Button>
                </form>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
