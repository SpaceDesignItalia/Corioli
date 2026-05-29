import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Spinner,
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
} from "@nextui-org/react";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Eye,
  Printer,
  Maximize2,
  Minimize2,
  DownloadIcon,
  Trash2Icon,
  Stethoscope,
  Baby,
  ArrowRight,
} from "lucide-react";
import { SearchIcon } from "../../components/navbar/SearchIcon";
import { PatientService, VisitService, PreferenceService, DoctorService } from "../../services/OfflineServices";
import { PdfService } from "../../services/PdfService";
import { Visit, Patient, Doctor } from "../../types/Storage";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { useToast } from "../../contexts/ToastContext";
import { useCheckPatientModal } from "../../contexts/CheckPatientModalContext";
import { getFetalGrowthDataPointsFromVisits, getVisitsOfSamePregnancy } from "../../utils/fetalGrowthChartUtils";

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

interface EnrichedVisit extends Visit {
  patientName: string;
  patientCf: string;
}

const VISIT_TYPE_FILTERS = new Set([
  "generale",
  "ginecologica",
  "ginecologica_pediatrica",
  "ostetrica",
]);

const getVisitTypeLabel = (tipo?: Visit["tipo"]) => {
  if (tipo === "ginecologica") return "Ginecologica";
  if (tipo === "ginecologica_pediatrica") return "Ginec. pediatrica";
  if (tipo === "ostetrica") return "Ostetrica";
  return "Generale";
};

const getVisitTypeColor = (
  tipo?: Visit["tipo"],
): "danger" | "warning" | "primary" => {
  if (tipo === "ginecologica" || tipo === "ginecologica_pediatrica")
    return "danger";
  if (tipo === "ostetrica") return "warning";
  return "primary";
};

const getVisitTypeIconClass = (tipo?: Visit["tipo"]) => {
  if (tipo === "ginecologica" || tipo === "ginecologica_pediatrica")
    return "bg-danger-50 text-danger-700";
  if (tipo === "ostetrica") return "bg-warning-50 text-warning-700";
  return "bg-default-100 text-default-700";
};

const getVisitDescription = (visit: EnrichedVisit): string => {
  if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") {
    return (
      visit.ginecologia?.prestazione ||
      visit.ginecologia?.problemaClinico ||
      visit.descrizioneClinica ||
      "Nessuna descrizione"
    );
  }
  if (visit.tipo === "ostetrica") {
    return (
      visit.ostetricia?.prestazione ||
      visit.ostetricia?.problemaClinico ||
      visit.descrizioneClinica ||
      "Nessuna descrizione"
    );
  }
  return visit.descrizioneClinica || visit.anamnesi || "Nessuna descrizione";
};

const getPatientInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

export default function Visite() {
  const navigate = useNavigate();
  const { openCheckPatientModal } = useCheckPatientModal();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<EnrichedVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<EnrichedVisit | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("tutti");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const tipo = searchParams.get("tipo");
    if (tipo && VISIT_TYPE_FILTERS.has(tipo)) {
      setFilterTipo(tipo);
    }
  }, [searchParams]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [fetalFormula, setFetalFormula] = useState("hadlock4");
  const rowsPerPage = 10;
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [patientForPreview, setPatientForPreview] = useState<Patient | null>(null);
  const [doctorForPreview, setDoctorForPreview] = useState<Doctor | null>(null);
  const [showDoctorPhoneInPdf, setShowDoctorPhoneInPdf] = useState(true);
  const [showDoctorEmailInPdf, setShowDoctorEmailInPdf] = useState(true);
  const [isIncludeImagesModalOpen, setIsIncludeImagesModalOpen] = useState(false);
  const [includeImagesCount, setIncludeImagesCount] = useState(0);
  const [isIncludeFetalGrowthChartModalOpen, setIsIncludeFetalGrowthChartModalOpen] = useState(false);
  const [pendingPrintIncludeImages, setPendingPrintIncludeImages] = useState(false);
  const [pendingPrintVisit, setPendingPrintVisit] = useState<Visit | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    PreferenceService.getPreferences()
      .then((prefs) => {
        if (prefs?.formulaPesoFetale) setFetalFormula(prefs.formulaPesoFetale as string);
        if (typeof prefs?.showDoctorPhoneInPdf === "boolean") setShowDoctorPhoneInPdf(prefs.showDoctorPhoneInPdf as boolean);
        if (typeof prefs?.showDoctorEmailInPdf === "boolean") setShowDoctorEmailInPdf(prefs.showDoctorEmailInPdf as boolean);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedVisit) {
      setPatientForPreview(null);
      setDoctorForPreview(null);
      setPreviewFullscreen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [patient, doctor] = await Promise.all([
          PatientService.getPatientById(selectedVisit.patientId),
          DoctorService.getDoctor(),
        ]);
        if (!cancelled) {
          setPatientForPreview(patient ?? null);
          setDoctorForPreview(doctor ?? null);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setPatientForPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, selectedVisit?.id]);

  useEffect(() => {
    const isGyn = selectedVisit?.tipo === "ginecologica" || selectedVisit?.tipo === "ginecologica_pediatrica";
    const isObs = selectedVisit?.tipo === "ostetrica";
    if (!isOpen || !selectedVisit || !patientForPreview || (!isGyn && !isObs)) {
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
        const fetalGrowthDataPoints =
          selectedVisit.tipo === "ostetrica"
            ? (() => {
                const fino = visits.filter(
                  (v) =>
                    v.patientId === selectedVisit.patientId &&
                    v.tipo === "ostetrica" &&
                    new Date(v.dataVisita).getTime() <= new Date(selectedVisit.dataVisita).getTime(),
                );
                const stessaGravidanza = getVisitsOfSamePregnancy(fino, selectedVisit);
                return getFetalGrowthDataPointsFromVisits(stessaGravidanza, fetalFormula);
              })()
            : undefined;
        const blob = isGyn
          ? await PdfService.generateGynecologicalPDF(patientForPreview, selectedVisit, { includeEcografiaImages: true })
          : await PdfService.generateObstetricPDF(patientForPreview, selectedVisit, {
              includeEcografiaImages: true,
              includeFetalGrowthChart: true,
              fetalGrowthDataPoints,
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
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewPdfLoading(false);
    };
  }, [isOpen, selectedVisit?.id, patientForPreview?.id, visits, fetalFormula]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allVisits, allPatients] = await Promise.all([
          VisitService.getAllVisits(),
          PatientService.getAllPatients(),
        ]);

        const patientMap = new Map(allPatients.map((p) => [p.id, p]));

        const enriched = allVisits.map((v) => {
          const p = patientMap.get(v.patientId);
          return {
            ...v,
            patientName: p ? `${p.nome} ${p.cognome}` : "Paziente Sconosciuto",
            patientCf: p?.codiceFiscale || ""
          };
        });

        // Sort by date desc
        enriched.sort((a, b) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime());

        setVisits(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredVisits = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let list = visits.filter(v =>
      v.patientName.toLowerCase().includes(term) ||
      v.patientCf.toLowerCase().includes(term) ||
      v.descrizioneClinica?.toLowerCase().includes(term) ||
      v.dataVisita.includes(term)
    );
    if (filterTipo !== "tutti") {
      list = list.filter(v => v.tipo === filterTipo);
    }
    if (filterDateFrom) {
      list = list.filter(v => v.dataVisita >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter(v => v.dataVisita <= filterDateTo);
    }
    return list;
  }, [visits, searchTerm, filterTipo, filterDateFrom, filterDateTo]);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredVisits.slice(start, end);
  }, [page, filteredVisits]);

  const totalPages = Math.ceil(filteredVisits.length / rowsPerPage);

  const openPreview = (visit: EnrichedVisit) => {
    setSelectedVisit(visit);
    onOpen();
  };

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

  const getPreviewAnamnesi = (visit: Visit) => {
    if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") return visit.ginecologia?.prestazione || visit.anamnesi;
    if (visit.tipo === "ostetrica") return visit.ostetricia?.prestazione || visit.anamnesi;
    return visit.anamnesi;
  };
  const getPreviewDatiClinici = (visit: Visit) => {
    if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") return visit.ginecologia?.problemaClinico || visit.descrizioneClinica;
    if (visit.tipo === "ostetrica") return visit.ostetricia?.problemaClinico || visit.descrizioneClinica;
    return visit.descrizioneClinica;
  };
  const getPreviewEsameObiettivo = (visit: Visit) => {
    if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") return visit.ginecologia?.esameBimanuale || visit.esamiObiettivo;
    if (visit.tipo === "ostetrica") return visit.ostetricia?.esameObiettivo || visit.esamiObiettivo;
    return visit.esamiObiettivo;
  };
  const getPreviewConclusioni = (visit: Visit) => {
    if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") return visit.ginecologia?.terapiaSpecifica || visit.conclusioniDiagnostiche;
    if (visit.tipo === "ostetrica") return visit.ostetricia?.noteOstetriche || visit.conclusioniDiagnostiche;
    return visit.conclusioniDiagnostiche;
  };

  const runPrintPdf = async (
    visit: Visit,
    includeEcografiaImages: boolean,
    includeFetalGrowthChart?: boolean,
  ) => {
    if (!patientForPreview) return;
    let fetalGrowthDataPoints: { gaWeeks: number; pesoGrammi: number }[] | undefined;
    if (visit.tipo === "ostetrica" && includeFetalGrowthChart) {
      const fino = visits.filter(
        (v) => v.patientId === visit.patientId && v.tipo === "ostetrica" && new Date(v.dataVisita).getTime() <= new Date(visit.dataVisita).getTime(),
      );
      const stessaGravidanza = getVisitsOfSamePregnancy(fino, visit);
      fetalGrowthDataPoints = getFetalGrowthDataPointsFromVisits(stessaGravidanza, fetalFormula);
    } else {
      fetalGrowthDataPoints = undefined;
    }
    setPdfLoading(true);
    try {
      const blob = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
        ? await PdfService.generateGynecologicalPDF(patientForPreview, visit, { includeEcografiaImages })
        : await PdfService.generateObstetricPDF(patientForPreview, visit, {
            includeEcografiaImages,
            includeFetalGrowthChart: includeFetalGrowthChart ?? false,
            fetalGrowthDataPoints,
          });
      if (!blob) {
        showToast("Impossibile generare il PDF per la stampa.", "error");
        return;
      }
      const electronAPI = (window as unknown as { electronAPI?: { openPdfForPrint: (b64: string) => Promise<unknown> } }).electronAPI;
      if (electronAPI?.openPdfForPrint) {
        const base64 = await blobToBase64(blob);
        await electronAPI.openPdfForPrint(base64);
        showToast("PDF aperto nell'app predefinita. Usa Stampa da lì.");
      } else {
        const pdfUrl = URL.createObjectURL(blob);
        const w = window.open(pdfUrl, "_blank");
        if (w) setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
        else {
          const filename = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
            ? `Ginecologia_${patientForPreview.cognome}_${visit.dataVisita}.pdf`
            : `Ostetricia_${patientForPreview.cognome}_${visit.dataVisita}.pdf`;
          const a = document.createElement("a");
          a.href = pdfUrl;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(pdfUrl);
          showToast("PDF scaricato. Apri il file per visualizzarlo e stampare.");
        }
      }
    } catch (err) {
      console.error("Errore stampa PDF:", err);
      showToast("Errore durante la stampa del PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintPdf = async (visit: Visit) => {
    if (!patientForPreview) return;
    if (visit.tipo !== "ginecologica" && visit.tipo !== "ginecologica_pediatrica" && visit.tipo !== "ostetrica") {
      showToast("Stampa disponibile solo per visite ginecologiche e ostetriche.", "info");
      return;
    }
    const imageCount = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
      ? (visit.ginecologia?.ecografiaImmagini?.length ?? 0)
      : (visit.ostetricia?.ecografiaImmagini?.length ?? 0);
    if (imageCount > 0) {
      setIncludeImagesCount(imageCount);
      setPendingPrintVisit(visit);
      setIsIncludeImagesModalOpen(true);
      return;
    }
    if (visit.tipo === "ostetrica") {
      setPendingPrintVisit(visit);
      setPendingPrintIncludeImages(false);
      setIsIncludeFetalGrowthChartModalOpen(true);
      return;
    }
    await runPrintPdf(visit, false);
  };

  const handleIncludeImagesChoice = (include: boolean) => {
    const visit = pendingPrintVisit;
    setIsIncludeImagesModalOpen(false);
    if (!visit) return;
    if (visit.tipo === "ostetrica") {
      setPendingPrintIncludeImages(include);
      setIsIncludeFetalGrowthChartModalOpen(true);
      return;
    }
    setPendingPrintVisit(null);
    runPrintPdf(visit, include);
  };

  const handleIncludeFetalGrowthChartChoice = async (include: boolean) => {
    const visit = pendingPrintVisit;
    setIsIncludeFetalGrowthChartModalOpen(false);
    setPendingPrintVisit(null);
    if (!visit) return;
    await runPrintPdf(visit, pendingPrintIncludeImages, include);
  };

  const handleGeneratePdfFromPreview = async (visit: Visit) => {
    if (!patientForPreview) return;
    setPdfLoading(true);
    try {
      let blob: Blob | null = null;
      let filename = "";
      if (visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica") {
        blob = await PdfService.generateGynecologicalPDF(patientForPreview, visit) ?? null;
        filename = `Ginecologia_${patientForPreview.cognome}_${visit.dataVisita}.pdf`;
        showToast("PDF ginecologico generato.");
      } else if (visit.tipo === "ostetrica") {
        blob = await PdfService.generateObstetricPDF(patientForPreview, visit) ?? null;
        filename = `Ostetricia_${patientForPreview.cognome}_${visit.dataVisita}.pdf`;
        showToast("PDF ostetrico generato.");
      } else {
        showToast("Generazione PDF disponibile solo per visite ginecologiche e ostetriche.", "info");
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

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa visita? Questa azione è irreversibile.")) return;
    try {
      setLoading(true);
      await VisitService.deleteVisit(visitId);
      const [allVisits, allPatients] = await Promise.all([VisitService.getAllVisits(), PatientService.getAllPatients()]);
      const patientMap = new Map(allPatients.map((p) => [p.id, p]));
      const enriched = allVisits.map((v) => {
        const p = patientMap.get(v.patientId);
        return { ...v, patientName: p ? `${p.nome} ${p.cognome}` : "Paziente Sconosciuto", patientCf: p?.codiceFiscale || "" };
      });
      enriched.sort((a, b) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime());
      setVisits(enriched);
      if (selectedVisit?.id === visitId) onClose();
      setSelectedVisit(null);
    } catch (error) {
      console.error("Errore nell'eliminazione visita:", error);
      showToast("Errore nell'eliminazione della visita.", "error");
    } finally {
      setLoading(false);
    }
  };

  const renderEcografiaImages = (images?: string[]) => {
    if (!images || images.length === 0) return null;
    return (
      <Card shadow="sm">
        <CardBody className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Immagini ecografia</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <a
                key={`ecografia-${index}`}
                href={image}
                target="_blank"
                rel="noreferrer"
                className="block border border-gray-200 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
              >
                <img
                  src={image}
                  alt={`Ecografia ${index + 1}`}
                  className="w-full h-28 object-cover"
                />
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const HeaderActions = (
    <Button
      variant="bordered"
      startContent={<Calendar size={18} />}
      onPress={openCheckPatientModal}
      className="font-medium flex-1 md:flex-none border-default-300 text-default-700 bg-white"
    >
      Nuova Visita
    </Button>
  );

  return (
    <div className="corioli-page space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Gestione Visite"
        subtitle="Cerca e gestisci le tue visite"
        icon={FileText}
        iconColor="primary"
        actions={HeaderActions}
      />

      <Card className="corioli-card">
        <CardHeader className="corioli-card-header flex justify-between items-center gap-2">
          <div className="dashboard-column-header-title min-w-0">
            <FileText className="text-blue-600 shrink-0" size={16} />
            <h3 className="text-base font-semibold text-gray-900 truncate">
              Storico visite
            </h3>
          </div>
          {totalPages > 1 && (
            <span
              className="text-xs shrink-0"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Pagina {page} di {totalPages}
            </span>
          )}
        </CardHeader>
        <CardBody className="p-4 gap-4">
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-end">
            <div className="min-w-0 w-full md:flex-[1_1_58%]">
              <Input
                isClearable
                placeholder="Cerca per nome, CF o descrizione..."
                startContent={
                  <SearchIcon size={20} className="text-default-400" />
                }
                value={searchTerm}
                onValueChange={(v) => {
                  setSearchTerm(v);
                  setPage(1);
                }}
                onClear={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                variant="bordered"
                classNames={{
                  base: "w-full max-w-full",
                  mainWrapper: "w-full",
                  input: "text-base",
                  inputWrapper:
                    "w-full max-w-full h-12 border-default-200 shadow-none",
                }}
              />
            </div>
            <Select
              className="w-full md:w-[10.5rem] md:shrink-0"
              label="Tipo visita"
              labelPlacement="outside"
              selectedKeys={filterTipo === "tutti" ? ["tutti"] : [filterTipo]}
              onSelectionChange={(keys) => {
                setFilterTipo(Array.from(keys)[0] as string);
                setPage(1);
              }}
              variant="bordered"
              classNames={{
                base: "w-full",
                trigger: "h-12 min-h-12",
              }}
            >
              <SelectItem key="tutti">Tutti</SelectItem>
              <SelectItem key="ginecologica">Ginecologica</SelectItem>
              <SelectItem key="ginecologica_pediatrica">
                Ginec. ped.
              </SelectItem>
              <SelectItem key="ostetrica">Ostetrica</SelectItem>
            </Select>
            <Input
              type="date"
              className="w-full md:w-[8.75rem] md:shrink-0"
              label="Da"
              labelPlacement="outside"
              value={filterDateFrom}
              onValueChange={(v) => {
                setFilterDateFrom(v);
                setPage(1);
              }}
              variant="bordered"
              classNames={{
                base: "w-full",
                inputWrapper: "h-12 min-h-12",
              }}
            />
            <Input
              type="date"
              className="w-full md:w-[8.75rem] md:shrink-0"
              label="A"
              labelPlacement="outside"
              value={filterDateTo}
              onValueChange={(v) => {
                setFilterDateTo(v);
                setPage(1);
              }}
              variant="bordered"
              classNames={{
                base: "w-full",
                inputWrapper: "h-12 min-h-12",
              }}
            />
          </div>

          {filteredVisits.length > 0 ? (
            <div className="rounded-lg border border-default-200 overflow-hidden divide-y divide-default-100">
              {items.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-default-50 transition-colors cursor-pointer group"
                  onClick={() => openPreview(visit)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-1.5 rounded-lg flex-shrink-0 ${getVisitTypeIconClass(visit.tipo)}`}
                    >
                      {visit.tipo === "ostetrica" ? (
                        <Baby size={14} />
                      ) : (
                        <Stethoscope size={14} />
                      )}
                    </div>
                    <Avatar
                      name={getPatientInitials(visit.patientName)}
                      size="sm"
                      color="default"
                      className="flex-shrink-0 transition-transform group-hover:scale-105"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-[var(--brand-cta)] transition-colors truncate text-sm">
                        {visit.patientName}
                      </p>
                      <p className="text-xs text-default-500 truncate flex items-center gap-1.5 flex-wrap mt-0.5">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={getVisitTypeColor(visit.tipo)}
                          className="text-xs h-5"
                        >
                          {getVisitTypeLabel(visit.tipo)}
                        </Chip>
                        <span className="text-default-300">·</span>
                        <span>
                          {new Date(visit.dataVisita).toLocaleDateString(
                            "it-IT",
                          )}
                        </span>
                      </p>
                      {visit.patientCf && (
                        <p className="text-xs text-default-400 font-mono truncate mt-0.5">
                          <CodiceFiscaleValue value={visit.patientCf} />
                        </p>
                      )}
                      <p className="text-xs text-default-400 truncate mt-1">
                        {getVisitDescription(visit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="opacity-70 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(visit);
                      }}
                      aria-label="Anteprima referto"
                    >
                      <Eye size={16} className="text-default-500" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="opacity-70 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/edit-visit/${visit.id}`);
                      }}
                      aria-label="Modifica visita"
                    >
                      <ChevronRight size={18} className="text-default-400" />
                    </Button>
                    <ArrowRight
                      size={14}
                      className="text-default-300 group-hover:text-[var(--brand-cta)] transition-colors hidden sm:block ml-0.5"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center gap-3">
              <FileText
                size={32}
                style={{ color: "var(--color-text-tertiary)" }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {searchTerm ||
                filterTipo !== "tutti" ||
                filterDateFrom ||
                filterDateTo
                  ? "Nessuna visita trovata"
                  : "Nessuna visita registrata"}
              </p>
              <p
                className="text-xs max-w-[320px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {searchTerm ||
                filterTipo !== "tutti" ||
                filterDateFrom ||
                filterDateTo
                  ? "Prova a modificare i filtri di ricerca."
                  : "Le visite effettuate appariranno qui. Avvia una nuova visita dal pulsante in alto."}
              </p>
              {!searchTerm &&
                filterTipo === "tutti" &&
                !filterDateFrom &&
                !filterDateTo && (
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={openCheckPatientModal}
                    startContent={<Calendar size={14} />}
                  >
                    Nuova visita
                  </Button>
                )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-default-100">
              <Button
                size="sm"
                variant="flat"
                isDisabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                startContent={<ChevronLeft size={16} />}
              >
                Precedente
              </Button>
              <span
                className="text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Pagina {page} di {totalPages}
              </span>
              <Button
                size="sm"
                variant="flat"
                isDisabled={page >= totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                endContent={<ChevronRight size={16} />}
              >
                Successiva
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={previewFullscreen ? "full" : "5xl"}
        scrollBehavior="inside"
        classNames={previewFullscreen ? { base: "m-0 max-w-[100vw] max-h-[100vh] rounded-none" } : undefined}
      >
        <ModalContent>
          {selectedVisit && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h2 className="text-xl font-bold">Anteprima Referto</h2>
                  </div>
                  <Chip
                    color={
                      selectedVisit.tipo === "ginecologica" || selectedVisit.tipo === "ginecologica_pediatrica"
                        ? "primary"
                        : selectedVisit.tipo === "ostetrica"
                          ? "primary"
                          : "default"
                    }
                    variant="flat"
                  >
                    {selectedVisit.tipo === "ginecologica_pediatrica" ? "Ginecologia Pediatrica" : selectedVisit.tipo === "ginecologica" ? "Ginecologia" : selectedVisit.tipo === "ostetrica" ? "Ostetricia" : "Generale"}
                  </Chip>
                </div>
              </ModalHeader>
              <ModalBody>
                {(selectedVisit.tipo === "ginecologica" || selectedVisit.tipo === "ginecologica_pediatrica" || selectedVisit.tipo === "ostetrica") &&
                  (previewPdfLoading ? (
                    <div className="flex justify-center items-center min-h-[60vh]">
                      <Spinner size="lg" color="primary" label="Generazione anteprima PDF..." />
                    </div>
                  ) : previewPdfBlobUrl ? (
                    <div className="bg-[#e5e5e5] rounded-lg p-2 flex flex-col min-h-[70vh]">
                      <iframe
                        src={previewPdfBlobUrl}
                        title="Anteprima referto"
                        className="flex-1 w-full min-h-[70vh] rounded border border-gray-300 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center items-center min-h-[60vh] text-default-500">
                      Anteprima non disponibile.
                    </div>
                  ))}
                {(selectedVisit.tipo !== "ginecologica" && selectedVisit.tipo !== "ginecologica_pediatrica" && selectedVisit.tipo !== "ostetrica") &&
                  (!patientForPreview ? (
                    <div className="flex justify-center items-center min-h-[60vh]">
                      <Spinner size="lg" color="primary" label="Caricamento..." />
                    </div>
                  ) : (
                  <div className="bg-[#e5e5e5] rounded-lg p-4">
                    <div className="mx-auto w-full max-w-[210mm] bg-white border border-gray-300 shadow-sm text-[#141414] font-sans">
                      <div className="text-center pt-4 pb-2">
                        <p className="text-base font-bold uppercase tracking-tight">
                          {doctorForPreview ? `Dott. ${doctorForPreview.nome} ${doctorForPreview.cognome}` : "Studio Medico"}
                        </p>
                        {doctorForPreview?.specializzazione && (
                          <p className="text-[11px] text-[#3c3c3c] uppercase mt-0.5">{doctorForPreview.specializzazione}</p>
                        )}
                        <div className="border-t border-gray-300 w-4/5 mx-auto my-2" />
                        <p className="text-lg font-bold">REFERTO VISITA</p>
                        <p className="text-[11px] text-[#3c3c3c] mt-0.5" />
                      </div>
                      <div className="border border-gray-300 mx-4 mt-2">
                        <div className="bg-[#f0f0f0] px-2 py-1.5 flex justify-between items-center text-[10px] font-bold text-[#3c3c3c]">
                          <span>DATI DEL PAZIENTE</span>
                          <span>DATA VISITA: {formatPdfDate(selectedVisit.dataVisita)}</span>
                        </div>
                        <div className="px-2 py-2">
                          <p className="text-sm font-bold">
                            {patientForPreview.nome} {patientForPreview.cognome}
                          </p>
                          <p className="text-[11px] text-[#3c3c3c] mt-0.5">
                            Nato/a il: {formatPdfDate(patientForPreview.dataNascita)}
                            {calculateAge(patientForPreview.dataNascita) ? ` (${calculateAge(patientForPreview.dataNascita)} anni)` : ""}
                            {"   •   "}CF:{" "}
                            <CodiceFiscaleValue
                              value={patientForPreview.codiceFiscale}
                              placeholder="-"
                              generatedFromImport={Boolean(patientForPreview.codiceFiscaleGenerato)}
                            />
                            {"   •   "}Sesso: {patientForPreview.sesso === "M" ? "M" : patientForPreview.sesso === "F" ? "F" : "-"}
                          </p>
                        </div>
                      </div>
                      {[
                        { title: "ANAMNESI", content: getPreviewAnamnesi(selectedVisit) },
                        { title: "Dati Clinici", content: getPreviewDatiClinici(selectedVisit) },
                        { title: "ESAME OBIETTIVO", content: getPreviewEsameObiettivo(selectedVisit) },
                        { title: "Conclusioni e Terapia", content: getPreviewConclusioni(selectedVisit) },
                      ].map((sec, i) => (
                        <div key={i} className="mx-4 mt-3">
                          <div className="bg-[#f0f0f0] px-2 py-1 font-bold text-[10px] uppercase">{sec.title}</div>
                          <div className="px-2 py-1.5 text-[11px] whitespace-pre-wrap border-x border-b border-gray-300">
                            {sec.content?.trim() || "-"}
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-gray-300 mt-6 mx-4 pt-3 pb-4">
                        <p className="text-[10px] text-[#3c3c3c] text-center">
                          {(() => {
                            const parts: string[] = [];
                            if (doctorForPreview?.ambulatori && doctorForPreview.ambulatori.length > 0) {
                              const amb = doctorForPreview.ambulatori.find((a) => a.isPrimario) || doctorForPreview.ambulatori[0];
                              parts.push(amb.nome, `${amb.indirizzo}, ${amb.citta}`);
                            }
                            if (showDoctorPhoneInPdf && doctorForPreview?.telefono) parts.push(`Tel: ${doctorForPreview.telefono}`);
                            if (showDoctorEmailInPdf && doctorForPreview?.email) parts.push(doctorForPreview.email);
                            return parts.length ? parts.join("  •  ") : "—";
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                  ))}
              </ModalBody>
              <ModalFooter className="flex-wrap gap-2">
                <Button
                  color="danger"
                  variant="light"
                  startContent={<Trash2Icon size={16} />}
                  onPress={() => selectedVisit && handleDeleteVisit(selectedVisit.id)}
                  className="mr-auto"
                  aria-label="Elimina visita"
                  title="Elimina visita"
                >
                  Elimina visita
                </Button>
                <Button
                  color="default"
                  variant="flat"
                  startContent={previewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  onPress={() => setPreviewFullscreen(!previewFullscreen)}
                >
                  {previewFullscreen ? "Riduci" : "Espandi"}
                </Button>
                <Button
                  color="primary"
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

      <Modal isOpen={isIncludeImagesModalOpen} onClose={() => handleIncludeImagesChoice(false)} size="md">
        <ModalContent>
          <ModalHeader>Includere immagini ecografia?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              Sono presenti <span className="font-semibold">{includeImagesCount}</span> immagini nella visita. Vuoi inserirle nel PDF di stampa?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => handleIncludeImagesChoice(false)}>
              No, genera senza immagini
            </Button>
            <Button color="primary" onPress={() => handleIncludeImagesChoice(true)}>
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
            <Button variant="light" onPress={() => handleIncludeFetalGrowthChartChoice(false)}>
              No, genera senza grafico
            </Button>
            <Button color="primary" onPress={() => handleIncludeFetalGrowthChartChoice(true)}>
              Sì, includi grafico
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
