import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Avatar,
  Chip,
  Divider,
  Spinner,
  Input,
  Textarea,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
} from "@nextui-org/react";
import {
  FlaskConical,
  PlusIcon,
  EditIcon,
  Trash2Icon,
  SaveIcon,
  Printer,
  Maximize2,
  Minimize2,
  ClipboardList,
  ArrowLeftIcon,
  DownloadIcon,
  UserIcon,
  FileTextIcon,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Award,
  StickyNote,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  PatientService,
  VisitService,
  DoctorService,
  RichiestaEsameService,
  CertificatoService,
  TemplateService,
  PreferenceService,
} from "../../services/OfflineServices";
import { PdfService } from "../../services/PdfService";
import {
  Patient,
  Visit,
  Doctor,
  RichiestaEsameComplementare,
  CertificatoPaziente,
  MedicalTemplate,
} from "../../types/Storage";
import { calcolaStimePesoFetale } from "../../utils/fetalWeightUtils";
import {
  parseGestationalWeeks,
  getCentileForWeight,
  getCentileLabel,
} from "../../utils/fetalGrowthCentiles";
import { getFetalGrowthDataPointsFromVisits, getVisitsOfSamePregnancy } from "../../utils/fetalGrowthChartUtils";
import { useToast } from "../../contexts/ToastContext";
import { Breadcrumb } from "../../components/Breadcrumb";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { getDoctorProfileIncompleteMessage, isDoctorProfileComplete } from "../../utils/doctorProfile";

const SIEOG_NOTE =
  "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";

function getNotaBenePreview(text: string, maxChars: number = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + "…";
}

function formatPdfDate(dateString: string): string {
  if (!dateString) return "N/D";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/D";
  return d.toLocaleDateString("it-IT");
}

function calculateAge(birthDateString: string): string {
  if (!birthDateString) return "";
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age.toString();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64 ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sortRichiesteEsamiByDateAndCreation(
  list: RichiestaEsameComplementare[],
): RichiestaEsameComplementare[] {
  return [...list].sort((a, b) => {
    const dateDiff =
      new Date(b.dataRichiesta).getTime() - new Date(a.dataRichiesta).getTime();
    if (dateDiff !== 0) return dateDiff;
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdB - createdA;
  });
}

export default function PatientHistory() {
  const { patientId: patientIdParam } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const [editData, setEditData] = useState<Partial<Patient>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [richiesteEsami, setRichiesteEsami] = useState<
    RichiestaEsameComplementare[]
  >([]);
  const {
    isOpen: isEsameOpen,
    onOpen: onEsameOpen,
    onClose: onEsameClose,
  } = useDisclosure();
  const {
    isOpen: isEsamePreviewOpen,
    onOpen: onEsamePreviewOpen,
    onClose: onEsamePreviewClose,
  } = useDisclosure();
  const [selectedRichiestaEsamePreview, setSelectedRichiestaEsamePreview] =
    useState<RichiestaEsameComplementare | null>(null);
  const [editingRichiestaEsame, setEditingRichiestaEsame] =
    useState<RichiestaEsameComplementare | null>(null);
  const [notaBeneLocal, setNotaBeneLocal] = useState("");
  const [savingNotaBene, setSavingNotaBene] = useState(false);
  const [isNotaBeneOpen, setIsNotaBeneOpen] = useState(false);
  const [nuovaRichiestaNome, setNuovaRichiestaNome] = useState("");
  const [nuovaRichiestaNote, setNuovaRichiestaNote] = useState("");
  const [nuovaRichiestaData, setNuovaRichiestaData] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [modelloEsameSelezionato, setModelloEsameSelezionato] = useState("");
  const [savingEsame, setSavingEsame] = useState(false);
  const [isIncludeImagesModalOpen, setIsIncludeImagesModalOpen] =
    useState(false);
  const [includeImagesCount, setIncludeImagesCount] = useState(0);
  const [isIncludeFetalGrowthChartModalOpen, setIsIncludeFetalGrowthChartModalOpen] =
    useState(false);
  const [pendingPrintIncludeImages, setPendingPrintIncludeImages] = useState<boolean>(false);
  const [fetalFormulaPref, setFetalFormulaPref] = useState("hadlock4");
  const [pendingPrintVisit, setPendingPrintVisit] = useState<Visit | null>(null);
  const [pendingPdfAction, setPendingPdfAction] = useState<"print" | "download" | null>(null);
  /** URL del PDF generato per l’anteprima (stesso contenuto della stampa). Revocare in cleanup. */
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [showDoctorPhoneInPdf, setShowDoctorPhoneInPdf] = useState(true);
  const [showDoctorEmailInPdf, setShowDoctorEmailInPdf] = useState(true);
  /** Anteprima esame: PDF in iframe come referto */
  const [esamePreviewPdfBlobUrl, setEsamePreviewPdfBlobUrl] = useState<string | null>(null);
  const [esamePreviewPdfLoading, setEsamePreviewPdfLoading] = useState(false);
  const [esamePreviewFullscreen, setEsamePreviewFullscreen] = useState(false);
  /** Anteprima certificato */
  const [selectedCertificatoPreview, setSelectedCertificatoPreview] = useState<CertificatoPaziente | null>(null);
  const {
    isOpen: isCertificatoPreviewOpen,
    onOpen: onCertificatoPreviewOpen,
    onClose: onCertificatoPreviewClose,
  } = useDisclosure();
  const [certificatoPreviewPdfBlobUrl, setCertificatoPreviewPdfBlobUrl] = useState<string | null>(null);
  const [certificatoPreviewPdfLoading, setCertificatoPreviewPdfLoading] = useState(false);
  const [certificatoPreviewFullscreen, setCertificatoPreviewFullscreen] = useState(false);
  // Gestione Templates Esami e Certificati (via Settings/Storage)
  const [examTemplates, setExamTemplates] = useState<MedicalTemplate[]>([]);
  const [certTemplates, setCertTemplates] = useState<MedicalTemplate[]>([]);
  // Certificati paziente
  const [certificati, setCertificati] = useState<CertificatoPaziente[]>([]);
  const {
    isOpen: isCertificatoOpen,
    onOpen: onCertificatoOpen,
    onClose: onCertificatoClose,
  } = useDisclosure();
  const [editingCertificato, setEditingCertificato] =
    useState<CertificatoPaziente | null>(null);
  const [certTipo, setCertTipo] = useState<CertificatoPaziente["tipo"]>("assenza_lavoro");
  const [certData, setCertData] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [certDescrizione, setCertDescrizione] = useState("");
  const [savingCertificato, setSavingCertificato] = useState(false);
  const [rightColumnTab, setRightColumnTab] = useState<"esami" | "certificati">("esami");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadData = async () => {
    if (!patientIdParam) {
      setError("Identificativo paziente non fornito");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Recupera il paziente per id (UUID) o, per retrocompatibilità, per codice fiscale
      let patientData = await PatientService.getPatientById(patientIdParam);
      if (!patientData) {
        patientData = await PatientService.getPatientByCF(patientIdParam);
      }
      if (!patientData) {
        setError("Paziente non trovato");
        setLoading(false);
        return;
      }
      setPatient(patientData);

      const doc = await DoctorService.getDoctor();
      setDoctor(doc);

      // Recupera le visite del paziente
      const visitsData = await VisitService.getVisitsByPatientId(
        patientData.id,
      );
      // Ordina le visite per data (più recenti prima), usando createdAt come tie-breaker
      const sortedVisits = visitsData.sort((a, b) => {
        const dateDiff =
          new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setVisits(sortedVisits);

      const richieste = await RichiestaEsameService.getByPatientId(
        patientData.id,
      );
      setRichiesteEsami(sortRichiesteEsamiByDateAndCreation(richieste));

      const certList = await CertificatoService.getByPatientId(patientData.id);
      setCertificati(certList);
    } catch (error) {
      console.error("Errore durante il recupero dei dati:", error);
      setError("Errore durante il recupero delle visite");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotaBeneLocal(patient?.notaBene ?? "");
  }, [patient?.id, patient?.notaBene]);

  useEffect(() => {
    loadData();
    // Carica template esami
    TemplateService.getAllTemplates()
      .then((results) => {
        setExamTemplates(
          results.filter((t) => t.category === "esame_complementare"),
        );
        setCertTemplates(results.filter((t) => t.category === "certificato"));
      })
      .catch(console.error);
  }, [patientIdParam]);

  useEffect(() => {
    PreferenceService.getPreferences()
      .then((prefs) => {
        if (prefs?.formulaPesoFetale)
          setFetalFormulaPref(prefs.formulaPesoFetale as string);
      })
      .catch(() => {});
    PreferenceService.getPreferences().then((prefs) => {
      if (prefs?.formulaPesoFetale) setFetalFormulaPref(prefs.formulaPesoFetale as string);
      if (typeof prefs?.showDoctorPhoneInPdf === "boolean") {
        setShowDoctorPhoneInPdf(prefs.showDoctorPhoneInPdf as boolean);
      }
      if (typeof prefs?.showDoctorEmailInPdf === "boolean") {
        setShowDoctorEmailInPdf(prefs.showDoctorEmailInPdf as boolean);
      }
    }).catch(() => {});
  }, []);

  // Genera il PDF di anteprima (stesso della stampa) quando si apre il modale su visita ginecologica/ostetrica
  useEffect(() => {
    const isGyn =
      selectedVisit?.tipo === "ginecologica" ||
      selectedVisit?.tipo === "ginecologica_pediatrica";
    const isObs = selectedVisit?.tipo === "ostetrica";
    if (!isOpen || !selectedVisit || !patient || (!isGyn && !isObs)) {
      setPreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewPdfLoading(false);
      return;
    }
    let revoked = false;
    setPreviewPdfLoading(true);
    (async () => {
      try {
        const blob =
          isGyn
            ? await PdfService.generateGynecologicalPDF(patient, selectedVisit, {
                includeEcografiaImages: true,
              })
            : await PdfService.generateObstetricPDF(patient, selectedVisit, {
                includeEcografiaImages: true,
                includeFetalGrowthChart: true,
                fetalGrowthDataPoints:
                  selectedVisit.tipo === "ostetrica"
                    ? (() => {
                        const fino = visits.filter(
                          (v) =>
                            v.tipo === "ostetrica" &&
                            new Date(v.dataVisita).getTime() <= new Date(selectedVisit.dataVisita).getTime(),
                        );
                        const stessaGravidanza = getVisitsOfSamePregnancy(fino, selectedVisit);
                        return getFetalGrowthDataPointsFromVisits(stessaGravidanza, fetalFormulaPref);
                      })()
                    : undefined,
              });
        if (blob && !revoked) {
          const url = URL.createObjectURL(blob);
          setPreviewPdfBlobUrl(url);
        }
      } catch (e) {
        console.error("Errore generazione PDF anteprima:", e);
        if (!revoked) setPreviewPdfBlobUrl(null);
      } finally {
        if (!revoked) setPreviewPdfLoading(false);
      }
    })();
    return () => {
      revoked = true;
      setPreviewPdfBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setPreviewPdfLoading(false);
    };
  }, [isOpen, selectedVisit?.id, patient?.id, visits, fetalFormulaPref]);

  // Genera il PDF di anteprima (stesso della stampa) quando si apre il modale su visita ginecologica/ostetrica
  useEffect(() => {
    const isGyn =
      selectedVisit?.tipo === "ginecologica" ||
      selectedVisit?.tipo === "ginecologica_pediatrica";
    const isObs = selectedVisit?.tipo === "ostetrica";
    if (!isOpen || !selectedVisit || !patient || (!isGyn && !isObs)) {
      setPreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewPdfLoading(false);
      return;
    }
    let revoked = false;
    setPreviewPdfLoading(true);
    (async () => {
      try {
        const blob =
          isGyn
            ? await PdfService.generateGynecologicalPDF(patient, selectedVisit, {
                includeEcografiaImages: true,
              })
            : await PdfService.generateObstetricPDF(patient, selectedVisit, {
                includeEcografiaImages: true,
                includeFetalGrowthChart: true,
                fetalGrowthDataPoints:
                  selectedVisit.tipo === "ostetrica"
                    ? (() => {
                        const fino = visits.filter(
                          (v) =>
                            v.tipo === "ostetrica" &&
                            new Date(v.dataVisita).getTime() <= new Date(selectedVisit.dataVisita).getTime(),
                        );
                        const stessaGravidanza = getVisitsOfSamePregnancy(fino, selectedVisit);
                        return getFetalGrowthDataPointsFromVisits(stessaGravidanza, fetalFormulaPref);
                      })()
                    : undefined,
              });
        if (blob && !revoked) {
          const url = URL.createObjectURL(blob);
          setPreviewPdfBlobUrl(url);
        }
      } catch (e) {
        console.error("Errore generazione PDF anteprima:", e);
        if (!revoked) setPreviewPdfBlobUrl(null);
      } finally {
        if (!revoked) setPreviewPdfLoading(false);
      }
    })();
    return () => {
      revoked = true;
      setPreviewPdfBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setPreviewPdfLoading(false);
    };
  }, [isOpen, selectedVisit?.id, patient?.id, visits, fetalFormulaPref]);

  // Anteprima esame: genera PDF e mostra in iframe (come Anteprima Referto)
  useEffect(() => {
    if (!isEsamePreviewOpen || !selectedRichiestaEsamePreview || !patient) {
      setEsamePreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setEsamePreviewPdfLoading(false);
      return;
    }
    let revoked = false;
    setEsamePreviewPdfLoading(true);
    (async () => {
      try {
        const doc = await DoctorService.getDoctor();
        const blob = await PdfService.generateRichiestaEsamePDF(
          patient,
          selectedRichiestaEsamePreview,
          doc ?? null,
        );
        if (blob && !revoked) {
          const url = URL.createObjectURL(blob);
          setEsamePreviewPdfBlobUrl(url);
        }
      } catch (e) {
        console.error("Errore generazione PDF anteprima esame:", e);
        if (!revoked) setEsamePreviewPdfBlobUrl(null);
      } finally {
        if (!revoked) setEsamePreviewPdfLoading(false);
      }
    })();
    return () => {
      revoked = true;
      setEsamePreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setEsamePreviewPdfLoading(false);
    };
  }, [isEsamePreviewOpen, selectedRichiestaEsamePreview?.id, patient?.id]);

  // Anteprima certificato: genera PDF e mostra in iframe
  useEffect(() => {
    if (!isCertificatoPreviewOpen || !selectedCertificatoPreview || !patient) {
      setCertificatoPreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCertificatoPreviewPdfLoading(false);
      return;
    }
    let revoked = false;
    setCertificatoPreviewPdfLoading(true);
    (async () => {
      try {
        const doc = await DoctorService.getDoctor();
        const blob = await PdfService.generateCertificatoPDF(
          patient,
          selectedCertificatoPreview,
          doc ?? null,
        );
        if (blob && !revoked) {
          const url = URL.createObjectURL(blob);
          setCertificatoPreviewPdfBlobUrl(url);
        }
      } catch (e) {
        console.error("Errore generazione PDF anteprima certificato:", e);
        if (!revoked) setCertificatoPreviewPdfBlobUrl(null);
      } finally {
        if (!revoked) setCertificatoPreviewPdfLoading(false);
      }
    })();
    return () => {
      revoked = true;
      setCertificatoPreviewPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCertificatoPreviewPdfLoading(false);
    };
  }, [isCertificatoPreviewOpen, selectedCertificatoPreview?.id, patient?.id]);

  const ensureDoctorProfileComplete = () => {
    if (isDoctorProfileComplete(doctor)) return true;
    const message = getDoctorProfileIncompleteMessage(doctor);
    showToast(message, "error");
    navigate("/settings");
    return false;
  };

  const handleVisitClick = (visit: Visit) => {
    setSelectedVisit(visit);
    onOpen();
  };

  const handleOpenNuovaRichiestaEsame = () => {
    if (!ensureDoctorProfileComplete()) return;
    setEditingRichiestaEsame(null);
    setModelloEsameSelezionato("");
    setNuovaRichiestaNome("");
    setNuovaRichiestaNote("");
    setNuovaRichiestaData(new Date().toISOString().slice(0, 10));
    onEsameOpen();
  };

  const handleOpenEsamePreview = (r: RichiestaEsameComplementare) => {
    setSelectedRichiestaEsamePreview(r);
    onEsamePreviewOpen();
  };

  const handleOpenEditRichiestaEsame = (r: RichiestaEsameComplementare) => {
    setEditingRichiestaEsame(r);
    setModelloEsameSelezionato("");
    setNuovaRichiestaNome(r.nome);
    setNuovaRichiestaNote(r.note ?? "");
    setNuovaRichiestaData(r.dataRichiesta);
    onEsameOpen();
  };

  const handleFromPreviewToEdit = () => {
    const r = selectedRichiestaEsamePreview;
    if (!r) return;
    onEsamePreviewClose();
    setSelectedRichiestaEsamePreview(null);
    handleOpenEditRichiestaEsame(r);
  };

  const handleCloseEsameModal = () => {
    onEsameClose();
    setEditingRichiestaEsame(null);
  };

  const handleSelectModelloEsame = (modelloId: string) => {
    setNuovaRichiestaNome("");
    setNuovaRichiestaNote("");
    setModelloEsameSelezionato("");
    setEditingRichiestaEsame(null);
  };

  const handleSaveRichiestaEsame = async () => {
    if (!ensureDoctorProfileComplete()) return;
    if (!patient || !nuovaRichiestaNome.trim()) return;
    setSavingEsame(true);
    try {
      if (editingRichiestaEsame) {
        await RichiestaEsameService.update(editingRichiestaEsame.id, {
          nome: nuovaRichiestaNome.trim(),
          note: nuovaRichiestaNote.trim() || undefined,
          dataRichiesta: nuovaRichiestaData,
        });
        showToast("Richiesta esame aggiornata.");
      } else {
        await RichiestaEsameService.add({
          patientId: patient.id,
          nome: nuovaRichiestaNome.trim(),
          note: nuovaRichiestaNote.trim() || undefined,
          dataRichiesta: nuovaRichiestaData,
        });
        showToast("Richiesta esame salvata.");
      }
      const list = await RichiestaEsameService.getByPatientId(patient.id);
      setRichiesteEsami(sortRichiesteEsamiByDateAndCreation(list));
      handleCloseEsameModal();
    } catch (e) {
      console.error(e);
      showToast("Errore nel salvataggio della richiesta.", "error");
    } finally {
      setSavingEsame(false);
    }
  };

  const handlePrintRichiestaEsame = async (
    richiesta: RichiestaEsameComplementare,
  ) => {
    if (!patient) return;
    setPdfLoading(true);
    try {
      const doc = await DoctorService.getDoctor();
      const blob = await PdfService.generateRichiestaEsamePDF(
        patient,
        richiesta,
        doc ?? null,
      );
      const electronAPI = (
        window as unknown as {
          electronAPI?: { openPdfForPrint: (b64: string) => Promise<unknown> };
        }
      ).electronAPI;
      if (electronAPI?.openPdfForPrint) {
        const base64 = await blobToBase64(blob);
        await electronAPI.openPdfForPrint(base64);
        showToast("PDF aperto per la stampa.");
      } else {
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `Richiesta_esame_${patient.cognome}_${richiesta.dataRichiesta}.pdf`;
          a.click();
          showToast("PDF scaricato.");
        }
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      console.error("Errore generazione PDF:", err);
      showToast("Errore generazione PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDeleteRichiestaEsame = async (id: string): Promise<boolean> => {
    if (!confirm("Eliminare questa richiesta esame?")) return false;
    try {
      await RichiestaEsameService.delete(id);
      if (patient) {
        const list = await RichiestaEsameService.getByPatientId(patient.id);
        setRichiesteEsami(sortRichiesteEsamiByDateAndCreation(list));
      }
      showToast("Richiesta eliminata.");
      handleCloseEsameModal();
      return true;
    } catch (e) {
      showToast("Errore nell'eliminazione.", "error");
      return false;
    }
  };

  const getCertificatoTipoLabel = (tipo: CertificatoPaziente["tipo"]) => {
    const labels: Record<CertificatoPaziente["tipo"], string> = {
      assenza_lavoro: "Assenza da lavoro",
      idoneita: "Idoneità",
      malattia: "Malattia",
      altro: "Altro",
    };
    return labels[tipo];
  };

  /** Ricava il tipo certificato dal label/note del modello (per aggiornare il Select quando si applica un modello) */
  const getCertificatoTipoFromTemplate = (t: MedicalTemplate): CertificatoPaziente["tipo"] => {
    const raw = `${t.label ?? ""} ${t.note ?? ""}`.toLowerCase();
    if (raw.includes("idoneit")) return "idoneita";
    if (raw.includes("assenza") || raw.includes("astensione")) return "assenza_lavoro";
    if (raw.includes("malattia")) return "malattia";
    return "altro";
  };

  const handleOpenNuovoCertificato = () => {
    if (!ensureDoctorProfileComplete()) return;
    setEditingCertificato(null);
    setCertTipo("assenza_lavoro");
    setCertData(new Date().toISOString().slice(0, 10));
    setCertDescrizione("");
    onCertificatoOpen();
  };

  const handleOpenEditCertificato = (c: CertificatoPaziente) => {
    setEditingCertificato(c);
    setCertTipo(c.tipo);
    setCertData(c.dataCertificato.slice(0, 10));
    setCertDescrizione(c.descrizione ?? "");
    onCertificatoOpen();
  };

  const handleCloseCertificatoModal = () => {
    onCertificatoClose();
    setEditingCertificato(null);
  };

  const handleSaveCertificato = async () => {
    if (!patient || !certDescrizione.trim()) {
      showToast("Inserisci una descrizione per il certificato.", "warning");
      return;
    }
    setSavingCertificato(true);
    try {
      if (editingCertificato) {
        await CertificatoService.update(editingCertificato.id, {
          tipo: certTipo,
          dataCertificato: certData,
          descrizione: certDescrizione.trim(),
        });
        showToast("Certificato aggiornato.");
      } else {
        await CertificatoService.add({
          patientId: patient.id,
          tipo: certTipo,
          dataCertificato: certData,
          descrizione: certDescrizione.trim(),
        });
        showToast("Certificato salvato.");
      }
      const list = await CertificatoService.getByPatientId(patient.id);
      setCertificati(list);
      handleCloseCertificatoModal();
    } catch (e) {
      console.error(e);
      showToast("Errore nel salvataggio del certificato.", "error");
    } finally {
      setSavingCertificato(false);
    }
  };

  const handleDeleteCertificato = async (id: string) => {
    if (!confirm("Eliminare questo certificato?")) return;
    try {
      await CertificatoService.delete(id);
      if (patient) {
        const list = await CertificatoService.getByPatientId(patient.id);
        setCertificati(list);
      }
      showToast("Certificato eliminato.");
      handleCloseCertificatoModal();
    } catch (e) {
      showToast("Errore nell'eliminazione.", "error");
    }
  };

  const handleOpenCertificatoPreview = (c: CertificatoPaziente) => {
    setSelectedCertificatoPreview(c);
    onCertificatoPreviewOpen();
  };

  const handleCloseCertificatoPreview = () => {
    onCertificatoPreviewClose();
    setSelectedCertificatoPreview(null);
  };

  const handleFromCertificatoPreviewToEdit = () => {
    const c = selectedCertificatoPreview;
    if (!c) return;
    handleCloseCertificatoPreview();
    handleOpenEditCertificato(c);
  };

  const handlePrintCertificato = async (cert: CertificatoPaziente) => {
    if (!patient) return;
    setPdfLoading(true);
    try {
      const doc = await DoctorService.getDoctor();
      const blob = await PdfService.generateCertificatoPDF(patient, cert, doc ?? null);
      const electronAPI = (window as unknown as { electronAPI?: { openPdfForPrint: (b64: string) => Promise<unknown> } }).electronAPI;
      if (electronAPI?.openPdfForPrint) {
        const base64 = await blobToBase64(blob);
        await electronAPI.openPdfForPrint(base64);
        showToast("PDF aperto per la stampa.");
      } else {
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `Certificato_${patient.cognome}_${cert.dataCertificato}.pdf`;
          a.click();
          showToast("PDF scaricato.");
        }
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (err) {
      console.error("Errore generazione PDF certificato:", err);
      showToast("Errore generazione PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (
      !confirm(
        "Sei sicuro di voler eliminare questa visita? Questa azione è irreversibile.",
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await VisitService.deleteVisit(visitId);

      // Ricarica le visite
      if (patient) {
        const updatedVisits = await VisitService.getVisitsByPatientId(
          patient.id,
        );
        const sortedVisits = updatedVisits.sort((a, b) => {
          const dateDiff =
            new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        setVisits(sortedVisits);
      }

      // Chiudi modal se la visita eliminata era quella selezionata
      if (selectedVisit && selectedVisit.id === visitId) {
        onClose();
      }
    } catch (error) {
      console.error("Errore nell'eliminazione visita:", error);
      setError("Errore nell'eliminazione della visita");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!patient) return;
    if (
      !confirm(
        "Sei sicuro di voler eliminare questo paziente? Verranno eliminate anche tutte le visite collegate. Questa azione è irreversibile.",
      )
    ) {
      return;
    }

    setDeletingPatient(true);
    setError(null);
    try {
      await PatientService.deletePatient(patient.id);
      sessionStorage.setItem(
        "appdottori_toast",
        "Paziente eliminato con successo",
      );
      showToast("Paziente eliminato con successo");
      navigate("/pazienti");
    } catch (error) {
      console.error("Errore eliminazione paziente:", error);
      setError("Errore durante l'eliminazione del paziente.");
      showToast("Errore durante l'eliminazione del paziente.", "error");
    } finally {
      setDeletingPatient(false);
    }
  };

  // ── Patient Edit ──
  const handleOpenEdit = () => {
    if (!patient) return;
    setEditData({
      nome: patient.nome,
      cognome: patient.cognome,
      dataNascita: patient.dataNascita,
      luogoNascita: patient.luogoNascita,
      sesso: patient.sesso,
      codiceFiscale: patient.codiceFiscale,
      indirizzo: patient.indirizzo || "",
      telefono: patient.telefono || "",
      email: patient.email || "",
      gruppoSanguigno: patient.gruppoSanguigno || "",
      allergie: patient.allergie || "",
      altezza: patient.altezza,
      notaBene: patient.notaBene || "",
    });
    setSuccessMsg(null);
    onEditOpen();
  };

  const handleSavePatient = async () => {
    if (!patient) return;
    setSaving(true);
    try {
      await PatientService.updatePatient(patient.id, {
        ...editData,
        codiceFiscaleGenerato: false,
        updatedAt: new Date().toISOString(),
      });
      // Refresh patient data
      const updated = await PatientService.getPatientById(patient.id);
      if (updated) setPatient(updated);
      setSuccessMsg("Paziente aggiornato con successo!");
      setTimeout(() => {
        onEditClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (error) {
      console.error("Errore aggiornamento paziente:", error);
      setError("Errore durante l'aggiornamento del paziente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotaBene = async () => {
    if (!patient) return;
    setSavingNotaBene(true);
    try {
      await PatientService.updatePatient(patient.id, {
        notaBene: notaBeneLocal.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
      const updated = await PatientService.getPatientById(patient.id);
      if (updated) setPatient(updated);
      showToast("Nota salvata.");
    } catch (err) {
      console.error("Errore salvataggio nota:", err);
      showToast("Errore nel salvataggio della nota.", "error");
    } finally {
      setSavingNotaBene(false);
    }
  };

  const getPatientInitials = (patient: Patient) => {
    return `${patient.nome[0]}${patient.cognome[0]}`.toUpperCase();
  };

  const getGenderColor = (gender: string) => {
    return gender === "M" ? "primary" : "secondary";
  };

  const formatVisitDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd MMMM yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  const getPreviewAnamnesi = (visit: Visit) => {
    if (
      visit.tipo === "ginecologica" ||
      visit.tipo === "ginecologica_pediatrica"
    ) {
      return visit.ginecologia?.prestazione || visit.anamnesi;
    }
    if (visit.tipo === "ostetrica") {
      return visit.ostetricia?.prestazione || visit.anamnesi;
    }
    return visit.anamnesi;
  };

  const getPreviewDatiClinici = (visit: Visit) => {
    if (
      visit.tipo === "ginecologica" ||
      visit.tipo === "ginecologica_pediatrica"
    ) {
      return visit.ginecologia?.problemaClinico || visit.descrizioneClinica;
    }
    if (visit.tipo === "ostetrica") {
      return visit.ostetricia?.problemaClinico || visit.descrizioneClinica;
    }
    return visit.descrizioneClinica;
  };

  const getPreviewEsameObiettivo = (visit: Visit) => {
    if (
      visit.tipo === "ginecologica" ||
      visit.tipo === "ginecologica_pediatrica"
    ) {
      return visit.ginecologia?.esameBimanuale || visit.esamiObiettivo;
    }
    if (visit.tipo === "ostetrica") {
      return visit.ostetricia?.esameObiettivo || visit.esamiObiettivo;
    }
    return visit.esamiObiettivo;
  };

  const getPreviewConclusioni = (visit: Visit) => {
    if (
      visit.tipo === "ginecologica" ||
      visit.tipo === "ginecologica_pediatrica"
    ) {
      return (
        visit.ginecologia?.terapiaSpecifica || visit.conclusioniDiagnostiche
      );
    }
    if (visit.tipo === "ostetrica") {
      return visit.ostetricia?.noteOstetriche || visit.conclusioniDiagnostiche;
    }
    return visit.conclusioniDiagnostiche;
  };

  const renderEcografiaGallery = (images?: string[]) => {
    if (!images || images.length === 0) return null;
    return (
      <div className="mx-4 mt-3">
        <div className="bg-[#f0f0f0] px-2 py-1 font-bold text-[10px] uppercase">
          Immagini Ecografia
        </div>
        <div className="px-2 py-2 border-x border-b border-gray-300">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {images.map((image, index) => (
              <a
                key={`ecografia-${index}`}
                href={image}
                target="_blank"
                rel="noreferrer"
                className="block border border-gray-200 rounded-md overflow-hidden hover:opacity-90 transition-opacity"
              >
                <img
                  src={image}
                  alt={`Ecografia ${index + 1}`}
                  className="w-full h-28 object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleGeneratePdfFromPreview = async (visit: Visit) => {
    if (!patient) return;
    if (
      visit.tipo !== "ginecologica" &&
      visit.tipo !== "ginecologica_pediatrica" &&
      visit.tipo !== "ostetrica"
    ) {
      showToast(
        "Generazione PDF disponibile solo per visite ginecologiche e ostetriche.",
        "info",
      );
      return;
    }

    const imageCount =
      visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
        ? (visit.ginecologia?.ecografiaImmagini?.length ?? 0)
        : (visit.ostetricia?.ecografiaImmagini?.length ?? 0);

    if (imageCount > 0) {
      setIncludeImagesCount(imageCount);
      setPendingPrintVisit(visit);
      setPendingPdfAction("download");
      setIsIncludeImagesModalOpen(true);
      return;
    }

    if (visit.tipo === "ostetrica") {
      setPendingPrintVisit(visit);
      setPendingPrintIncludeImages(false);
      setPendingPdfAction("download");
      setIsIncludeFetalGrowthChartModalOpen(true);
      return;
    }

    await runDownloadPdf(visit, false);
  };

  const handlePrintPdf = async (visit: Visit) => {
    if (!patient) return;
    if (
      visit.tipo !== "ginecologica" &&
      visit.tipo !== "ginecologica_pediatrica" &&
      visit.tipo !== "ostetrica"
    ) {
      showToast(
        "Stampa disponibile solo per visite ginecologiche e ostetriche.",
        "info",
      );
      return;
    }

    const imageCount =
      visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
        ? (visit.ginecologia?.ecografiaImmagini?.length ?? 0)
        : (visit.ostetricia?.ecografiaImmagini?.length ?? 0);

    if (imageCount > 0) {
      setIncludeImagesCount(imageCount);
      setPendingPrintVisit(visit);
      setPendingPdfAction("print");
      setIsIncludeImagesModalOpen(true);
      return;
    }

    if (visit.tipo === "ostetrica") {
      setPendingPrintVisit(visit);
      setPendingPrintIncludeImages(false);
      setPendingPdfAction("print");
      setIsIncludeFetalGrowthChartModalOpen(true);
      return;
    }

    await runPrintPdf(visit, false);
  };

  const runDownloadPdf = async (
    visit: Visit,
    includeEcografiaImages: boolean,
    includeFetalGrowthChart?: boolean,
  ) => {
    if (!patient) return;
    let fetalGrowthDataPoints:
      | { gaWeeks: number; pesoGrammi: number }[]
      | undefined;
    if (visit.tipo === "ostetrica" && includeFetalGrowthChart) {
      const visitTime = new Date(visit.dataVisita).getTime();
      const fino = visits.filter(
        (v) => v.tipo === "ostetrica" && new Date(v.dataVisita).getTime() <= visitTime,
      );
      const stessaGravidanza = getVisitsOfSamePregnancy(fino, visit);
      fetalGrowthDataPoints = getFetalGrowthDataPointsFromVisits(
        stessaGravidanza,
        fetalFormulaPref,
      );
    } else {
      fetalGrowthDataPoints = undefined;
    }

    setPdfLoading(true);
    try {
      let blob: Blob | null = null;
      let filename = "";

      if (
        visit.tipo === "ginecologica" ||
        visit.tipo === "ginecologica_pediatrica"
      ) {
        const b = await PdfService.generateGynecologicalPDF(patient, visit, {
          includeEcografiaImages,
        });
        if (b) blob = b;
        filename = `Ginecologia_${patient.cognome}_${visit.dataVisita}.pdf`;
        showToast("PDF ginecologico generato.");
      } else if (visit.tipo === "ostetrica") {
        const b = await PdfService.generateObstetricPDF(patient, visit, {
          includeEcografiaImages,
          includeFetalGrowthChart: includeFetalGrowthChart ?? false,
          fetalGrowthDataPoints,
        });
        if (b) blob = b;
        filename = `Ostetricia_${patient.cognome}_${visit.dataVisita}.pdf`;
        showToast("PDF ostetrico generato.");
      }

      if (blob && filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Errore generazione PDF da anteprima:", err);
      showToast("Errore durante la generazione del PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const runPrintPdf = async (
    visit: Visit,
    includeEcografiaImages: boolean,
    includeFetalGrowthChart?: boolean,
  ) => {
    if (!patient) return;
    let fetalGrowthDataPoints: { gaWeeks: number; pesoGrammi: number }[] | undefined;
    if (visit.tipo === "ostetrica" && includeFetalGrowthChart) {
      const visitTime = new Date(visit.dataVisita).getTime();
      const fino = visits.filter(
        (v) => v.tipo === "ostetrica" && new Date(v.dataVisita).getTime() <= visitTime,
      );
      const stessaGravidanza = getVisitsOfSamePregnancy(fino, visit);
      fetalGrowthDataPoints = getFetalGrowthDataPointsFromVisits(
        stessaGravidanza,
        fetalFormulaPref,
      );
    } else {
      fetalGrowthDataPoints = undefined;
    }
    setPdfLoading(true);
    try {
      const blob =
        visit.tipo === "ginecologica" ||
        visit.tipo === "ginecologica_pediatrica"
          ? await PdfService.generateGynecologicalPDF(patient, visit, {
              includeEcografiaImages,
            })
          : await PdfService.generateObstetricPDF(patient, visit, {
              includeEcografiaImages,
              includeFetalGrowthChart: includeFetalGrowthChart ?? false,
              fetalGrowthDataPoints,
            });
      console.log("blob", blob);
      if (!blob) {
        showToast("Impossibile generare il PDF per la stampa.", "error");
        return;
      }
      const electronAPI = (
        window as unknown as {
          electronAPI?: { openPdfForPrint: (b64: string) => Promise<unknown> };
        }
      ).electronAPI;
      if (electronAPI?.openPdfForPrint) {
        const base64 = await blobToBase64(blob);
        await electronAPI.openPdfForPrint(base64);
        showToast("PDF aperto nell'app predefinita. Usa Stampa da lì.");
      } else {
        const pdfUrl = URL.createObjectURL(blob);
        const w = window.open(pdfUrl, "_blank");
        if (w) {
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
        } else {
          const filename =
            visit.tipo === "ginecologica" ||
            visit.tipo === "ginecologica_pediatrica"
              ? `Ginecologia_${patient.cognome}_${visit.dataVisita}.pdf`
              : `Ostetricia_${patient.cognome}_${visit.dataVisita}.pdf`;
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(pdfUrl);
          showToast(
            "PDF scaricato. Apri il file per visualizzarlo e stampare.",
          );
        }
      }
    } catch (err) {
      console.error("Errore stampa PDF:", err);
      showToast("Errore durante la stampa del PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleIncludeImagesChoice = (include: boolean) => {
    const visit = pendingPrintVisit;
    const action = pendingPdfAction;
    setIsIncludeImagesModalOpen(false);
    if (!visit || !action) return;
    if (visit.tipo === "ostetrica") {
      setPendingPrintIncludeImages(include);
      setIsIncludeFetalGrowthChartModalOpen(true);
      return;
    }
    setPendingPrintVisit(null);
    setPendingPdfAction(null);
    if (action === "print") {
      runPrintPdf(visit, include);
    } else {
      runDownloadPdf(visit, include);
    }
  };

  const handleIncludeFetalGrowthChartChoice = async (include: boolean) => {
    const visit = pendingPrintVisit;
    const action = pendingPdfAction;
    setIsIncludeFetalGrowthChartModalOpen(false);
    setPendingPrintVisit(null);
    setPendingPdfAction(null);
    if (!visit || !action) return;
    if (action === "print") {
      await runPrintPdf(visit, pendingPrintIncludeImages, include);
    } else {
      await runDownloadPdf(visit, pendingPrintIncludeImages, include);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardBody className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || "Paziente non trovato"}
          </h2>
          <Button
            color="primary"
            onPress={() => navigate("/")}
            startContent={<ArrowLeftIcon size={16} />}
          >
            Torna a Home
          </Button>
        </CardBody>
      </Card>
    );
  }

  const breadcrumbItems = patient
    ? [
        { label: "Dashboard", path: "/" },
        { label: "Pazienti", path: "/pazienti" },
        { label: `${patient.nome} ${patient.cognome}` },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}

      {/* 1. Profilo Paziente Unificato */}
      <Card className="shadow-md border border-default-100">
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar & Nome */}
            <div className="flex items-center gap-5 flex-1">
              <Avatar
                name={getPatientInitials(patient)}
                className="w-20 h-20 text-2xl"
                color={getGenderColor(patient.sesso)}
                isBordered
              />
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {patient.nome} {patient.cognome}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1 bg-default-100 px-2 py-1 rounded-md">
                    <UserIcon size={14} />
                    <CodiceFiscaleValue
                      value={patient.codiceFiscale}
                      generatedFromImport={Boolean(
                        patient.codiceFiscaleGenerato,
                      )}
                    />
                  </div>
                  <span className="hidden md:inline text-default-300">|</span>
                  <span>
                    {formatVisitDate(patient.dataNascita)}
                    <span className="text-default-400 ml-1">
                      ({calculateAge(patient.dataNascita)} anni)
                    </span>
                  </span>
                  <span className="hidden md:inline text-default-300">|</span>
                  <span className="font-medium">
                    {patient.sesso === "M" ? "Maschio" : "Femmina"}
                  </span>
                </div>
                {(patient.telefono ||
                  patient.email ||
                  patient.luogoNascita) && (
                  <div className="text-sm text-gray-500 pt-1 flex flex-wrap gap-x-4">
                    {patient.luogoNascita && (
                      <span>📍 {patient.luogoNascita}</span>
                    )}
                    {patient.telefono && <span>📞 {patient.telefono}</span>}
                    {patient.email && <span>✉️ {patient.email}</span>}
                  </div>
                )}
                {patient.allergie && patient.allergie.trim() !== "" && (
                  <div className="text-sm text-danger-500 pt-1 flex items-start gap-1">
                    <span>⚠️</span>
                    <span className="whitespace-pre-line">
                      Allergie: {patient.allergie}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Azioni Rapide */}
            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0">
              <Button
                color="secondary"
                variant="flat"
                size="sm"
                onPress={() => navigate(`/patient-history/${patient.id}/files`)}
                startContent={<FileTextIcon size={16} />}
                className="justify-start md:w-40"
              >
                File
              </Button>
              <Button
                color="primary"
                variant="flat"
                size="sm"
                onPress={handleOpenEdit}
                startContent={<EditIcon size={16} />}
                className="justify-start md:w-40"
              >
                Modifica Dati
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Nota bene: riga sottile, quasi impercettibile se vuota */}
      <div
        className={`rounded-lg border transition-colors ${
          notaBeneLocal.trim() || isNotaBeneOpen
            ? "border-default-200 bg-default-50/30"
            : "border-dashed border-default-200 bg-transparent hover:bg-default-50/20"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsNotaBeneOpen((prev) => !prev)}
          className="flex items-center gap-2 w-full min-w-0 py-2 px-3 text-left"
        >
          <StickyNote size={14} className="text-default-400 shrink-0" />
          <span
            className="text-xs text-default-500 flex-1 min-w-0"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {!notaBeneLocal.trim() && !isNotaBeneOpen
              ? "Nota bene (amica, prezzi, familiarità…)"
              : notaBeneLocal.trim()
                ? getNotaBenePreview(notaBeneLocal)
                : "Nota bene"}
          </span>
          <span className="text-default-400 shrink-0">
            {isNotaBeneOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {isNotaBeneOpen && (
          <div className="px-3 pb-3 pt-0 border-t border-default-100">
            <Textarea
              placeholder="Es. Amica, prezzo speciale · Familiarità cancro · Richiamare al pomeriggio..."
              value={notaBeneLocal}
              onValueChange={setNotaBeneLocal}
              variant="bordered"
              minRows={2}
              maxRows={4}
              size="sm"
              classNames={{
                input: "text-sm",
                inputWrapper: "bg-white border-default-200",
              }}
              className="w-full"
            />
            <Button
              color="primary"
              size="sm"
              variant="flat"
              onPress={handleSaveNotaBene}
              isLoading={savingNotaBene}
              isDisabled={savingNotaBene}
              startContent={<SaveIcon size={14} />}
              className="mt-2"
            >
              Salva
            </Button>
          </div>
        )}
      </div>

      {/* 2. Layout a Griglia: Visite a sinistra, Esami a destra */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNA SINISTRA: VISITE (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-default-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                <FileTextIcon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Visite</h2>
                <p className="text-xs text-gray-500">
                  {visits.length} registrate
                </p>
              </div>
            </div>
            <Button
              color="success"
              className="text-white font-medium shadow-sm"
              size="sm"
              onPress={() => {
                if (!ensureDoctorProfileComplete()) return;
                navigate(`/add-visit?patientId=${patient.id}`);
              }}
              startContent={<PlusIcon size={16} />}
            >
              Nuova Visita
            </Button>
          </div>

          {visits.length === 0 ? (
            <Card className="bg-default-50 border-dashed border-default-300">
              <CardBody className="text-center py-10">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-base font-semibold text-gray-900">
                  Nessuna visita
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Inizia il percorso clinico.
                </p>
                <Button
                  color="success"
                  size="sm"
                  className="text-white"
                  onPress={() => {
                    if (!ensureDoctorProfileComplete()) return;
                    navigate(`/add-visit?patientId=${patient.id}`);
                  }}
                >
                  Aggiungi Prima Visita
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {visits.map((visit) => (
                <Card
                  key={visit.id}
                  isPressable
                  onPress={() => handleVisitClick(visit)}
                  className="w-full hover:shadow-md transition-all border-transparent hover:border-primary-100 group cursor-pointer"
                >
                  <CardBody className="p-5">
                    <div className="flex flex-col md:flex-row gap-5">
                      {/* Data e Icona (Colonna sinistra fissa) */}
                      <div className="flex md:flex-col items-center md:items-start gap-3 min-w-[100px] border-b md:border-b-0 md:border-r border-default-100 pb-3 md:pb-0 md:pr-4">
                        <div className="flex flex-col items-center md:items-start">
                          <span className="text-2xl font-bold text-gray-800 leading-none">
                            {format(parseISO(visit.dataVisita), "dd")}
                          </span>
                          <span className="text-sm font-medium text-gray-500 uppercase">
                            {format(parseISO(visit.dataVisita), "MMM yyyy", {
                              locale: it,
                            })}
                          </span>
                        </div>
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            visit.tipo === "ginecologica" ||
                            visit.tipo === "ginecologica_pediatrica"
                              ? "danger"
                              : visit.tipo === "ostetrica"
                                ? "secondary"
                                : "primary"
                          }
                          className="capitalize font-semibold"
                        >
                          {visit.tipo || "Generale"}
                        </Chip>
                      </div>

                      {/* Contenuto Principale */}
                      <div className="flex-1 space-y-3">
                        {/* Dettagli specifici per tipo */}
                        <div>
                          {visit.tipo === "ostetrica" && visit.ostetricia ? (
                            <div className="mb-2">
                              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full mr-2">
                                {visit.ostetricia.settimaneGestazione || "?"}ª
                                Settimana
                              </span>
                              <p className="text-gray-700 mt-1 text-sm font-medium">
                                {visit.ostetricia.prestazione ||
                                  visit.anamnesi ||
                                  "Controllo ostetrico"}
                              </p>
                            </div>
                          ) : (visit.tipo === "ginecologica" ||
                              visit.tipo === "ginecologica_pediatrica") &&
                            visit.ginecologia ? (
                            <div className="mb-2">
                              <p className="text-gray-700 text-sm font-medium">
                                {visit.ginecologia.prestazione ||
                                  visit.anamnesi ||
                                  (visit.tipo === "ginecologica_pediatrica"
                                    ? "Visita ginecologica pediatrica"
                                    : "Visita ginecologica")}
                              </p>
                            </div>
                          ) : (
                            <div className="mb-2">
                              <p className="text-gray-700 text-sm font-medium">
                                {visit.descrizioneClinica ||
                                  visit.anamnesi ||
                                  "Visita generale"}
                              </p>
                            </div>
                          )}

                          {/* Estratto note/conclusioni (cosa è stato fatto/trovato) */}
                          {(visit.conclusioniDiagnostiche ||
                            visit.ginecologia?.conclusione ||
                            visit.ostetricia?.noteOstetriche) && (
                            <div className="text-sm text-gray-600 bg-default-50 p-2 rounded-lg border-l-3 border-default-300">
                              {visit.conclusioniDiagnostiche ||
                                visit.ginecologia?.conclusione ||
                                visit.ostetricia?.noteOstetriche}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Azioni (a destra su desktop) */}
                      <div
                        className="flex md:flex-col gap-2 justify-end md:justify-start border-t md:border-t-0 md:border-l border-default-100 pt-3 md:pt-0 md:pl-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="primary"
                          onPress={() => navigate(`/edit-visit/${visit.id}`)}
                          title="Modifica"
                        >
                          <EditIcon size={18} />
                        </Button>
                        {(visit.tipo === "ginecologica" ||
                          visit.tipo === "ginecologica_pediatrica" ||
                          visit.tipo === "ostetrica") && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="secondary"
                            onPress={() => handlePrintPdf(visit)}
                            isLoading={pdfLoading}
                            title="Stampa Referto"
                          >
                            <Printer size={18} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* COLONNA DESTRA: Esami e Certificati a tab + pulsante sulla stessa riga */}
        <div className="lg:col-span-1 flex flex-col min-h-0 bg-white rounded-xl border border-default-100 shadow-sm overflow-hidden">
          {/* Riga unica: tab testuali a sinistra, pulsante azione a destra */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-default-100 bg-default-50/50">
            <div className="flex gap-0 rounded-lg bg-default-100 p-0.5">
              <button
                type="button"
                onClick={() => setRightColumnTab("esami")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  rightColumnTab === "esami"
                    ? "bg-white text-secondary-700 shadow-sm"
                    : "text-default-600 hover:text-default-800"
                }`}
              >
                <FlaskConical size={16} />
                Esami
                <span className={`text-xs ${rightColumnTab === "esami" ? "text-secondary-600" : "text-default-500"}`}>
                  {richiesteEsami.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRightColumnTab("certificati")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  rightColumnTab === "certificati"
                    ? "bg-white text-warning-700 shadow-sm"
                    : "text-default-600 hover:text-default-800"
                }`}
              >
                <Award size={16} />
                Certificati
                <span className={`text-xs ${rightColumnTab === "certificati" ? "text-warning-600" : "text-default-500"}`}>
                  {certificati.length}
                </span>
              </button>
            </div>
            {rightColumnTab === "esami" ? (
              <Button
                color="secondary"
                size="sm"
                variant="flat"
                className="flex-shrink-0 font-medium"
                onPress={handleOpenNuovaRichiestaEsame}
                startContent={<PlusIcon size={16} />}
              >
                Nuovo Esame
              </Button>
            ) : (
              <Button
                color="warning"
                size="sm"
                variant="flat"
                className="flex-shrink-0 font-medium"
                onPress={handleOpenNuovoCertificato}
                startContent={<PlusIcon size={16} />}
              >
                Nuovo Certificato
              </Button>
            )}
          </div>

          {/* Contenuto lista (solo il tab attivo) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {rightColumnTab === "esami" && (
              <div className="space-y-3">
                {richiesteEsami.length === 0 ? (
                  <Card className="bg-default-50 border-dashed border-default-300 shadow-none">
                    <CardBody className="text-center py-8 px-4">
                      <p className="text-sm text-gray-500 mb-3">Nessuna prescrizione attiva.</p>
                      <Button color="secondary" variant="flat" size="sm" onPress={handleOpenNuovaRichiestaEsame}>
                        Crea Richiesta
                      </Button>
                    </CardBody>
                  </Card>
                ) : (
                  richiesteEsami.map((r) => (
                    <Card
                      key={r.id}
                      isPressable
                      onPress={() => handleOpenEsamePreview(r)}
                      className="border border-default-200 shadow-sm hover:border-secondary-300 group cursor-pointer w-full min-h-[7.5rem]"
                    >
                      <CardBody className="p-3 min-h-[7.5rem] flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {formatVisitDate(r.dataRichiesta)}
                          </span>
                          <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" color="primary" variant="light" isIconOnly className="h-6 w-6 min-w-0" onPress={() => handleOpenEditRichiestaEsame(r)} title="Modifica">
                              <EditIcon size={14} />
                            </Button>
                            <Button size="sm" color="secondary" variant="light" isIconOnly className="h-6 w-6 min-w-0" onPress={() => handlePrintRichiestaEsame(r)} isLoading={pdfLoading} title="Stampa PDF">
                              <Printer size={14} />
                            </Button>
                          </div>
                        </div>
                        <h4 className="font-semibold text-gray-800 text-sm leading-snug mb-1 break-words">{r.nome}</h4>
                        {r.note ? (
                          <p className="text-xs text-gray-500 bg-gray-50 p-1.5 rounded border border-gray-100 break-words line-clamp-3">{r.note}</p>
                        ) : (
                          <div className="flex-1 min-h-[1.5rem]" />
                        )}
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            )}
            {rightColumnTab === "certificati" && (
              <div className="space-y-3">
                {certificati.length === 0 ? (
                  <Card className="bg-default-50 border-dashed border-default-300 shadow-none">
                    <CardBody className="text-center py-8 px-4">
                      <p className="text-sm text-gray-500 mb-3">Nessun certificato.</p>
                      <Button color="warning" variant="flat" size="sm" onPress={handleOpenNuovoCertificato}>
                        Aggiungi certificato
                      </Button>
                    </CardBody>
                  </Card>
                ) : (
                  certificati.map((c) => (
                    <Card
                      key={c.id}
                      isPressable
                      onPress={() => handleOpenCertificatoPreview(c)}
                      className="border border-default-200 shadow-sm hover:border-warning-300 group cursor-pointer w-full min-h-[5rem]"
                    >
                      <CardBody className="p-3 min-h-[5rem] flex flex-col">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {format(parseISO(c.dataCertificato), "dd MMM yyyy", { locale: it })}
                          </span>
                          <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" color="primary" variant="light" isIconOnly className="h-6 w-6 min-w-0" onPress={() => handleOpenEditCertificato(c)} title="Modifica">
                              <EditIcon size={14} />
                            </Button>
                            <Button size="sm" color="warning" variant="light" isIconOnly className="h-6 w-6 min-w-0" onPress={() => handlePrintCertificato(c)} isLoading={pdfLoading} title="Stampa PDF">
                              <Printer size={14} />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Chip size="sm" variant="flat" color="warning" className="text-[10px]">
                            {getCertificatoTipoLabel(c.tipo)}
                          </Chip>
                        </div>
                        <p className="text-xs text-gray-700 line-clamp-2 break-words">{c.descrizione}</p>
                      </CardBody>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visit Details Modal - Anteprima Referto */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={previewFullscreen ? "full" : "5xl"}
        scrollBehavior="inside"
        classNames={
          previewFullscreen
            ? { base: "m-0 max-w-[100vw] max-h-[100vh] h-[100vh] rounded-none" }
            : undefined
        }
      >
        <ModalContent
          className={previewFullscreen ? "flex flex-col max-h-[100vh] h-[100vh]" : undefined}
        >
          {selectedVisit && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h2 className="text-xl font-bold">Anteprima Referto</h2>
                  </div>
                  <Chip
                    color={
                      selectedVisit.tipo === "ginecologica" ||
                      selectedVisit.tipo === "ginecologica_pediatrica"
                        ? "primary"
                        : selectedVisit.tipo === "ostetrica"
                          ? "secondary"
                          : "default"
                    }
                    variant="flat"
                  >
                    {selectedVisit.tipo === "ginecologica_pediatrica"
                      ? "Ginecologia Pediatrica"
                      : selectedVisit.tipo === "ginecologica"
                        ? "Ginecologia"
                        : selectedVisit.tipo === "ostetrica"
                          ? "Ostetricia"
                          : "Generale"}
                  </Chip>
                </div>
              </ModalHeader>
              <ModalBody
                className={previewFullscreen ? "flex-1 flex flex-col min-h-0 overflow-hidden" : undefined}
              >
                {(selectedVisit.tipo === "ginecologica" ||
                  selectedVisit.tipo === "ginecologica_pediatrica" ||
                  selectedVisit.tipo === "ostetrica") &&
                  (previewPdfLoading ? (
                    <div className="flex justify-center items-center min-h-[60vh]">
                      <Spinner size="lg" color="primary" label="Generazione anteprima PDF..." />
                    </div>
                  ) : previewPdfBlobUrl ? (
                    <div
                      className={
                        previewFullscreen
                          ? "flex-1 min-h-0 flex flex-col rounded-lg p-2 bg-[#e5e5e5]"
                          : "bg-[#e5e5e5] rounded-lg p-2 flex flex-col min-h-[70vh]"
                      }
                    >
                      <iframe
                        src={previewPdfBlobUrl}
                        title="Anteprima referto"
                        className={
                          previewFullscreen
                            ? "flex-1 w-full min-h-0 rounded border border-gray-300 bg-white"
                            : "flex-1 w-full min-h-[70vh] rounded border border-gray-300 bg-white"
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center items-center min-h-[60vh] text-default-500">
                      Anteprima non disponibile.
                    </div>
                  ))}
                {(selectedVisit.tipo !== "ginecologica" &&
                  selectedVisit.tipo !== "ginecologica_pediatrica" &&
                  selectedVisit.tipo !== "ostetrica") && (
                <div className="bg-[#e5e5e5] rounded-lg p-4">
                  {/* Foglio A4-like per visite generali */}
                  <div className="mx-auto w-full max-w-[210mm] bg-white border border-gray-300 shadow-sm text-[#141414] font-sans">
                    {/* ─── Header come PDF ─── */}
                    <div className="text-center pt-4 pb-2">
                      <p className="text-base font-bold uppercase tracking-tight">
                        {doctor
                          ? `Dott. ${doctor.nome} ${doctor.cognome}`
                          : "Studio Medico"}
                      </p>
                      {doctor?.specializzazione && (
                        <p className="text-[11px] text-[#3c3c3c] uppercase mt-0.5">
                          {doctor.specializzazione}
                        </p>
                      )}
                      <div className="border-t border-gray-300 w-4/5 mx-auto my-2" />
                      <p className="text-lg font-bold">REFERTO VISITA</p>
                      <p className="text-[11px] text-[#3c3c3c] mt-0.5" />
                    </div>

                    {/* ─── Box paziente come PDF (DATI DEL PAZIENTE | DATA VISITA) ─── */}
                    <div className="border border-gray-300 mx-4 mt-2">
                      <div className="bg-[#f0f0f0] px-2 py-1.5 flex justify-between items-center text-[10px] font-bold text-[#3c3c3c]">
                        <span>DATI DEL PAZIENTE</span>
                        <span>
                          DATA VISITA: {formatPdfDate(selectedVisit.dataVisita)}
                        </span>
                      </div>
                      <div className="px-2 py-2">
                        <p className="text-sm font-bold">
                          {patient.nome} {patient.cognome}
                        </p>
                        <p className="text-[11px] text-[#3c3c3c] mt-0.5">
                          Nato/a il: {formatPdfDate(patient.dataNascita)}
                          {calculateAge(patient.dataNascita)
                            ? ` (${calculateAge(patient.dataNascita)} anni)`
                            : ""}
                          {"   •   "}CF:{" "}
                          <CodiceFiscaleValue
                            value={patient.codiceFiscale}
                            placeholder="-"
                            generatedFromImport={Boolean(
                              patient.codiceFiscaleGenerato,
                            )}
                          />
                          {"   •   "}Sesso:{" "}
                          {patient.sesso === "M"
                            ? "M"
                            : patient.sesso === "F"
                              ? "F"
                              : "-"}
                        </p>
                      </div>
                    </div>

                    {/* Visita generale: solo sezioni testuali */}
                    <>
                        {[
                          {
                            title: "ANAMNESI",
                            content: getPreviewAnamnesi(selectedVisit),
                          },
                          {
                            title: "Dati Clinici",
                            content: getPreviewDatiClinici(selectedVisit),
                          },
                          {
                            title: "ESAME OBIETTIVO",
                            content: getPreviewEsameObiettivo(selectedVisit),
                          },
                          {
                            title: "Conclusioni e Terapia",
                            content: getPreviewConclusioni(selectedVisit),
                          },
                        ].map((sec, i) => (
                          <div key={i} className="mx-4 mt-3">
                            <div className="bg-[#f0f0f0] px-2 py-1 font-bold text-[10px] uppercase">
                              {sec.title}
                            </div>
                            <div className="px-2 py-1.5 text-[11px] whitespace-pre-wrap border-x border-b border-gray-300">
                              {sec.content?.trim() || "-"}
                            </div>
                          </div>
                        ))}
                    </>

                    {/* Footer come PDF */}
                    <div className="border-t border-gray-300 mt-6 mx-4 pt-3 pb-4">
                      <p className="text-[10px] text-[#3c3c3c] text-center">
                        {(() => {
                          const parts: string[] = [];
                          if (
                            doctor?.ambulatori &&
                            doctor.ambulatori.length > 0
                          ) {
                            const amb =
                              doctor.ambulatori.find((a) => a.isPrimario) ||
                              doctor.ambulatori[0];
                            parts.push(
                              amb.nome,
                              `${amb.indirizzo}, ${amb.citta}`,
                            );
                          }
                          if (doctor?.telefono)
                            parts.push(`Tel: ${doctor.telefono}`);
                          if (doctor?.email) parts.push(doctor.email);
                          if (showDoctorPhoneInPdf && doctor?.telefono) parts.push(`Tel: ${doctor.telefono}`);
                          if (showDoctorEmailInPdf && doctor?.email) parts.push(doctor.email);
                          return parts.length ? parts.join("  •  ") : "—";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
                )}
              </ModalBody>
              <ModalFooter className="flex-wrap gap-2">
                <Button
                  color="danger"
                  variant="light"
                  startContent={<Trash2Icon size={16} />}
                  onPress={() =>
                    selectedVisit && handleDeleteVisit(selectedVisit.id)
                  }
                  className="mr-auto"
                  aria-label="Elimina visita"
                  title="Elimina visita"
                >
                  Elimina visita
                </Button>
                <Button
                  color="default"
                  variant="flat"
                  startContent={
                    previewFullscreen ? (
                      <Minimize2 size={16} />
                    ) : (
                      <Maximize2 size={16} />
                    )
                  }
                  onPress={() => setPreviewFullscreen(!previewFullscreen)}
                >
                  {previewFullscreen ? "Riduci" : "Espandi"}
                </Button>
                <Button
                  color="secondary"
                  variant="flat"
                  startContent={<Printer size={16} />}
                  onPress={() => handlePrintPdf(selectedVisit)}
                  isLoading={pdfLoading}
                  isDisabled={pdfLoading}
                >
                  Stampa
                </Button>
                <Button
                  color="default"
                  variant="flat"
                  startContent={<DownloadIcon size={16} />}
                  onPress={() => handleGeneratePdfFromPreview(selectedVisit)}
                  isLoading={pdfLoading}
                  isDisabled={pdfLoading}
                >
                  {pdfLoading ? "Generazione..." : "Genera PDF"}
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    onClose();
                    navigate(`/edit-visit/${selectedVisit.id}`);
                  }}
                >
                  Modifica Visita
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ── Edit Patient Modal ── */}
      <Modal
        isOpen={isEditOpen}
        onClose={onEditClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-warning-100">
              <UserIcon size={20} className="text-warning-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Modifica Paziente</h2>
              <p className="text-sm text-gray-500">
                Aggiorna i dati anagrafici
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            {successMsg && (
              <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg text-sm font-medium">
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nome"
                value={editData.nome || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, nome: v }))
                }
                variant="bordered"
                isRequired
              />
              <Input
                label="Cognome"
                value={editData.cognome || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, cognome: v }))
                }
                variant="bordered"
                isRequired
              />
              <Input
                label="Codice Fiscale"
                value={editData.codiceFiscale || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({
                    ...prev,
                    codiceFiscale: v.toUpperCase(),
                  }))
                }
                variant="bordered"
                isRequired
                maxLength={16}
              />
              <Input
                label="Data di Nascita"
                type="date"
                value={editData.dataNascita || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, dataNascita: v }))
                }
                variant="bordered"
                isRequired
              />
              <Input
                label="Luogo di Nascita"
                value={editData.luogoNascita || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, luogoNascita: v }))
                }
                variant="bordered"
              />
              <Select
                label="Sesso"
                selectedKeys={editData.sesso ? [editData.sesso] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as "M" | "F";
                  setEditData((prev) => ({ ...prev, sesso: val }));
                }}
                variant="bordered"
                isRequired
              >
                <SelectItem key="M">Maschio</SelectItem>
                <SelectItem key="F">Femmina</SelectItem>
              </Select>
            </div>

            <Divider className="my-2" />
            <p className="text-sm font-medium text-gray-500">
              Contatti (opzionali)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Indirizzo"
                value={editData.indirizzo || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, indirizzo: v }))
                }
                variant="bordered"
              />
              <Input
                label="Telefono"
                type="tel"
                value={editData.telefono || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, telefono: v }))
                }
                variant="bordered"
              />
              <Input
                label="Email"
                type="email"
                value={editData.email || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, email: v }))
                }
                variant="bordered"
                className="md:col-span-2"
              />
            </div>

            <Divider className="my-2" />
            <p className="text-sm font-medium text-gray-500">Dati clinici</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Gruppo sanguigno"
                placeholder="Seleziona"
                selectedKeys={
                  editData.gruppoSanguigno ? [editData.gruppoSanguigno] : []
                }
                onSelectionChange={(keys) =>
                  setEditData((prev) => ({
                    ...prev,
                    gruppoSanguigno: (Array.from(keys)[0] as string) || "",
                  }))
                }
                variant="bordered"
              >
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "Non noto"].map(
                  (g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  )
                )}
              </Select>
              <Input
                label="Altezza (cm)"
                type="number"
                min={0}
                value={
                  editData.altezza != null ? String(editData.altezza) : ""
                }
                onValueChange={(v) =>
                  setEditData((prev) => ({
                    ...prev,
                    altezza: v === "" ? undefined : parseFloat(v) || undefined,
                  }))
                }
                variant="bordered"
                placeholder="0"
              />
            </div>
            <div className="mt-2">
              <Textarea
                label="Allergie / Intolleranze"
                placeholder="Elenca eventuali allergie a farmaci, alimenti, ecc."
                value={editData.allergie || ""}
                onValueChange={(v) =>
                  setEditData((prev) => ({ ...prev, allergie: v }))
                }
                variant="bordered"
                minRows={2}
              />
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-between items-center">
            <Button
              color="danger"
              variant="light"
              isIconOnly
              onPress={() => {
                onEditClose();
                handleDeletePatient();
              }}
              isLoading={deletingPatient}
              isDisabled={deletingPatient}
              aria-label="Elimina Paziente"
              title="Elimina Paziente"
            >
              <Trash2Icon size={20} />
            </Button>
            <div className="flex gap-2">
              <Button color="default" variant="light" onPress={onEditClose}>
                Annulla
              </Button>
              <Button
                color="success"
                onPress={handleSavePatient}
                isLoading={saving}
                startContent={!saving ? <SaveIcon size={16} /> : undefined}
              >
                Salva Modifiche
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Anteprima esame = PDF in iframe (come Anteprima Referto) */}
      <Modal
        isOpen={isEsamePreviewOpen}
        onClose={() => {
          onEsamePreviewClose();
          setSelectedRichiestaEsamePreview(null);
          setEsamePreviewFullscreen(false);
        }}
        size={esamePreviewFullscreen ? "full" : "5xl"}
        scrollBehavior="inside"
        classNames={
          esamePreviewFullscreen
            ? { base: "m-0 max-w-[100vw] max-h-[100vh] h-[100vh] rounded-none" }
            : undefined
        }
      >
        <ModalContent className={esamePreviewFullscreen ? "flex flex-col max-h-[100vh] h-[100vh]" : undefined}>
          {selectedRichiestaEsamePreview && patient && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={22} className="text-secondary-600" />
                    <h2 className="text-xl font-bold">Anteprima esame</h2>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className={esamePreviewFullscreen ? "flex-1 flex flex-col min-h-0 overflow-hidden" : undefined}>
                {esamePreviewPdfLoading ? (
                  <div className="flex justify-center items-center min-h-[60vh]">
                    <Spinner size="lg" color="primary" label="Generazione anteprima PDF..." />
                  </div>
                ) : esamePreviewPdfBlobUrl ? (
                  <div className={esamePreviewFullscreen ? "flex-1 min-h-0 flex flex-col rounded-lg p-2 bg-[#e5e5e5]" : "bg-[#e5e5e5] rounded-lg p-2 flex flex-col min-h-[70vh]"}>
                    <iframe
                      src={esamePreviewPdfBlobUrl}
                      title="Anteprima esame"
                      className={esamePreviewFullscreen ? "flex-1 w-full min-h-0 rounded border border-gray-300 bg-white" : "flex-1 w-full min-h-[70vh] rounded border border-gray-300 bg-white"}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center items-center min-h-[60vh] text-default-500">
                    Anteprima non disponibile.
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-default-200 gap-2 flex-wrap">
                <Button color="danger" variant="light" className="mr-auto" startContent={<Trash2Icon size={18} />} onPress={async () => { if (!selectedRichiestaEsamePreview) return; const deleted = await handleDeleteRichiestaEsame(selectedRichiestaEsamePreview.id); if (deleted) { onEsamePreviewClose(); setSelectedRichiestaEsamePreview(null); } }} aria-label="Elimina richiesta esame" title="Elimina richiesta esame">Elimina</Button>
                <Button variant="light" startContent={esamePreviewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} onPress={() => setEsamePreviewFullscreen(!esamePreviewFullscreen)}>{esamePreviewFullscreen ? "Riduci" : "Espandi"}</Button>
                <Button color="secondary" variant="flat" startContent={<Printer size={18} />} onPress={() => selectedRichiestaEsamePreview && handlePrintRichiestaEsame(selectedRichiestaEsamePreview)} isLoading={pdfLoading}>Stampa PDF</Button>
                <Button color="primary" startContent={<EditIcon size={18} />} onPress={handleFromPreviewToEdit}>Modifica</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal Anteprima certificato = PDF in iframe (come Anteprima Referto) */}
      <Modal
        isOpen={isCertificatoPreviewOpen}
        onClose={() => {
          handleCloseCertificatoPreview();
          setCertificatoPreviewFullscreen(false);
        }}
        size={certificatoPreviewFullscreen ? "full" : "5xl"}
        scrollBehavior="inside"
        classNames={certificatoPreviewFullscreen ? { base: "m-0 max-w-[100vw] max-h-[100vh] h-[100vh] rounded-none" } : undefined}
      >
        <ModalContent className={certificatoPreviewFullscreen ? "flex flex-col max-h-[100vh] h-[100vh]" : undefined}>
          {selectedCertificatoPreview && patient && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Award size={22} className="text-warning-600" />
                    <h2 className="text-xl font-bold">Anteprima certificato</h2>
                  </div>
                  <Chip size="sm" variant="flat" color="warning">{getCertificatoTipoLabel(selectedCertificatoPreview.tipo)}</Chip>
                </div>
              </ModalHeader>
              <ModalBody className={certificatoPreviewFullscreen ? "flex-1 flex flex-col min-h-0 overflow-hidden" : undefined}>
                {certificatoPreviewPdfLoading ? (
                  <div className="flex justify-center items-center min-h-[60vh]">
                    <Spinner size="lg" color="primary" label="Generazione anteprima PDF..." />
                  </div>
                ) : certificatoPreviewPdfBlobUrl ? (
                  <div className={certificatoPreviewFullscreen ? "flex-1 min-h-0 flex flex-col rounded-lg p-2 bg-[#e5e5e5]" : "bg-[#e5e5e5] rounded-lg p-2 flex flex-col min-h-[70vh]"}>
                    <iframe src={certificatoPreviewPdfBlobUrl} title="Anteprima certificato" className={certificatoPreviewFullscreen ? "flex-1 w-full min-h-0 rounded border border-gray-300 bg-white" : "flex-1 w-full min-h-[70vh] rounded border border-gray-300 bg-white"} />
                  </div>
                ) : (
                  <div className="flex justify-center items-center min-h-[60vh] text-default-500">Anteprima non disponibile.</div>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-default-200 gap-2 flex-wrap">
                <Button color="danger" variant="light" className="mr-auto" startContent={<Trash2Icon size={18} />} onPress={async () => { if (!selectedCertificatoPreview) return; if (!confirm("Eliminare questo certificato?")) return; await CertificatoService.delete(selectedCertificatoPreview.id); const list = await CertificatoService.getByPatientId(patient.id); setCertificati(list); handleCloseCertificatoPreview(); showToast("Certificato eliminato."); }} aria-label="Elimina certificato">Elimina</Button>
                <Button variant="light" startContent={certificatoPreviewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} onPress={() => setCertificatoPreviewFullscreen(!certificatoPreviewFullscreen)}>{certificatoPreviewFullscreen ? "Riduci" : "Espandi"}</Button>
                <Button color="warning" variant="flat" startContent={<Printer size={18} />} onPress={() => selectedCertificatoPreview && handlePrintCertificato(selectedCertificatoPreview)} isLoading={pdfLoading}>Stampa PDF</Button>
                <Button color="primary" startContent={<EditIcon size={18} />} onPress={handleFromCertificatoPreviewToEdit}>Modifica</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal Creazione/Modifica Richiesta Esame */}
      <Modal isOpen={isEsameOpen} onClose={handleCloseEsameModal} size="2xl">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 pb-2">
            <FlaskConical size={22} className="text-secondary-600" />
            <span className="text-lg">
              {editingRichiestaEsame
                ? "Modifica richiesta esame"
                : "Nuova richiesta esame"}
            </span>
          </ModalHeader>
          <ModalBody className="gap-5 pb-6">
            <div className="flex flex-col gap-4">
              {/* Selezione Modello */}
              <div className="flex justify-end">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<ClipboardList size={16} />}
                    >
                      Modelli Esame
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Modelli Esame"
                    onAction={(key) => {
                      const t = examTemplates.find((x) => x.id === key);
                      if (t) {
                        setNuovaRichiestaNome(t.text);
                        setNuovaRichiestaNote(t.note || "");
                        setModelloEsameSelezionato(t.id);
                      }
                    }}
                    className="max-h-[300px] overflow-y-auto"
                  >
                    {examTemplates.map((t) => (
                      <DropdownItem
                        key={t.id}
                        description={
                          t.note
                            ? t.note.length > 50
                              ? t.note.substring(0, 50) + "..."
                              : t.note
                            : ""
                        }
                      >
                        {t.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>

              <Input
                label="Esame richiesto"
                placeholder="Es. Emocromo, Eco Addome..."
                value={nuovaRichiestaNome}
                onValueChange={setNuovaRichiestaNome}
                variant="bordered"
              />

              <Textarea
                label="Note cliniche / Quesito diagnostico"
                placeholder="Es. Controllo post-operatorio, sospetta appendicite..."
                value={nuovaRichiestaNote}
                onValueChange={setNuovaRichiestaNote}
                variant="bordered"
                minRows={3}
              />

              <Input
                type="date"
                label="Data richiesta"
                value={nuovaRichiestaData}
                onValueChange={setNuovaRichiestaData}
                variant="bordered"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            {editingRichiestaEsame ? (
              <Button
                color="danger"
                variant="light"
                isIconOnly
                onPress={() =>
                  handleDeleteRichiestaEsame(editingRichiestaEsame.id)
                }
                aria-label="Elimina richiesta"
                title="Elimina richiesta"
              >
                <Trash2Icon size={20} />
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1"></div>
            <Button variant="light" onPress={handleCloseEsameModal}>
              Annulla
            </Button>
            <Button
              color="secondary"
              onPress={handleSaveRichiestaEsame}
              isDisabled={!nuovaRichiestaNome.trim()}
              isLoading={savingEsame}
              startContent={
                editingRichiestaEsame ? (
                  <SaveIcon size={18} />
                ) : (
                  <PlusIcon size={18} />
                )
              }
            >
              {editingRichiestaEsame ? "Salva Modifiche" : "Crea Richiesta"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Nuovo/Modifica Certificato */}
      <Modal isOpen={isCertificatoOpen} onClose={handleCloseCertificatoModal} size="2xl">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 pb-2">
            <Award size={22} className="text-warning-600" />
            <span className="text-lg">
              {editingCertificato ? "Modifica certificato" : "Nuovo certificato"}
            </span>
          </ModalHeader>
          <ModalBody className="gap-5 pb-6">
            {certTemplates.length > 0 && (
              <div className="flex justify-end">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      startContent={<ClipboardList size={16} />}
                    >
                      Modelli Certificato
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Modelli Certificato"
                    onAction={(key) => {
                      const t = certTemplates.find((x) => x.id === key);
                      if (t) {
                        setCertDescrizione(t.text);
                        setCertTipo(getCertificatoTipoFromTemplate(t));
                      }
                    }}
                    className="max-h-[300px] overflow-y-auto"
                  >
                    {certTemplates.map((t) => (
                      <DropdownItem
                        key={t.id}
                        description={t.note ? (t.note.length > 50 ? t.note.substring(0, 50) + "..." : t.note) : ""}
                      >
                        {t.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            )}
            <Select
              label="Tipo certificato"
              selectedKeys={[certTipo]}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as CertificatoPaziente["tipo"];
                if (k) setCertTipo(k);
              }}
              variant="bordered"
            >
              <SelectItem key="assenza_lavoro">Assenza da lavoro</SelectItem>
              <SelectItem key="idoneita">Idoneità</SelectItem>
              <SelectItem key="malattia">Malattia</SelectItem>
              <SelectItem key="altro">Altro</SelectItem>
            </Select>
            <Input
              type="date"
              label="Data certificato"
              value={certData}
              onValueChange={setCertData}
              variant="bordered"
            />
            <Textarea
              label="Descrizione / Testo del certificato"
              placeholder="Es. La sottoscritta attesta che la paziente è stata visitata in data odierna e necessita di riposo per..."
              value={certDescrizione}
              onValueChange={setCertDescrizione}
              variant="bordered"
              minRows={4}
            />
          </ModalBody>
          <ModalFooter>
            {editingCertificato ? (
              <Button
                color="danger"
                variant="light"
                startContent={<Trash2Icon size={18} />}
                onPress={() => handleDeleteCertificato(editingCertificato.id)}
              >
                Elimina
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            <Button variant="light" onPress={handleCloseCertificatoModal}>
              Annulla
            </Button>
            <Button
              color="warning"
              onPress={handleSaveCertificato}
              isDisabled={!certDescrizione.trim()}
              isLoading={savingCertificato}
              startContent={editingCertificato ? <SaveIcon size={18} /> : <PlusIcon size={18} />}
            >
              {editingCertificato ? "Salva modifiche" : "Salva certificato"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isIncludeImagesModalOpen}
        onClose={() => handleIncludeImagesChoice(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Includere immagini ecografia?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              Sono presenti{" "}
              <span className="font-semibold">{includeImagesCount}</span>{" "}
              immagini nella visita. Vuoi inserirle nel PDF di stampa?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => handleIncludeImagesChoice(false)}
            >
              No, genera senza immagini
            </Button>
            <Button
              color="primary"
              onPress={() => handleIncludeImagesChoice(true)}
            >
              Si, includi immagini
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isIncludeFetalGrowthChartModalOpen}
        onClose={() => {
          setPendingPrintVisit(null);
          setIsIncludeFetalGrowthChartModalOpen(false);
        }}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Includere grafico crescita fetale?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              Vuoi inserire nel PDF il grafico dei centili di crescita fetale
              (peso stimato vs epoca gestazionale)?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => handleIncludeFetalGrowthChartChoice(false)}
            >
              No, genera senza grafico
            </Button>
            <Button
              color="primary"
              onPress={() => handleIncludeFetalGrowthChartChoice(true)}
            >
              Sì, includi grafico
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
