import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Input,
  Button,
  Chip,
  Spinner,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  useDisclosure,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { FileText, ChevronRight, Plus, Calendar, Eye, Printer, Maximize2, Minimize2, DownloadIcon, Trash2Icon } from "lucide-react";
import { PatientService, VisitService, PreferenceService, DoctorService } from "../../services/OfflineServices";
import { PdfService } from "../../services/PdfService";
import { Visit, Patient, Doctor } from "../../types/Storage";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { useToast } from "../../contexts/ToastContext";
import { calcolaStimePesoFetale } from "../../utils/fetalWeightUtils";

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

// Helper for search icon
const SearchIcon = (props: any) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path
      d="M22 22L20 20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

interface EnrichedVisit extends Visit {
  patientName: string;
  patientCf: string;
}

export default function Visite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<EnrichedVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<EnrichedVisit | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("tutti");
  const [page, setPage] = useState(1);
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
        const blob = isGyn
          ? await PdfService.generateGynecologicalPDF(patientForPreview, selectedVisit, { includeEcografiaImages: true })
          : await PdfService.generateObstetricPDF(patientForPreview, selectedVisit, { includeEcografiaImages: true });
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
  }, [isOpen, selectedVisit?.id, patientForPreview?.id]);

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

  const getVisitTypeLabel = (tipo?: Visit["tipo"]) => {
    if (tipo === "ginecologica") return "Ginecologia";
    if (tipo === "ginecologica_pediatrica") return "Ginecologia Pediatrica";
    if (tipo === "ostetrica") return "Ostetricia";
    return "Generale";
  };

  const formatDate = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("it-IT");
  };

  const formatMultiLine = (value?: string) => {
    if (!value || !value.trim()) return "Non compilato";
    return value;
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

  const runPrintPdf = async (visit: Visit, includeEcografiaImages: boolean) => {
    if (!patientForPreview) return;
    setPdfLoading(true);
    try {
      const blob = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica"
        ? await PdfService.generateGynecologicalPDF(patientForPreview, visit, { includeEcografiaImages })
        : await PdfService.generateObstetricPDF(patientForPreview, visit, { includeEcografiaImages });
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
    await runPrintPdf(visit, false);
  };

  const handleIncludeImagesChoice = async (include: boolean) => {
    const visit = pendingPrintVisit;
    setIsIncludeImagesModalOpen(false);
    setPendingPrintVisit(null);
    if (!visit) return;
    await runPrintPdf(visit, include);
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
      color="primary"
      startContent={<Plus size={18} />}
      onPress={() => navigate("/check-patient")}
      className="shadow-md shadow-primary/20"
    >
      Nuova Visita
    </Button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Gestione Visite"
        subtitle="Visualizza lo storico completo delle visite effettuate."
        icon={Calendar}
        iconColor="primary"
        actions={HeaderActions}
      />

      <Card className="shadow-sm">
        <CardBody className="p-4 gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <Input
              isClearable
              className="w-full sm:max-w-[280px]"
              placeholder="Cerca per nome, CF o data..."
              startContent={<SearchIcon className="text-default-300" />}
              value={searchTerm}
              onValueChange={setSearchTerm}
              onClear={() => setSearchTerm("")}
              variant="bordered"
            />
            <Select
              className="w-full sm:max-w-[180px]"
              label="Tipo visita"
              selectedKeys={filterTipo === "tutti" ? ["tutti"] : [filterTipo]}
              onSelectionChange={(keys) => setFilterTipo(Array.from(keys)[0] as string)}
              variant="bordered"
            >
              <SelectItem key="tutti">Tutti</SelectItem>
              <SelectItem key="ginecologica">Ginecologica</SelectItem>
              <SelectItem key="ginecologica_pediatrica">Ginecologica Pediatrica</SelectItem>
              <SelectItem key="ostetrica">Ostetrica</SelectItem>
            </Select>
            <Input
              type="date"
              className="w-full sm:max-w-[160px]"
              label="Da data"
              value={filterDateFrom}
              onValueChange={setFilterDateFrom}
              variant="bordered"
            />
            <Input
              type="date"
              className="w-full sm:max-w-[160px]"
              label="A data"
              value={filterDateTo}
              onValueChange={setFilterDateTo}
              variant="bordered"
            />
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-md">
        <CardBody className="p-0">
          {filteredVisits.length > 0 ? (
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">Paziente</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-4">Descrizione</div>
                <div className="col-span-1 text-right">Azioni</div>
              </div>

              {items.map((visit) => (
                <div
                  key={visit.id}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openPreview(visit)}
                >
                  <div className="col-span-3">
                    <p className="font-semibold text-gray-900 truncate">{visit.patientName}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{visit.patientCf}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">{new Date(visit.dataVisita).toLocaleDateString("it-IT")}</span>
                  </div>
                  <div className="col-span-2">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={(visit.tipo === 'ginecologica' || visit.tipo === 'ginecologica_pediatrica') ? 'secondary' : visit.tipo === 'ostetrica' ? 'warning' : 'primary'}
                      className="capitalize"
                    >
                      {visit.tipo}
                    </Chip>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm text-gray-500 truncate">{visit.descrizioneClinica || "Nessuna descrizione"}</p>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(visit);
                        }}
                        aria-label="Visualizza visita"
                      >
                        <Eye size={16} className="text-gray-500" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/edit-visit/${visit.id}`);
                        }}
                        aria-label="Modifica visita"
                      >
                      <ChevronRight size={18} className="text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nessuna visita trovata</p>
              <p className="text-sm mt-1">Prova a modificare i filtri di ricerca.</p>
            </div>
          )}
        </CardBody>

        {totalPages > 1 && (
          <div className="flex justify-center p-4 border-t border-gray-100">
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              color="primary"
              variant="light"
              showControls
            />
          </div>
        )}
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
                          ? "secondary"
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
    </div>
  );
}
