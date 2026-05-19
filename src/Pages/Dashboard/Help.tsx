import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionItem,
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Avatar,
  Tooltip,
} from "@nextui-org/react";
import {
  HelpCircle,
  Send,
  LifeBuoy,
  Search,
  Paperclip,
  Mic,
  Square,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { VoiceWaveform, extractWaveformFromBlob, generatePlaceholderWaveform } from "../../components/chat/VoiceWaveform";
import { VoiceMessagePlayer } from "../../components/chat/VoiceMessagePlayer";
import { DoctorService } from "../../services/OfflineServices";
import {
  fetchSupportMessages,
  sendSupportMessage,
  mapToUiMessage,
} from "../../services/SupportChatService";
import type { Doctor } from "../../types/Storage";

const SUPPORT_CHAT_TEXT_ONLY = true;
const CHAT_POLL_MS = 4000;

type AttachmentType = "audio" | "file";

interface ChatAttachment {
  type: AttachmentType;
  name: string;
  url: string;
  mimeType: string;
  size?: number;
  durationSec?: number;
  waveform?: number[];
}

interface ChatMessage {
  id: string;
  role: "user" | "operator";
  text?: string;
  attachments?: ChatAttachment[];
  time: string;
  createdAt?: string;
}

const ACCEPTED_FILES =
  "image/*,.pdf,.xls,.xlsx,.doc,.docx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv";
const MAX_FILE_SIZE_MB = 15;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return FileSpreadsheet;
  return FileText;
}

export default function HelpAndFeedback() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set(["Gestione Pazienti"]),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(() =>
    generatePlaceholderWaveform(),
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const levelAnimRef = useRef<number | null>(null);
  const recordingCancelledRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, pendingAttachments, scrollToBottom]);

  useEffect(() => {
    return () => {
      pendingAttachments.forEach((a) => URL.revokeObjectURL(a.url));
      messages.forEach((m) => m.attachments?.forEach((a) => URL.revokeObjectURL(a.url)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const d = await DoctorService.getDoctor();
        if (cancelled) return;
        if (!d) {
          setChatError("Profilo medico non configurato. Completa la registrazione.");
          setChatLoading(false);
          return;
        }
        setDoctor(d);
        const remote = await fetchSupportMessages(d);
        if (!cancelled) {
          setMessages(remote.map(mapToUiMessage));
          setChatError(null);
        }
      } catch {
        if (!cancelled) {
          setChatError("Impossibile caricare la chat. Verifica la connessione al server.");
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!doctor) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const prev = messagesRef.current;
        const since = prev.length > 0 ? prev[prev.length - 1].createdAt : undefined;
        const remote = await fetchSupportMessages(doctor, since);
        if (cancelled || remote.length === 0) return;
        setMessages((current) => {
          const ids = new Set(current.map((m) => m.id));
          const mapped = remote.map(mapToUiMessage);
          const added = mapped.filter((m) => !ids.has(m.id));
          return added.length ? [...current, ...added] : current;
        });
        setChatError(null);
      } catch {
        // polling silenzioso
      }
    };

    const interval = setInterval(poll, CHAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [doctor]);

  const sendUserMessage = useCallback(
    async (text?: string, attachments?: ChatAttachment[]) => {
      const hasText = Boolean(text?.trim());
      const hasAttachments = Boolean(attachments?.length);
      if (!hasText && !hasAttachments) return;

      if (SUPPORT_CHAT_TEXT_ONLY && hasAttachments) return;
      if (!doctor) {
        setChatError("Profilo medico non disponibile.");
        return;
      }
      if (!hasText) return;

      const body = text!.trim();
      setIsSubmitting(true);
      setChatError(null);
      try {
        const sent = await sendSupportMessage(doctor, body);
        setMessages((prev) => [...prev, mapToUiMessage(sent)]);
        setInputValue("");
        setPendingAttachments([]);
      } catch {
        setChatError("Invio non riuscito. Riprova tra poco.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [doctor],
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) return;
    void sendUserMessage(
      inputValue,
      SUPPORT_CHAT_TEXT_ONLY ? undefined : pendingAttachments.length ? pendingAttachments : undefined,
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`"${file.name}" supera ${MAX_FILE_SIZE_MB} MB e non può essere allegato.`);
        continue;
      }
      newAttachments.push({
        type: "file",
        name: file.name,
        url: URL.createObjectURL(file),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
    }

    if (newAttachments.length) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
    }
    e.target.value = "";
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const formatRecordingTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopLevelAnimation = () => {
    if (levelAnimRef.current != null) {
      cancelAnimationFrame(levelAnimRef.current);
      levelAnimRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startLevelAnimation = (stream: MediaStream) => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    const barCount = 28;
    const tick = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / barCount));
      const bars = Array.from({ length: barCount }, (_, i) => {
        const v = data[i * step] / 255;
        return Math.min(1, Math.max(0.12, v * 1.4));
      });
      setRecordingWaveform(bars);
      levelAnimRef.current = requestAnimationFrame(tick);
    };
    levelAnimRef.current = requestAnimationFrame(tick);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopRecordingTimer();
        stopLevelAnimation();

        const cancelled = recordingCancelledRef.current;
        recordingCancelledRef.current = false;

        setIsRecording(false);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        setRecordingWaveform(generatePlaceholderWaveform());

        if (cancelled) {
          audioChunksRef.current = [];
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const duration = recordingSecondsRef.current;

        if (blob.size === 0) return;

        void (async () => {
          const waveform = await extractWaveformFromBlob(blob);
          const url = URL.createObjectURL(blob);
          const attachment: ChatAttachment = {
            type: "audio",
            name: `Audio ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
            url,
            mimeType: blob.type,
            size: blob.size,
            durationSec: duration,
            waveform,
          };
          sendUserMessage(undefined, [attachment]);
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      startLevelAnimation(stream);
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch {
      alert("Impossibile accedere al microfono. Verifica i permessi del browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const faqGroups = [
    {
      category: "Gestione Pazienti",
      items: [
        {
          title: "Come aggiungo un nuovo paziente?",
          content:
            "Vai alla sezione 'Pazienti' (o Dashboard) e clicca sul pulsante '+ Nuovo Paziente' in alto a destra. Compila i campi obbligatori (Nome, Cognome, Data di nascita, Sesso) e salva. Il Codice Fiscale verrà calcolato automaticamente se non inserito.",
        },
        {
          title: "Come posso cercare un paziente?",
          content:
            "Nella Dashboard o nella sezione Pazienti, usa la barra di ricerca in alto. Puoi cercare per Nome, Cognome o Codice Fiscale. Il sistema riconosce automaticamente se stai inserendo un CF (alfanumerico) o un nome.",
        },
        {
          title: "Cosa significa l'asterisco rosso (*) accanto al Codice Fiscale?",
          content:
            "Indica che il Codice Fiscale è stato generato automaticamente (presunto) e non verificato. Si consiglia di controllarlo con la tessera sanitaria del paziente e correggerlo se necessario modificando l'anagrafica.",
        },
        {
          title: "Come modifico o elimino un paziente?",
          content:
            "Dalla lista pazienti, clicca sulla card del paziente per aprire la sua scheda. Usa il pulsante 'Modifica' (icona matita) in alto a destra per cambiare i dati. Per eliminare, usa il pulsante 'Elimina' (icona cestino) nel modal di modifica. Attenzione: l'eliminazione cancella anche tutte le visite associate.",
        },
      ],
    },
    {
      category: "Visite e Referti",
      items: [
        {
          title: "Come creo una nuova visita?",
          content:
            "Dalla scheda del paziente, clicca su '+ Nuova Visita'. Puoi scegliere tra visita Ginecologica, Ginecologica Pediatrica (se abilitata in Impostazioni) e Ostetrica usando le schede in alto. I campi cambieranno in base al tipo selezionato.",
        },
        {
          title: "Come funziona il calcolo automatico della gravidanza?",
          content:
            "Nella visita Ostetrica, inserendo la 'Data Ultima Mestruazione' (LMP), il sistema calcola automaticamente la Data Presunta del Parto (DPP) e le Settimane di Gestazione attuali (es. 15+3). Puoi comunque modificare manualmente questi valori.",
        },
        {
          title: "Come uso i modelli (template) nei referti?",
          content:
            "Nei campi di testo (es. Anamnesi, Esame Obiettivo), trovi un pulsante 'Modello'. Cliccandolo puoi inserire testi predefiniti. Puoi creare nuovi modelli in 'Impostazioni > Modelli Referti'. La categoria del modello viene selezionata automaticamente in base alla sezione in cui ti trovi.",
        },
        {
          title: "Come stampo o salvo il referto in PDF?",
          content:
            "Dalla schermata di compilazione visita o dallo storico, clicca su 'Stampa'. Verrà generato un PDF professionale con l'intestazione del medico, i dati del paziente e il referto completo, pronto per essere stampato o salvato.",
        },
      ],
    },
    {
      category: "Esami e Documenti",
      items: [
        {
          title: "Come prescrivo esami complementari?",
          content:
            "Dalla scheda paziente, nella colonna di destra 'Esami', clicca su 'Nuovo Esame'. Puoi scegliere un esame dalla lista dei modelli (es. Colposcopia, Pap Test) o scriverne uno nuovo. Anche qui puoi generare un PDF di richiesta/prescrizione.",
        },
        {
          title: "Posso allegare file esterni?",
          content:
            "Attualmente il sistema gestisce i documenti generati internamente. In futuro sarà possibile allegare referti esterni (PDF/Immagini) alla scheda paziente.",
        },
      ],
    },
    {
      category: "Impostazioni e Dati",
      items: [
        {
          title: "Come modifico l'intestazione dei referti?",
          content:
            "Vai su 'Impostazioni > Ambulatori'. Qui puoi inserire i tuoi dati (Nome, Specializzazione) e aggiungere uno o più ambulatori (Indirizzo, Città, Contatti). L'ambulatorio impostato come 'Primario' apparirà nell'intestazione dei PDF.",
        },
        {
          title: "I miei dati sono al sicuro? Dove vengono salvati?",
          content:
            "Sì, Corioli funziona completamente offline (Local First). I dati vengono salvati in un database locale criptato sul tuo computer. Nessun dato viene inviato a server esterni o cloud, garantendo la massima privacy e conformità GDPR per l'uso locale.",
        },
        {
          title: "Come faccio il backup dei dati?",
          content:
            "Vai su 'Impostazioni > Backup e Dati'. Clicca su 'Esporta Backup' per scaricare un file unico (.json) contenente tutti i pazienti, visite e impostazioni. Puoi usare questo file per ripristinare i dati su un altro computer o per sicurezza.",
        },
      ],
    },
    {
      category: "Altro",
      items: [
        {
          title: "Quali scorciatoie da tastiera posso usare?",
          content:
            "Ctrl+N (o Cmd+N): Nuova Visita rapida. Ctrl+P (o Cmd+P): Nuovo Paziente. Esc: Chiudi finestre modali. Invio: Conferma/Salva nei form (dove supportato).",
        },
        {
          title: "Come installare l'aggiornamento?",
          content:
            "Se è disponibile una nuova versione, il sistema ti avviserà o potrai scaricare l'installer aggiornato. Installando sopra la versione precedente, i dati verranno mantenuti (ma è sempre consigliato un backup prima di aggiornare).",
        },
      ],
    },
  ];

  const filteredFaqGroups = faqGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.content.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (searchQuery.trim()) {
      setOpenCategories(new Set(filteredFaqGroups.map((g) => g.category)));
    }
  }, [searchQuery, filteredFaqGroups.length]);

  const renderAttachment = (att: ChatAttachment, isUser: boolean) => {
    if (att.type === "audio") {
      return (
        <div className="mt-0.5">
          <VoiceMessagePlayer
            url={att.url}
            waveform={att.waveform}
            durationSec={att.durationSec}
            isUser={isUser}
          />
        </div>
      );
    }

    const Icon = getFileIcon(att.mimeType);
    const isImage = att.mimeType.startsWith("image/");

    return (
      <div className="mt-1">
        {isImage ? (
          <a href={att.url} target="_blank" rel="noopener noreferrer">
            <img
              src={att.url}
              alt={att.name}
              className="max-w-[200px] max-h-[140px] rounded-lg object-cover border border-white/20"
            />
          </a>
        ) : (
          <a
            href={att.url}
            download={att.name}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              isUser ? "bg-white/15 hover:bg-white/25" : "bg-gray-50 hover:bg-gray-100 border border-gray-100"
            }`}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="truncate max-w-[160px] font-medium">{att.name}</span>
            {att.size != null && (
              <span className={`flex-shrink-0 ${isUser ? "text-white/60" : "text-gray-400"}`}>
                {formatFileSize(att.size)}
              </span>
            )}
          </a>
        )}
      </div>
    );
  };

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === "user";
    const hasContent = msg.text || msg.attachments?.length;

    if (!hasContent) return null;

    return (
      <div
        key={msg.id}
        className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      >
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
            isUser
              ? "bg-brand-800 text-white rounded-tr-sm"
              : "bg-white border border-gray-100 text-gray-700 rounded-tl-sm"
          }`}
        >
          {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
          {msg.attachments?.map((att, i) => (
            <div key={`${msg.id}-att-${i}`}>{renderAttachment(att, isUser)}</div>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
      </div>
    );
  };

  const canSend =
    !isSubmitting &&
    !isRecording &&
    !chatLoading &&
    Boolean(doctor) &&
    (inputValue.trim() || (!SUPPORT_CHAT_TEXT_ONLY && pendingAttachments.length > 0));

  return (
    <div className="corioli-page space-y-6 animate-in fade-in duration-500 flex flex-col min-h-0">
      <PageHeader
        title="Assistenza e Feedback"
        subtitle="Siamo qui per aiutarti. Trova risposte o contattaci direttamente."
        icon={LifeBuoy}
        iconColor="primary"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 lg:h-[calc(100vh-220px)] lg:max-h-[720px]">
        {/* FAQ — scroll interno, non influenza l'altezza della chat */}
        <div className="flex flex-col min-h-0 h-[420px] lg:h-full">
          <Card className="shadow-md flex flex-col h-full min-h-0 overflow-hidden">
            <CardHeader className="flex gap-3 px-6 pt-6 shrink-0">
              <HelpCircle className="w-6 h-6 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <p className="text-md font-bold">Domande Frequenti</p>
                <p className="text-small text-default-500">Risposte immediate ai dubbi più comuni</p>
              </div>
            </CardHeader>
            <div className="px-6 pb-4 shrink-0">
              <Input
                placeholder="Cerca nelle FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startContent={<Search size={18} className="text-default-400" />}
                variant="flat"
                radius="lg"
                classNames={{
                  inputWrapper: "bg-default-100 hover:bg-default-200 transition-colors",
                }}
              />
            </div>
            <Divider />
            <CardBody className="px-4 py-2 flex-1 min-h-0 overflow-y-auto">
              {filteredFaqGroups.length > 0 ? (
                <Accordion
                  selectionMode="multiple"
                  variant="splitted"
                  className="px-0"
                  selectedKeys={openCategories}
                  onSelectionChange={(keys) => {
                    if (keys === "all") {
                      setOpenCategories(new Set(filteredFaqGroups.map((g) => g.category)));
                      return;
                    }
                    setOpenCategories(new Set(Array.from(keys).map(String)));
                  }}
                >
                  {filteredFaqGroups.map((group) => (
                    <AccordionItem
                      key={group.category}
                      aria-label={group.category}
                      title={
                        <div className="flex items-center justify-between w-full pr-2 gap-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            {group.category}
                          </span>
                          <span className="text-[10px] font-medium text-default-400 normal-case tracking-normal shrink-0">
                            {group.items.length}{" "}
                            {group.items.length === 1 ? "domanda" : "domande"}
                          </span>
                        </div>
                      }
                      classNames={{
                        base: "border border-default-200 shadow-sm mb-2",
                        title: "text-sm",
                        trigger: "py-3 px-4",
                        content: "px-2 pb-3",
                      }}
                    >
                      <Accordion selectionMode="multiple" variant="light" className="px-0">
                        {group.items.map((item, index) => (
                          <AccordionItem
                            key={`${group.category}-${index}`}
                            aria-label={item.title}
                            title={
                              <span className="font-medium text-gray-700 text-sm">{item.title}</span>
                            }
                            classNames={{ title: "text-sm", content: "text-sm text-gray-600 px-2" }}
                          >
                            <p className="pb-2 pl-1">{item.content}</p>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center animate-in fade-in">
                  <Search className="w-12 h-12 text-default-200 mb-4" />
                  <p className="text-default-600 font-medium">Nessun risultato trovato</p>
                  <p className="text-default-400 text-sm mt-1">
                    Nessuna risposta per &quot;{searchQuery}&quot;
                  </p>
                  <Button variant="light" color="primary" className="mt-4" onPress={() => setSearchQuery("")}>
                    Mostra tutte le domande
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Chat — altezza fissa, scroll solo nell'area messaggi */}
        <div className="flex flex-col min-h-0 h-[480px] lg:h-full">
          <Card className="shadow-md flex flex-col h-full min-h-0 overflow-hidden">
            <CardHeader className="flex gap-3 px-6 py-4 bg-gray-50/50 shrink-0">
              <Avatar
                icon={<LifeBuoy className="w-5 h-5 text-brand-700" />}
                classNames={{ base: "bg-brand-100 shrink-0" }}
              />
              <div className="flex flex-col min-w-0">
                <p className="text-md font-bold text-gray-800">Chat con Operatore</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      chatError ? "bg-warning-500" : "bg-success-500"
                    }`}
                  />
                  <p className="text-xs text-default-500 font-medium">
                    {chatLoading ? "Connessione…" : chatError ? "Problema connessione" : "Assistenza attiva"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <Divider />

            <CardBody className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden bg-gray-50/30">
              <div
                ref={messagesScrollRef}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4"
              >
                {chatLoading && (
                  <p className="text-center text-sm text-default-400 py-8">Caricamento chat…</p>
                )}
                {!chatLoading && chatError && (
                  <p className="text-center text-sm text-warning-600 py-2 px-2">{chatError}</p>
                )}
                {!chatLoading && messages.map(renderMessage)}
                {isSubmitting && (
                  <div className="flex items-start animate-in fade-in">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 p-3 bg-white border-t border-gray-100">
                {pendingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-gray-100">
                    {pendingAttachments.map((att, i) => (
                      <div
                        key={`pending-${i}`}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs max-w-full"
                      >
                        {att.mimeType.startsWith("image/") ? (
                          <img src={att.url} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <FileText size={14} className="text-gray-500 shrink-0" />
                        )}
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removePendingAttachment(i)}
                          className="text-gray-400 hover:text-danger ml-1"
                          aria-label="Rimuovi allegato"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-1.5 items-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_FILES}
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {!isRecording ? (
                    <>
                      {!SUPPORT_CHAT_TEXT_ONLY && (
                        <>
                          <Tooltip content="Allega file (PDF, Excel, immagini…)">
                            <Button
                              isIconOnly
                              type="button"
                              variant="flat"
                              radius="lg"
                              className="flex-shrink-0 text-default-500"
                              isDisabled={isSubmitting}
                              onPress={() => fileInputRef.current?.click()}
                            >
                              <Paperclip size={18} />
                            </Button>
                          </Tooltip>
                          <Tooltip content="Messaggio vocale">
                            <Button
                              isIconOnly
                              type="button"
                              variant="flat"
                              radius="lg"
                              className="flex-shrink-0 text-default-500"
                              isDisabled={isSubmitting}
                              onPress={startRecording}
                            >
                              <Mic size={18} />
                            </Button>
                          </Tooltip>
                        </>
                      )}

                      <Input
                        placeholder="Scrivi un messaggio..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        variant="flat"
                        radius="lg"
                        className="flex-1 min-w-0"
                        classNames={{
                          input: "text-sm",
                          inputWrapper:
                            "bg-gray-100 hover:bg-gray-200/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/30 transition-all",
                        }}
                        disabled={isSubmitting}
                      />
                    </>
                  ) : (
                    <div className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 bg-brand-50 border border-brand-200 rounded-xl">
                      <Tooltip content="Invia messaggio vocale">
                        <Button
                          isIconOnly
                          type="button"
                          color="primary"
                          radius="full"
                          className="flex-shrink-0 corioli-cta min-w-9 w-9 h-9"
                          onPress={stopRecording}
                        >
                          <Send size={16} className="ml-0.5" />
                        </Button>
                      </Tooltip>
                      <VoiceWaveform
                        bars={recordingWaveform}
                        live
                        className="flex-1 justify-center"
                      />
                      <span className="text-sm font-medium tabular-nums text-brand-800 shrink-0 min-w-[36px] text-right">
                        {formatRecordingTime(recordingSeconds)}
                      </span>
                      <Tooltip content="Annulla">
                        <Button
                          isIconOnly
                          type="button"
                          variant="light"
                          radius="lg"
                          className="flex-shrink-0 text-default-500"
                          onPress={() => {
                            recordingCancelledRef.current = true;
                            if (mediaRecorderRef.current?.state === "recording") {
                              mediaRecorderRef.current.stop();
                            }
                          }}
                        >
                          <Square size={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  )}

                  {!isRecording && (
                    <Button
                      isIconOnly
                      type="submit"
                      color="primary"
                      radius="lg"
                      isDisabled={!canSend}
                      className="flex-shrink-0 corioli-cta"
                    >
                      <Send size={18} className="ml-0.5" />
                    </Button>
                  )}
                </form>
                <p className="text-[10px] text-center text-gray-400 mt-2">
                  {SUPPORT_CHAT_TEXT_ONLY
                    ? "Messaggi di testo inviati al team assistenza Corioli"
                    : `PDF, Excel, Word, immagini e messaggi vocali fino a ${MAX_FILE_SIZE_MB} MB`}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
