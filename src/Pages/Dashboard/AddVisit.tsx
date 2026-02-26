import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Textarea,
  Divider,
  Tabs,
  Tab,
  Switch,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip
} from "@nextui-org/react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { addDays, differenceInDays, parseISO, isValid } from "date-fns";
import { PatientService, VisitService, TemplateService } from "../../services/OfflineServices";
import { PdfService } from "../../services/PdfService";
import { Patient, Visit, MedicalTemplate } from "../../types/Storage";
import { calculateAge } from "../../utils/dateUtils";
import { calcolaStimePesoFetale, FORMULA_BIOMETRIA_FIELDS, BIOMETRIA_FIELD_LABELS } from "../../utils/fetalWeightUtils";
import { parseGestationalWeeks, getCentileForWeight, getCentileLabel } from "../../utils/fetalGrowthCentiles";
import { ArrowLeft, Printer, ClipboardList, AlertCircle, Save, User, ImagePlus, Trash2, Copy, X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { Breadcrumb } from "../../components/Breadcrumb";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";

/** Controlli anamnesi ginecologica */
function ginecologiaAnamnesiErrors(g: {
  gravidanze: number;
  parti: number;
  partiSpontanei?: number;
  partiCesarei?: number;
  aborti: number;
  abortiSpontanei?: number;
  ivg?: number;
}) {
  const parti = g.parti ?? 0;
  const gravidanze = g.gravidanze ?? 0;
  const ps = g.partiSpontanei ?? 0;
  const tc = g.partiCesarei ?? 0;
  const aborti = g.aborti ?? 0;
  const as = g.abortiSpontanei ?? 0;
  const ivg = g.ivg ?? 0;
  const errors: string[] = [];
  if (parti > gravidanze) errors.push("Parti > Gravidanze");
  if (parti + aborti > gravidanze) errors.push("P + A > G");
  if (ps + tc > parti && (ps > 0 || tc > 0)) errors.push("PS + TC > P");
  if (as + ivg > aborti && (as > 0 || ivg > 0)) errors.push("AS + IVG > Aborti");
  if (aborti < 0) errors.push("Aborti < 0");
  if (gravidanze < 0 || parti < 0 || as < 0 || ivg < 0) errors.push("Valori negativi");
  return errors;
}

/** Controlli anamnesi ostetrica */
function ostetriciaAnamnesiErrors(o: {
  gravidanzePrec: number;
  partiPrec: number;
  partiPrecSpontanei?: number;
  partiPrecCesarei?: number;
  abortiPrec: number;
  abortiPrecSpontanei?: number;
  ivgPrec?: number;
}) {
  const parti = o.partiPrec ?? 0;
  const gravidanze = o.gravidanzePrec ?? 0;
  const ps = o.partiPrecSpontanei ?? 0;
  const tc = o.partiPrecCesarei ?? 0;
  const aborti = o.abortiPrec ?? 0;
  const as = o.abortiPrecSpontanei ?? 0;
  const ivg = o.ivgPrec ?? 0;
  const errors: string[] = [];
  if (parti > gravidanze) errors.push("Parti Prec > Gravidanze Prec");
  if (parti + aborti > gravidanze) errors.push("P + A > G");
  if (ps + tc > parti && (ps > 0 || tc > 0)) errors.push("PS + TC > P");
  if (as + ivg > aborti && (as > 0 || ivg > 0)) errors.push("AS + IVG > Aborti");
  if (aborti < 0) errors.push("Aborti < 0");
  if (gravidanze < 0 || parti < 0 || as < 0 || ivg < 0) errors.push("Valori negativi");
  return errors;
}

// Helper Component for Templates
const TemplateSelector = ({ 
  templates, 
  onSelect,
  label = "Modello"
}: { 
  templates: MedicalTemplate[], 
  onSelect: (text: string) => void,
  label?: string
}) => {
  if (templates.length === 0) return null;
  
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button 
          size="sm" 
          variant="flat" 
          color="primary"
          startContent={<ClipboardList size={14} />}
          className="h-7 text-xs font-medium"
        >
          {label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu 
        aria-label="Medical Templates"
        onAction={(key) => {
          const selected = templates.find(t => t.id === key);
          if (selected) onSelect(selected.text);
        }}
      >
        {templates.map((t) => (
          <DropdownItem key={t.id} description={t.text.substring(0, 50) + "..."}>
            {t.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

const createDefaultVisitData = () => ({
  dataVisita: new Date().toISOString().slice(0, 10),
  tipo: "ginecologica",
  descrizioneClinica: "",
  anamnesi: "",
  esamiObiettivo: "",
  conclusioniDiagnostiche: "",
  terapie: ""
});

const createDefaultGinecologiaData = () => ({
  gravidanze: 0,
  parti: 0,
  partiSpontanei: 0,
  partiCesarei: 0,
  aborti: 0,
  abortiSpontanei: 0,
  ivg: 0,
  menarca: "",
  stadioTannerFemmina: "",
  ultimaMestruazione: "",
  prestazione: "",
  problemaClinico: "",
  chirurgiaPregessa: "",
  allergie: "",
  familiarita: "",
  terapiaInAtto: "",
  vaccinazioneHPV: true,
  esameBimanuale: "",
  speculum: "",
  ecografiaTV: "",
  accertamenti: "",
  conclusione: "",
  terapiaSpecifica: "",
  ecografiaImmagini: [] as string[]
});

const createDefaultOstetriciaData = () => ({
  settimaneGestazione: "",
  ultimaMestruazione: "",
  dataPresunta: "",
  problemaClinico: "",
  gravidanzePrec: 0,
  partiPrec: 0,
  partiPrecSpontanei: 0,
  partiPrecCesarei: 0,
  abortiPrec: 0,
  abortiPrecSpontanei: 0,
  ivgPrec: 0,
  pesoPreGravidanza: 0,
  pesoAttuale: 0,
  pressioneArteriosa: "",
  altezzaUterina: "",
  battitiFetali: "",
  movimentiFetali: "",
  esamiEseguiti: "",
  ecografiaOffice: "",
  noteOstetriche: "",
  prestazione: "",
  esameObiettivo: "",
  ecografiaImmagini: [] as string[],
  biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }
});

export default function AddVisit() {
  const [searchParams] = useSearchParams();
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [existingVisit, setExistingVisit] = useState<Visit | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isPediatricVisitEnabled, setIsPediatricVisitEnabled] = useState(false);
  const [fetalFormula, setFetalFormula] = useState("hadlock4");
  const [isIncludeImagesModalOpen, setIsIncludeImagesModalOpen] = useState(false);
  const [includeImagesCount, setIncludeImagesCount] = useState(0);
  const [copiedPreviousType, setCopiedPreviousType] = useState<"ginecologica" | "ginecologica_pediatrica" | "ostetrica" | null>(null);
  const includeImagesResolverRef = useRef<((value: boolean) => void) | null>(null);
  const initialLoadDone = useRef(false);
  
  // Templates state
  const [allTemplates, setAllTemplates] = useState<MedicalTemplate[]>([]);

  // Dati visita generale
  const [visitData, setVisitData] = useState(createDefaultVisitData);

  // Dati specifici ginecologia
  const [ginecologiaData, setGinecologiaData] = useState(createDefaultGinecologiaData);

  // Dati specifici ostetricia
  const [ostetriciaData, setOstetriciaData] = useState(createDefaultOstetriciaData);

  useEffect(() => {
    const loadData = async () => {
      // Reset completo quando cambia rotta/paziente per evitare valori "residui"
      initialLoadDone.current = false;
      setIsEditMode(false);
      setExistingVisit(null);
      setHasUnsavedChanges(false);
      setCopiedPreviousType(null);
      setError(null);
      setPatientVisits([]);
      setVisitData(createDefaultVisitData());
      setGinecologiaData(createDefaultGinecologiaData());
      setOstetriciaData(createDefaultOstetriciaData());

      try {
        const templates = await TemplateService.getAllTemplates();
        setAllTemplates(templates);
      } catch (e) {
        console.error("Errore caricamento template", e);
      }

      if (visitId) {
        setIsEditMode(true);
        try {
          const visit = await VisitService.getVisitById(visitId);
          if (visit) {
            setExistingVisit(visit);
            setVisitData({
              dataVisita: visit.dataVisita,
              tipo: visit.tipo || "ginecologica",
              descrizioneClinica: visit.descrizioneClinica,
              anamnesi: visit.anamnesi,
              esamiObiettivo: visit.esamiObiettivo,
              conclusioniDiagnostiche: visit.conclusioniDiagnostiche,
              terapie: visit.terapie
            });

            if (visit.ginecologia) {
              setGinecologiaData(prev => ({
                ...prev,
                ...visit.ginecologia,
                partiSpontanei: visit.ginecologia?.partiSpontanei ?? 0,
                partiCesarei: visit.ginecologia?.partiCesarei ?? 0,
                abortiSpontanei: visit.ginecologia?.abortiSpontanei ?? 0,
                ivg: visit.ginecologia?.ivg ?? 0
              }));
            }
            if (visit.ostetricia) {
              setOstetriciaData(prev => ({
                ...prev,
                ...visit.ostetricia,
                partiPrecSpontanei: visit.ostetricia?.partiPrecSpontanei ?? 0,
                partiPrecCesarei: visit.ostetricia?.partiPrecCesarei ?? 0,
                abortiPrecSpontanei: visit.ostetricia?.abortiPrecSpontanei ?? 0,
                ivgPrec: visit.ostetricia?.ivgPrec ?? 0,
                biometriaFetale: visit.ostetricia?.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }
              }));
            }
            const patientData = await PatientService.getPatientById(visit.patientId);
            setPatient(patientData);
            if (patientData) {
              const visitsData = await VisitService.getVisitsByPatientId(patientData.id);
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff = new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
              setPatientVisits(sortedVisits);
            }
          } else {
            setError("Visita non trovata");
          }
        } catch (error) {
          setError("Errore nel caricamento della visita");
        }
      } else {
        const patientId = searchParams.get("patientId");
        const patientCf = searchParams.get("patientCf");

        if (patientId) {
          try {
            const patientData = await PatientService.getPatientById(patientId);
            setPatient(patientData);
            if (patientData) {
              const visitsData = await VisitService.getVisitsByPatientId(patientData.id);
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff = new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
              setPatientVisits(sortedVisits);
            }
          } catch (error) {
            setError("Errore nel caricamento dati paziente");
          }
        } else if (patientCf) {
          try {
            const patientData = await PatientService.getPatientByCF(patientCf);
            setPatient(patientData);
            if (patientData) {
              const visitsData = await VisitService.getVisitsByPatientId(patientData.id);
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff = new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
              setPatientVisits(sortedVisits);
            }
          } catch (error) {
            setError("Errore nel caricamento dati paziente");
          }
        }
      }
      setTimeout(() => { initialLoadDone.current = true; }, 300);
    };
    loadData();
  }, [searchParams, visitId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const loadVisitPreferences = () => {
      const raw = localStorage.getItem("AppDottori_preferences");
      if (!raw) {
        setIsPediatricVisitEnabled(false);
        return;
      }
      try {
        const prefs = JSON.parse(raw);
        setIsPediatricVisitEnabled(Boolean(prefs?.visitaGinecologicaPediatricaEnabled));
        setFetalFormula(prefs?.formulaPesoFetale || "hadlock4");
      } catch {
        setIsPediatricVisitEnabled(false);
        setFetalFormula("hadlock4");
      }
    };

    loadVisitPreferences();
    window.addEventListener("storage", loadVisitPreferences);
    window.addEventListener("focus", loadVisitPreferences);
    return () => {
      window.removeEventListener("storage", loadVisitPreferences);
      window.removeEventListener("focus", loadVisitPreferences);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreenImage) {
        setFullscreenImage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenImage]);

  // Calcolo automatico gravidanza
  useEffect(() => {
    if (ostetriciaData.ultimaMestruazione && visitData.tipo === 'ostetrica') {
      const lmp = parseISO(ostetriciaData.ultimaMestruazione);
      if (isValid(lmp)) {
        const dpp = addDays(lmp, 280);
        const today = new Date();
        const diffDays = differenceInDays(today, lmp);
        const weeks = Math.floor(diffDays / 7);
        const days = diffDays % 7;
        
        setOstetriciaData(prev => ({
          ...prev,
          dataPresunta: dpp.toISOString().slice(0, 10),
          settimaneGestazione: `${weeks}+${days}`
        }));
      }
    }
  }, [ostetriciaData.ultimaMestruazione, visitData.tipo]);

  const handleTemplateSelect = (category: 'ginecologia' | 'ostetrica', field: string, text: string) => {
    if (category === 'ginecologia') {
      setGinecologiaData(prev => ({
        ...prev,
        [field]: prev[field as keyof typeof prev] ? `${prev[field as keyof typeof prev]}\n${text}` : text
      }));
    } else {
      setOstetriciaData(prev => ({
        ...prev,
        [field]: prev[field as keyof typeof prev] ? `${prev[field as keyof typeof prev]}\n${text}` : text
      }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent | { preventDefault: () => void }) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!patient) {
      setError("Nessun paziente selezionato");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const visitToSave = {
        patientId: patient.id,
        dataVisita: visitData.dataVisita,
        descrizioneClinica: visitData.descrizioneClinica,
        anamnesi: visitData.anamnesi,
        esamiObiettivo: visitData.esamiObiettivo,
        conclusioniDiagnostiche: visitData.conclusioniDiagnostiche,
        terapie: visitData.terapie,
        tipo: visitData.tipo as any,
        ginecologia: (visitData.tipo === 'ginecologica' || visitData.tipo === 'ginecologica_pediatrica') ? ginecologiaData : undefined,
        ostetricia: visitData.tipo === 'ostetrica' ? ostetriciaData : undefined
      };

      if (isEditMode && existingVisit) {
        await VisitService.updateVisit(existingVisit.id, visitToSave);
        setHasUnsavedChanges(false);
        showToast("Visita aggiornata con successo!");
      } else {
        await VisitService.addVisit(visitToSave);
        setHasUnsavedChanges(false);
        showToast("Visita salvata con successo!");
      }
      setTimeout(() => navigate(`/patient-history/${patient.id}`), 1000);
    } catch (error) {
      console.error("Errore nel salvataggio visita:", error);
      setError(isEditMode ? "Errore nell'aggiornamento della visita" : "Errore nel salvataggio della visita");
    } finally {
      setLoading(false);
    }
  };

  const getPreviousVisitByType = (tipo: "ginecologica" | "ginecologica_pediatrica" | "ostetrica") => {
    return patientVisits.find((v) => v.tipo === tipo && (!existingVisit || v.id !== existingVisit.id));
  };

  const handleCopyPreviousVisit = () => {
    const currentType = visitData.tipo as "ginecologica" | "ginecologica_pediatrica" | "ostetrica";
    if (currentType !== "ginecologica" && currentType !== "ginecologica_pediatrica" && currentType !== "ostetrica") {
      showToast("Copia disponibile solo per visite ginecologiche e ostetriche.", "info");
      return;
    }

    // Secondo click sullo stesso tipo: svuota i campi
    if (copiedPreviousType === currentType) {
      setVisitData((prev) => ({
        ...prev,
        descrizioneClinica: "",
        anamnesi: "",
        esamiObiettivo: "",
        conclusioniDiagnostiche: "",
        terapie: ""
      }));

      if (currentType === "ostetrica") {
        setOstetriciaData(createDefaultOstetriciaData());
      } else {
        setGinecologiaData(createDefaultGinecologiaData());
      }

      setCopiedPreviousType(null);
      setHasUnsavedChanges(true);
      showToast("Campi svuotati.");
      return;
    }

    const previousVisit = getPreviousVisitByType(currentType);
    if (!previousVisit) {
      showToast(`Nessuna visita ${currentType} precedente trovata per questo paziente.`, "info");
      return;
    }

    setVisitData((prev) => ({
      ...prev,
      descrizioneClinica: previousVisit.descrizioneClinica || "",
      anamnesi: previousVisit.anamnesi || "",
      esamiObiettivo: previousVisit.esamiObiettivo || "",
      conclusioniDiagnostiche: previousVisit.conclusioniDiagnostiche || "",
      terapie: previousVisit.terapie || ""
    }));

    if ((currentType === "ginecologica" || currentType === "ginecologica_pediatrica") && previousVisit.ginecologia) {
      setGinecologiaData((prev) => ({
        ...prev,
        ...previousVisit.ginecologia,
        partiSpontanei: previousVisit.ginecologia?.partiSpontanei ?? 0,
        partiCesarei: previousVisit.ginecologia?.partiCesarei ?? 0,
        abortiSpontanei: previousVisit.ginecologia?.abortiSpontanei ?? 0,
        ivg: previousVisit.ginecologia?.ivg ?? 0,
        ecografiaImmagini: previousVisit.ginecologia?.ecografiaImmagini ?? []
      }));
    }

    if (currentType === "ostetrica" && previousVisit.ostetricia) {
      setOstetriciaData((prev) => ({
        ...prev,
        ...previousVisit.ostetricia,
        partiPrecSpontanei: previousVisit.ostetricia?.partiPrecSpontanei ?? 0,
        partiPrecCesarei: previousVisit.ostetricia?.partiPrecCesarei ?? 0,
        abortiPrecSpontanei: previousVisit.ostetricia?.abortiPrecSpontanei ?? 0,
        ivgPrec: previousVisit.ostetricia?.ivgPrec ?? 0,
        ecografiaImmagini: previousVisit.ostetricia?.ecografiaImmagini ?? [],
        biometriaFetale: previousVisit.ostetricia?.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }
      }));
    }

    setHasUnsavedChanges(true);
    setCopiedPreviousType(currentType);
    showToast(`Campi copiati dall'ultima visita ${currentType}.`);
  };


  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        resolve((dataUrl && dataUrl.split(",")[1]) ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleEcografiaImagesUpload = async (tipo: "ginecologia" | "ostetricia", files: FileList | null) => {
    if (!files || files.length === 0) return;
    const maxImages = 8;
    const maxFileSize = 7 * 1024 * 1024; // 7MB per immagine

    const currentImages =
      tipo === "ginecologia"
        ? (ginecologiaData.ecografiaImmagini ?? [])
        : (ostetriciaData.ecografiaImmagini ?? []);

    if (currentImages.length >= maxImages) {
      showToast(`Hai già raggiunto il massimo di ${maxImages} immagini.`, "info");
      return;
    }

    try {
      const validFiles = Array.from(files).filter((file) => {
        if (!file.type.startsWith("image/")) return false;
        if (file.size > maxFileSize) {
          showToast(`File "${file.name}" troppo grande (max 7MB).`, "info");
          return false;
        }
        return true;
      });

      const availableSlots = Math.max(0, maxImages - currentImages.length);
      const filesToLoad = validFiles.slice(0, availableSlots);
      const encoded = await Promise.all(filesToLoad.map(fileToDataUrl));

      if (tipo === "ginecologia") {
        setGinecologiaData(prev => ({
          ...prev,
          ecografiaImmagini: [...(prev.ecografiaImmagini ?? []), ...encoded]
        }));
      } else {
        setOstetriciaData(prev => ({
          ...prev,
          ecografiaImmagini: [...(prev.ecografiaImmagini ?? []), ...encoded]
        }));
      }

      if (initialLoadDone.current) setHasUnsavedChanges(true);
      if (encoded.length > 0) showToast(`${encoded.length} immagine/i caricata/e.`);
    } catch (err) {
      console.error("Errore caricamento immagini ecografia:", err);
      showToast("Errore durante il caricamento delle immagini.", "error");
    }
  };

  const handleRemoveEcografiaImage = (tipo: "ginecologia" | "ostetricia", imageIndex: number) => {
    if (tipo === "ginecologia") {
      setGinecologiaData(prev => ({
        ...prev,
        ecografiaImmagini: (prev.ecografiaImmagini ?? []).filter((_, idx) => idx !== imageIndex)
      }));
    } else {
      setOstetriciaData(prev => ({
        ...prev,
        ecografiaImmagini: (prev.ecografiaImmagini ?? []).filter((_, idx) => idx !== imageIndex)
      }));
    }
    if (initialLoadDone.current) setHasUnsavedChanges(true);
  };

  const askIncludeEcografiaImages = (count: number): Promise<boolean> => {
    setIncludeImagesCount(count);
    setIsIncludeImagesModalOpen(true);
    return new Promise((resolve) => {
      includeImagesResolverRef.current = resolve;
    });
  };

  const resolveIncludeEcografiaImages = (include: boolean) => {
    setIsIncludeImagesModalOpen(false);
    includeImagesResolverRef.current?.(include);
    includeImagesResolverRef.current = null;
  };

  const handlePrintPdf = async () => {
    if (!patient) return;
    if (visitData.tipo !== "ginecologica" && visitData.tipo !== "ginecologica_pediatrica" && visitData.tipo !== "ostetrica") {
      showToast("Stampa disponibile solo per visite ginecologiche e ostetriche.", "info");
      return;
    }

    const currentVisit: Visit = {
      id: existingVisit?.id || "",
      patientId: patient.id,
      dataVisita: visitData.dataVisita,
      descrizioneClinica: visitData.descrizioneClinica,
      anamnesi: visitData.anamnesi,
      esamiObiettivo: visitData.esamiObiettivo,
      conclusioniDiagnostiche: visitData.conclusioniDiagnostiche,
      terapie: visitData.terapie,
      tipo: visitData.tipo as any,
      ginecologia: (visitData.tipo === "ginecologica" || visitData.tipo === "ginecologica_pediatrica") ? ginecologiaData : undefined,
      ostetricia: visitData.tipo === "ostetrica" ? ostetriciaData : undefined,
      createdAt: existingVisit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const imageCount =
      (visitData.tipo === "ginecologica" || visitData.tipo === "ginecologica_pediatrica")
        ? (currentVisit.ginecologia?.ecografiaImmagini?.length ?? 0)
        : (currentVisit.ostetricia?.ecografiaImmagini?.length ?? 0);

    let includeEcografiaImages = false;
    if (imageCount > 0) {
      includeEcografiaImages = await askIncludeEcografiaImages(imageCount);
    }

    setPdfLoading(true);
    try {
      const blob =
        (visitData.tipo === "ginecologica" || visitData.tipo === "ginecologica_pediatrica")
          ? await PdfService.generateGynecologicalPDF(patient, currentVisit, { includeEcografiaImages })
          : await PdfService.generateObstetricPDF(patient, currentVisit, { includeEcografiaImages });
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
        if (w) {
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
        } else {
          const filename =
            (visitData.tipo === "ginecologica" || visitData.tipo === "ginecologica_pediatrica")
              ? `Ginecologia_${patient.cognome}_${currentVisit.dataVisita}.pdf`
              : `Ostetricia_${patient.cognome}_${currentVisit.dataVisita}.pdf`;
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

  const handleInputChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    if (field === "tipo") {
      setCopiedPreviousType(null);
    }
    setVisitData(prev => ({ ...prev, [field]: value }));
  };

  const handleGinecologiaChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setGinecologiaData(prev => ({ ...prev, [field]: value }));
  };

  const handleOstetriciaChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setOstetriciaData(prev => ({ ...prev, [field]: value }));
  };

  const handleBiometriaFetaleChange = (field: "bpdMm" | "hcMm" | "acMm" | "flMm", value: number) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setOstetriciaData(prev => ({
      ...prev,
      biometriaFetale: {
        ...(prev.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }),
        [field]: value
      }
    }));
  };

  const scalePesoFetale = useMemo(() => {
    const b = ostetriciaData.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 };
    return calcolaStimePesoFetale(b);
  }, [ostetriciaData.biometriaFetale?.bpdMm, ostetriciaData.biometriaFetale?.hcMm, ostetriciaData.biometriaFetale?.acMm, ostetriciaData.biometriaFetale?.flMm]);

  const handleNavigateCronologia = () => {
    if (hasUnsavedChanges && !window.confirm("Modifiche non salvate. Uscire comunque?")) return;
    navigate(`/patient-history/${patient?.id}`);
  };

  if (!patient) {
    return (
      <Card className="max-w-2xl mx-auto mt-12 shadow-medium">
        <CardBody className="text-center py-12">
          <div className="w-20 h-20 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={40} className="text-default-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Nessun paziente selezionato
          </h2>
          <p className="text-gray-500 mb-6">
            Seleziona un paziente dalla dashboard per creare una nuova visita
          </p>
          <Button
            color="primary"
            onPress={() => navigate("/")}
            startContent={<ArrowLeft size={18} />}
          >
            Torna alla Dashboard
          </Button>
        </CardBody>
      </Card>
    );
  }

  const breadcrumbItems = [
    { label: "Dashboard", path: "/" },
    { label: "Pazienti", path: "/pazienti" },
    { label: `${patient.nome} ${patient.cognome}`, path: `/patient-history/${patient.id}` },
    { label: isEditMode ? "Modifica" : "Nuova visita" }
  ];

  const hasPreviousVisitForCurrentType =
    (visitData.tipo === "ginecologica" || visitData.tipo === "ginecologica_pediatrica" || visitData.tipo === "ostetrica")
      ? Boolean(getPreviousVisitByType(visitData.tipo as "ginecologica" | "ginecologica_pediatrica" | "ostetrica"))
      : false;
  const canCopyOrClear =
    hasPreviousVisitForCurrentType ||
    copiedPreviousType === visitData.tipo;

  const showPediatricTab = isPediatricVisitEnabled || visitData.tipo === "ginecologica_pediatrica";

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-32">
      {/* 1. Header Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      {/* 2. Patient Banner & Main Info */}
      <Card className="shadow-md border-t-4 border-primary">
        <CardBody className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {patient.nome[0]}{patient.cognome[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {patient.nome} {patient.cognome}
                {hasUnsavedChanges && <Chip size="sm" color="warning" variant="flat">Non salvato</Chip>}
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500"><CodiceFiscaleValue value={patient.codiceFiscale} generatedFromImport={Boolean(patient.codiceFiscaleGenerato)} /></span>
                {calculateAge(patient.dataNascita) && (
                  <>
                    <span className="hidden md:inline text-gray-300">|</span>
                    <span className="text-gray-500">{calculateAge(patient.dataNascita)} anni</span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Input
              type="date"
              label="Data Visita"
              value={visitData.dataVisita}
              onValueChange={(value) => handleInputChange("dataVisita", value)}
              variant="bordered"
              size="sm"
              labelPlacement="outside-left"
              className="w-full md:w-auto"
              classNames={{
                label: "text-gray-500 font-medium whitespace-nowrap pt-2",
                input: "bg-transparent",
                inputWrapper: "border-default-300 hover:border-primary focus-within:border-primary min-w-[140px]"
              }}
            />
          </div>
        </CardBody>
      </Card>

      {error && (
        <Card className="border-l-4 border-l-danger bg-danger-50">
          <CardBody className="py-3">
            <p className="text-danger text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </p>
          </CardBody>
        </Card>
      )}

      {/* 3. Main Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {!isEditMode && (
          <div className="flex justify-end">
            <Button
              color="primary"
              variant="flat"
              size="sm"
              onPress={handleCopyPreviousVisit}
              isDisabled={!canCopyOrClear}
              startContent={<Copy size={16} />}
            >
              {copiedPreviousType === visitData.tipo ? "Svuota campi" : "Copia visita precedente"}
            </Button>
          </div>
        )}

        <Tabs
          selectedKey={visitData.tipo}
          onSelectionChange={(key) => handleInputChange("tipo", key)}
          size="lg"
          color="primary"
          variant="underlined"
          classNames={{
            base: "w-full border-b border-divider",
            tabList: "gap-8 w-full relative rounded-none p-0",
            cursor: "w-full bg-primary h-[3px]",
            tab: "max-w-fit px-2 h-12 text-lg",
            tabContent: "group-data-[selected=true]:text-primary group-data-[selected=true]:font-bold text-gray-500 font-medium"
          }}
        >
          {/* TAB GINECOLOGIA */}
          <Tab key="ginecologica" title="Visita Ginecologica">
            <div className="flex flex-col lg:flex-row gap-6 mt-6">
              
              {/* LEFT COLUMN: Anamnesi & Dati Numerici */}
              <div className="w-full lg:w-[29%] min-w-[300px] space-y-6">
                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    <span>Anamnesi Ginecologica</span>
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-6">
                    {/* Errori validazione */}
                    {(() => {
                      const errs = ginecologiaAnamnesiErrors(ginecologiaData);
                      return errs.length > 0 ? (
                        <div className="p-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 text-xs mb-2">
                          <ul className="list-disc list-inside space-y-1">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>
                        </div>
                      ) : null;
                    })()}

                    {/* Ultima Mestruazione */}
                    <Input
                      type="date"
                      label="Ultima Mestruazione"
                      value={ginecologiaData.ultimaMestruazione}
                      onValueChange={(value) => handleGinecologiaChange("ultimaMestruazione", value)}
                      variant="bordered"
                      labelPlacement="outside"
                      placeholder="Seleziona data"
                    />

                    <Divider className="my-2" />

                    {/* GPA Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        type="number"
                        label="Gravidanze"
                        value={ginecologiaData.gravidanze.toString()}
                        onValueChange={(v) => handleGinecologiaChange("gravidanze", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        min={0}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                      <Input
                        type="number"
                        label="Parti"
                        value={ginecologiaData.parti.toString()}
                        onValueChange={(v) => handleGinecologiaChange("parti", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        min={0}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                      <Input
                        type="number"
                        label="Aborti"
                        value={ginecologiaData.aborti.toString()}
                        onValueChange={(v) => handleGinecologiaChange("aborti", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        min={0}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                    </div>
                    
                    {/* Dettagli */}
                    <div className="bg-gray-50/80 p-4 rounded-xl border border-dashed border-gray-300">
                      <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">Dettagli</p>
                      <div className="grid grid-cols-2 gap-4">
                         <Input
                          label="PS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ginecologiaData.partiSpontanei ?? 0)}
                          onValueChange={(v) => handleGinecologiaChange("partiSpontanei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                         <Input
                          label="TC"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ginecologiaData.partiCesarei ?? 0)}
                          onValueChange={(v) => handleGinecologiaChange("partiCesarei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="AS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ginecologiaData.abortiSpontanei ?? 0)}
                          onValueChange={(v) => handleGinecologiaChange("abortiSpontanei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="IVG"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ginecologiaData.ivg ?? 0)}
                          onValueChange={(v) => handleGinecologiaChange("ivg", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Foto Ecografia
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {(ginecologiaData.ecografiaImmagini ?? []).length}/8 immagini
                      </span>
                    </div>

                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-primary cursor-pointer text-sm">
                      <ImagePlus size={16} />
                      Carica immagini
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleEcografiaImagesUpload("ginecologia", e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {(ginecologiaData.ecografiaImmagini ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {(ginecologiaData.ecografiaImmagini ?? []).map((image, idx) => (
                          <div key={`gyn-eco-${idx}`} className="relative group border rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={image}
                              alt={`Ecografia ginecologica ${idx + 1}`}
                              className="w-full h-28 object-cover cursor-zoom-in"
                              onClick={() => setFullscreenImage(image)}
                              title="Clicca per ingrandire"
                            />
                            <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
                              Clicca per ingrandire
                            </span>
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveEcografiaImage("ginecologia", idx)}
                              aria-label="Rimuovi immagine ecografia"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* RIGHT COLUMN: Referto Testuale */}
              <div className="w-full lg:flex-1 space-y-6">
                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-6 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Referto Medico
                  </CardHeader>
                  <CardBody className="p-6 space-y-8">
                    {/* Sezione 1: Anamnesi */}
                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">1. Anamnesi</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => t.category === 'ginecologia' && t.section === 'prestazione')} 
                          onSelect={(t) => handleTemplateSelect('ginecologia', 'prestazione', t)} 
                        />
                      </div>
                      <Textarea
                        value={ginecologiaData.prestazione}
                        onValueChange={(value) => handleGinecologiaChange("prestazione", value)}
                        variant="bordered"
                        minRows={3}
                        placeholder="Nega patologie di rilievo, nega terapia in atto..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    {/* Sezione 2: Descrizione */}
                    <div className="space-y-2 group">
                      <label className="text-sm font-bold text-gray-700 block mb-1">2. Descrizione Problema / Dati Clinici</label>
                      <Textarea
                        value={ginecologiaData.problemaClinico}
                        onValueChange={(value) => handleGinecologiaChange("problemaClinico", value)}
                        variant="bordered"
                        minRows={3}
                        placeholder="La paziente riferisce..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    {/* Sezione 3: Esame Obiettivo */}
                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">3. Visita / Ecografia Office</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => t.category === 'ginecologia' && t.section === 'esameObiettivo')} 
                          onSelect={(t) => handleTemplateSelect('ginecologia', 'esameBimanuale', t)} 
                        />
                      </div>
                      <Textarea
                        value={ginecologiaData.esameBimanuale}
                        onValueChange={(value) => handleGinecologiaChange("esameBimanuale", value)}
                        variant="bordered"
                        minRows={5}
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    <div className="space-y-2 relative group">
                       <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">4. Conclusioni e Terapie</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => (t.category === 'ginecologia' && t.section === 'conclusioni') || t.category === 'terapie')} 
                          onSelect={(t) => handleTemplateSelect('ginecologia', 'terapiaSpecifica', t)} 
                        />
                      </div>
                      <Textarea
                        value={ginecologiaData.terapiaSpecifica}
                        onValueChange={(value) => handleGinecologiaChange("terapiaSpecifica", value)}
                        variant="bordered"
                        minRows={3}
                        placeholder="Si consiglia..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>

            </div>
          </Tab>

          {showPediatricTab && (
            <Tab key="ginecologica_pediatrica" title="Visita Ginecologica Pediatrica">
              <div className="flex flex-col lg:flex-row gap-6 mt-6">
                
                {/* LEFT COLUMN: Anamnesi & Dati Numerici */}
                <div className="w-full lg:w-[29%] min-w-[300px] space-y-6">
                  <Card className="shadow-sm border border-default-200 bg-white">
                    <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      <span>Anamnesi Ginecologica Pediatrica</span>
                    </CardHeader>
                    <CardBody className="px-4 py-6 space-y-6">
                      <Input
                        type="text"
                        label="Menarca"
                        value={ginecologiaData.menarca || ""}
                        onValueChange={(value) => handleGinecologiaChange("menarca", value)}
                        variant="bordered"
                        labelPlacement="outside"
                        placeholder="Eta o note (es. 12 anni)"
                      />

                      <Switch
                        isSelected={Boolean(ginecologiaData.vaccinazioneHPV)}
                        onValueChange={(checked) => handleGinecologiaChange("vaccinazioneHPV", checked)}
                      >
                        Vaccinazione HPV
                      </Switch>

                      <Select
                        label="Stadio di Tanner (femmina)"
                        selectedKeys={ginecologiaData.stadioTannerFemmina ? [ginecologiaData.stadioTannerFemmina] : []}
                        onSelectionChange={(keys) =>
                          handleGinecologiaChange("stadioTannerFemmina", String(Array.from(keys)[0] || ""))
                        }
                        variant="bordered"
                      >
                        <SelectItem key="I">I</SelectItem>
                        <SelectItem key="II">II</SelectItem>
                        <SelectItem key="III">III</SelectItem>
                        <SelectItem key="IV">IV</SelectItem>
                        <SelectItem key="V">V</SelectItem>
                      </Select>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm border border-default-200 bg-white">
                    <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Foto Ecografia
                    </CardHeader>
                    <CardBody className="px-4 py-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {(ginecologiaData.ecografiaImmagini ?? []).length}/8 immagini
                        </span>
                      </div>

                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-primary cursor-pointer text-sm">
                        <ImagePlus size={16} />
                        Carica immagini
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleEcografiaImagesUpload("ginecologia", e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      {(ginecologiaData.ecografiaImmagini ?? []).length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {(ginecologiaData.ecografiaImmagini ?? []).map((image, idx) => (
                            <div key={`gyn-ped-eco-${idx}`} className="relative group border rounded-lg overflow-hidden bg-gray-50">
                              <img
                                src={image}
                                alt={`Ecografia ginecologica pediatrica ${idx + 1}`}
                                className="w-full h-28 object-cover cursor-zoom-in"
                                onClick={() => setFullscreenImage(image)}
                                title="Clicca per ingrandire"
                              />
                              <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
                                Clicca per ingrandire
                              </span>
                              <button
                                type="button"
                                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveEcografiaImage("ginecologia", idx)}
                                aria-label="Rimuovi immagine ecografia"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>

                {/* RIGHT COLUMN: Referto Testuale */}
                <div className="w-full lg:flex-1 space-y-6">
                  <Card className="shadow-sm border border-default-200 bg-white">
                    <CardHeader className="pb-0 pt-4 px-6 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Referto Medico
                    </CardHeader>
                    <CardBody className="p-6 space-y-8">
                      {/* Sezione 1: Anamnesi */}
                      <div className="space-y-2 relative group">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-sm font-bold text-gray-700">1. Anamnesi</label>
                          <TemplateSelector 
                            templates={allTemplates.filter(t => t.category === 'ginecologia' && t.section === 'prestazione')} 
                            onSelect={(t) => handleTemplateSelect('ginecologia', 'prestazione', t)} 
                          />
                        </div>
                        <Textarea
                          value={ginecologiaData.prestazione}
                          onValueChange={(value) => handleGinecologiaChange("prestazione", value)}
                          variant="bordered"
                          minRows={3}
                          placeholder="Nega patologie di rilievo, nega terapia in atto..."
                          classNames={{ 
                            input: "text-base leading-relaxed",
                            inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                          }}
                        />
                      </div>

                      {/* Sezione 2: Descrizione */}
                      <div className="space-y-2 group">
                        <label className="text-sm font-bold text-gray-700 block mb-1">2. Descrizione Problema / Dati Clinici</label>
                        <Textarea
                          value={ginecologiaData.problemaClinico}
                          onValueChange={(value) => handleGinecologiaChange("problemaClinico", value)}
                          variant="bordered"
                          minRows={3}
                          placeholder="La paziente riferisce..."
                          classNames={{ 
                            input: "text-base leading-relaxed",
                            inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                          }}
                        />
                      </div>

                      {/* Sezione 3: Esame Obiettivo */}
                      <div className="space-y-2 relative group">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-sm font-bold text-gray-700">3. Visita / Ecografia Office</label>
                          <TemplateSelector 
                            templates={allTemplates.filter(t => t.category === 'ginecologia' && t.section === 'esameObiettivo')} 
                            onSelect={(t) => handleTemplateSelect('ginecologia', 'esameBimanuale', t)} 
                          />
                        </div>
                        <Textarea
                          value={ginecologiaData.esameBimanuale}
                          onValueChange={(value) => handleGinecologiaChange("esameBimanuale", value)}
                          variant="bordered"
                          minRows={5}
                          classNames={{ 
                            input: "text-base leading-relaxed",
                            inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                          }}
                        />
                      </div>

                      <div className="space-y-2 relative group">
                         <div className="flex justify-between items-end mb-1">
                          <label className="text-sm font-bold text-gray-700">4. Conclusioni e Terapie</label>
                          <TemplateSelector 
                            templates={allTemplates.filter(t => (t.category === 'ginecologia' && t.section === 'conclusioni') || t.category === 'terapie')} 
                            onSelect={(t) => handleTemplateSelect('ginecologia', 'terapiaSpecifica', t)} 
                          />
                        </div>
                        <Textarea
                          value={ginecologiaData.terapiaSpecifica}
                          onValueChange={(value) => handleGinecologiaChange("terapiaSpecifica", value)}
                          variant="bordered"
                          minRows={3}
                          placeholder="Si consiglia..."
                          classNames={{ 
                            input: "text-base leading-relaxed",
                            inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                          }}
                        />
                      </div>
                    </CardBody>
                  </Card>
                </div>

              </div>
            </Tab>
          )}

          {/* TAB OSTETRICIA */}
          <Tab key="ostetrica" title="Visita Ostetrica">
            <div className="flex flex-col lg:flex-row gap-6 mt-6">
              
              {/* LEFT COLUMN: Dati Gravidanza & Anamnesi */}
              <div className="w-full lg:w-[29%] min-w-[300px] space-y-6">
                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Dati Gravidanza Attuale
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-10">
                     <Input
                        type="text"
                        label="Settimane di Gestazione"
                        value={ostetriciaData.settimaneGestazione}
                        onValueChange={(value) => handleOstetriciaChange("settimaneGestazione", value)}
                        variant="bordered"
                        labelPlacement="outside"
                        placeholder="es. 22+3"
                        classNames={{ input: "text-base", label: "pb-1" }}
                      />
                      <Input
                        type="date"
                        label="Ultima Mestruazione"
                        value={ostetriciaData.ultimaMestruazione}
                        onValueChange={(value) => handleOstetriciaChange("ultimaMestruazione", value)}
                        variant="bordered"
                        labelPlacement="outside"
                        classNames={{ input: "text-base", label: "pb-1" }}
                      />
                      <Input
                        type="date"
                        label="Data Presunta Parto"
                        value={ostetriciaData.dataPresunta}
                        onValueChange={(value) => handleOstetriciaChange("dataPresunta", value)}
                        variant="bordered"
                        labelPlacement="outside"
                        classNames={{ input: "text-base", label: "pb-1" }}
                      />
                      
                      <Divider className="my-2"/>
                      
                      <div className="grid grid-cols-2 gap-3">
                         <Input
                          label="Peso Pre (kg)"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={ostetriciaData.pesoPreGravidanza.toString()}
                          onValueChange={(v) => handleOstetriciaChange("pesoPreGravidanza", parseFloat(v) || 0)}
                          classNames={{ label: "pb-1" }}
                        />
                         <Input
                          label="Peso Attuale (kg)"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={ostetriciaData.pesoAttuale.toString()}
                          onValueChange={(v) => handleOstetriciaChange("pesoAttuale", parseFloat(v) || 0)}
                          classNames={{ label: "pb-1" }}
                        />
                      </div>
                      <Input
                        label="Pressione Arteriosa"
                        placeholder="120/80"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={ostetriciaData.pressioneArteriosa}
                        onValueChange={(v) => handleOstetriciaChange("pressioneArteriosa", v)}
                        classNames={{ label: "pb-1" }}
                      />
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                   <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Storia Ostetrica
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-5">
                     {/* Errori validazione */}
                    {(() => {
                      const errs = ostetriciaAnamnesiErrors(ostetriciaData);
                      return errs.length > 0 ? (
                        <div className="p-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 text-xs mb-2">
                          <ul className="list-disc list-inside space-y-1">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-3 gap-3">
                       <Input
                        type="number"
                        label="Gravid."
                        value={ostetriciaData.gravidanzePrec.toString()}
                        onValueChange={(v) => handleOstetriciaChange("gravidanzePrec", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        classNames={{ input: "text-center" }}
                      />
                       <Input
                        type="number"
                        label="Parti"
                        value={ostetriciaData.partiPrec.toString()}
                        onValueChange={(v) => handleOstetriciaChange("partiPrec", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        classNames={{ input: "text-center" }}
                      />
                       <Input
                        type="number"
                        label="Aborti"
                        value={ostetriciaData.abortiPrec.toString()}
                        onValueChange={(v) => handleOstetriciaChange("abortiPrec", parseInt(v) || 0)}
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        classNames={{ input: "text-center" }}
                      />
                    </div>
                     {/* Dettagli */}
                    <div className="bg-gray-50/80 p-4 rounded-xl border border-dashed border-gray-300">
                      <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">Dettagli</p>
                      <div className="grid grid-cols-2 gap-4">
                         <Input
                          label="PS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.partiPrecSpontanei ?? 0)}
                          onValueChange={(v) => handleOstetriciaChange("partiPrecSpontanei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                         <Input
                          label="TC"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.partiPrecCesarei ?? 0)}
                          onValueChange={(v) => handleOstetriciaChange("partiPrecCesarei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="AS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.abortiPrecSpontanei ?? 0)}
                          onValueChange={(v) => handleOstetriciaChange("abortiPrecSpontanei", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="IVG"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.ivgPrec ?? 0)}
                          onValueChange={(v) => handleOstetriciaChange("ivgPrec", parseInt(v) || 0)}
                          classNames={{ input: "text-center" }}
                        />
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Foto Ecografia
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {(ostetriciaData.ecografiaImmagini ?? []).length}/8 immagini
                      </span>
                    </div>

                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:border-primary cursor-pointer text-sm">
                      <ImagePlus size={16} />
                      Carica immagini
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleEcografiaImagesUpload("ostetricia", e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {(ostetriciaData.ecografiaImmagini ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {(ostetriciaData.ecografiaImmagini ?? []).map((image, idx) => (
                          <div key={`obs-eco-${idx}`} className="relative group border rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={image}
                              alt={`Ecografia ostetrica ${idx + 1}`}
                              className="w-full h-28 object-cover cursor-zoom-in"
                              onClick={() => setFullscreenImage(image)}
                              title="Clicca per ingrandire"
                            />
                            <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
                              Clicca per ingrandire
                            </span>
                            <button
                              type="button"
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveEcografiaImage("ostetricia", idx)}
                              aria-label="Rimuovi immagine ecografia"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* RIGHT COLUMN: Referto Testuale */}
              <div className="w-full lg:flex-1 space-y-6">
                {/* Biometria fetale e peso stimato */}
                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Biometria fetale
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(FORMULA_BIOMETRIA_FIELDS[fetalFormula] ?? FORMULA_BIOMETRIA_FIELDS.hadlock4).map((field) => (
                        <Input
                          key={field}
                          type="number"
                          label={BIOMETRIA_FIELD_LABELS[field]}
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={ostetriciaData.biometriaFetale?.[field] ? String(ostetriciaData.biometriaFetale[field]) : ""}
                          onValueChange={(v) => handleBiometriaFetaleChange(field, parseInt(v) || 0)}
                          min={0}
                          classNames={{ label: "pb-1" }}
                        />
                      ))}
                    </div>
                    <div className="bg-primary-50/50 rounded-xl p-4 flex items-center justify-between">
                      <p className="font-semibold text-gray-900">
                        Peso fetale stimato{" "}
                        <span className="font-normal text-default-500">
                          ({scalePesoFetale[fetalFormula as keyof typeof scalePesoFetale]?.nome ?? fetalFormula})
                        </span>
                      </p>
                      <div className="text-right">
                        {(() => {
                          const result = scalePesoFetale[fetalFormula as keyof typeof scalePesoFetale];
                          if (result?.calcolabile && result.pesoGrammi != null) {
                            const ga = parseGestationalWeeks(ostetriciaData.settimaneGestazione ?? "");
                            const centile = ga != null ? getCentileForWeight(result.pesoGrammi, ga) : null;
                            const centileStr = getCentileLabel(centile);
                            return (
                              <div>
                                <p className="text-xl font-bold text-primary">{result.pesoGrammi} g</p>
                                {centileStr && (
                                  <p className="text-sm text-default-500 mt-0.5">
                                    {centileStr} centile
                                    {ga != null && (
                                      <span className="text-default-400"> (per {ostetriciaData.settimaneGestazione} sett.)</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return <p className="text-gray-400 font-medium text-sm">Dati insufficienti</p>;
                        })()}
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-6 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Referto Medico
                  </CardHeader>
                  <CardBody className="p-6 space-y-8">
                     {/* Sezione 1: Anamnesi */}
                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">1. Anamnesi</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => t.category === 'ostetricia' && t.section === 'prestazione')} 
                          onSelect={(t) => handleTemplateSelect('ostetrica', 'prestazione', t)} 
                        />
                      </div>
                      <Textarea
                        value={ostetriciaData.prestazione}
                        onValueChange={(value) => handleOstetriciaChange("prestazione", value)}
                        variant="bordered"
                        minRows={3}
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    {/* Sezione 2: Descrizione */}
                    <div className="space-y-2 group">
                      <label className="text-sm font-bold text-gray-700 block mb-1">2. Descrizione Problema</label>
                      <Textarea
                        value={ostetriciaData.problemaClinico}
                        onValueChange={(value) => handleOstetriciaChange("problemaClinico", value)}
                        variant="bordered"
                        minRows={3}
                        placeholder="Motivo della visita, sintomi riferiti..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    {/* Sezione 3: Esame Obiettivo */}
                    <div className="space-y-2 relative group">
                       <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">3. Visita / Ecografia Office</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => t.category === 'ostetricia' && t.section === 'esameObiettivo')} 
                          onSelect={(t) => handleTemplateSelect('ostetrica', 'esameObiettivo', t)} 
                        />
                      </div>
                      <Textarea
                        value={ostetriciaData.esameObiettivo}
                        onValueChange={(value) => handleOstetriciaChange("esameObiettivo", value)}
                        variant="bordered"
                        minRows={5}
                        placeholder="Biometria fetale, liquido amniotico..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>

                    <div className="space-y-2 relative group">
                       <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">4. Conclusioni e Terapie</label>
                        <TemplateSelector 
                          templates={allTemplates.filter(t => (t.category === 'ostetricia' && t.section === 'conclusioni') || t.category === 'terapie')} 
                          onSelect={(t) => handleTemplateSelect('ostetrica', 'noteOstetriche', t)} 
                        />
                      </div>
                      <Textarea
                        value={ostetriciaData.noteOstetriche}
                        onValueChange={(value) => handleOstetriciaChange("noteOstetriche", value)}
                        variant="bordered"
                        minRows={3}
                        placeholder="Raccomandazioni e follow-up..."
                        classNames={{ 
                          input: "text-base leading-relaxed",
                          inputWrapper: "group-hover:border-primary transition-colors bg-white" 
                        }}
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>

            </div>
          </Tab>
        </Tabs>
      </form>

      {/* 4. Floating Action Bar (Pill) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex justify-center w-full pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 pointer-events-auto transition-all hover:shadow-xl hover:scale-[1.01]">
          
          <Button
            variant="light"
            color="danger"
            size="sm"
            onPress={handleNavigateCronologia}
            startContent={<ArrowLeft size={16} />}
            className="text-gray-600 hover:text-danger font-medium"
          >
            Annulla
          </Button>

          <div className="h-6 w-px bg-gray-300" />

          <div className="flex gap-3">
             <Button
              color="secondary"
              variant="flat"
              size="md"
              onPress={handlePrintPdf}
              isLoading={pdfLoading}
              isDisabled={pdfLoading}
              startContent={<Printer size={18} />}
              className="rounded-full"
            >
              Stampa
            </Button>

            <Button
              onPress={() => handleSubmit()}
              color="success"
              size="md"
              className="px-6 font-bold text-white shadow-lg shadow-success/20 rounded-full"
              isLoading={loading}
              isDisabled={loading}
              startContent={<Save size={18} />}
            >
              {loading ? "Salvando..." : "Salva Visita"}
            </Button>
          </div>
        </div>
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          onClick={() => setFullscreenImage(null)}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 rounded-full bg-white/95 border border-gray-200 text-gray-700 p-2 shadow-md hover:bg-white"
              onClick={() => setFullscreenImage(null)}
              aria-label="Chiudi anteprima immagine"
            >
              <X size={18} />
            </button>
            <img
              src={fullscreenImage}
              alt="Ecografia ingrandita"
              className="max-w-[92vw] max-h-[92vh] object-contain rounded-2xl border border-gray-200 bg-white p-1 shadow-[0_22px_55px_rgba(0,0,0,0.22)]"
            />
          </div>
        </div>
      )}

      <Modal
        isOpen={isIncludeImagesModalOpen}
        onClose={() => resolveIncludeEcografiaImages(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Includere immagini ecografia?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              Sono presenti <span className="font-semibold">{includeImagesCount}</span> immagini nella visita.
              Vuoi inserirle nel PDF di stampa?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => resolveIncludeEcografiaImages(false)}>
              No, genera senza immagini
            </Button>
            <Button color="primary" onPress={() => resolveIncludeEcografiaImages(true)}>
              Si, includi immagini
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}