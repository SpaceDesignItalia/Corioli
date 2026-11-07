import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Divider,
  Tabs,
  Tab,
  Switch,
  Select,
  SelectItem,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Tooltip,
} from "@nextui-org/react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";

import { RefertoTextarea } from "../../components/RefertoTextarea";
import { EVENTO_REFERTO_APERTO } from "../../components/guida/passiGuida";
import {
  bozzaDaProporre,
  cancellaBozzaVisita,
  chiaveBozzaVisita,
  leggiBozzaVisita,
  scriviBozzaVisita,
  type BozzaVisita,
} from "../../utils/bozzaVisita";
import {
  useRegisterUnsavedChanges,
  useUnsavedChanges,
} from "../../contexts/UnsavedChangesContext";
import {
  addDays,
  differenceInDays,
  parseISO,
  isValid,
  format,
  subDays,
} from "date-fns";
import {
  PatientService,
  VisitService,
  TemplateService,
  PreferenceService,
  DoctorService,
} from "../../services/OfflineServices";
import { PdfService } from "../../services/PdfService";
import { Patient, Visit, MedicalTemplate } from "../../types/Storage";
import {
  createDefaultAnamnesiConfig,
  parseAnamnesiConfig,
  getCampiAttivi,
  getAnamnesiEtichette,
  pickCampiAttivi,
  createEmptyAnamnesiStrutturata,
  cleanAnamnesiStrutturata,
  hasAnamnesiStrutturataContent,
  formatAnamnesiStrutturataText,
} from "../../utils/anamnesiStrutturata";
import { calculateAge } from "../../utils/dateUtils";
import {
  MAX_OBSTETRIC_COUNT,
  MIN_HEIGHT_CM,
  MAX_HEIGHT_CM,
  OBSTETRIC_COUNT_FIELDS,
  clampObstetricCount,
  isValidHeightInputDraft,
  isValidWeightInputDraft,
  parseOptionalHeight,
  parseWeightFieldBlur,
  parseWeightFieldLive,
  parseLabValueBlur,
  parseLabValueLive,
  isValidDecimalInputDraft,
  MAX_GLICEMIA_MG_DL,
  MAX_INSULINEMIA_UU_ML,
  ginecologiaAnamnesiErrors,
  ostetriciaAnamnesiErrors,
  todayIsoDate,
  validateDateNotAfter,
  validateObstetricWeights,
  validateOptionalIsoDate,
  validatePastOrSameDate,
  validateVisitDate,
} from "../../utils/formValidation";
import {
  calcolaStimePesoFetale,
  FORMULA_BIOMETRIA_FIELDS,
  BIOMETRIA_FIELD_LABELS,
  BIOMETRIA_MAX_MM,
  biometriaFuoriScala,
} from "../../utils/fetalWeightUtils";
import {
  parseGestationalWeeks,
  getCentileForWeight,
  formatCentileLabel,
  gestationalDaysFromCrl,
  crlRedatingThresholdDays,
} from "../../utils/fetalGrowthCentiles";
import { misureDaRifare } from "../../utils/copiaVisitaOstetrica";
import { getBiometryPercentile } from "../../utils/biometryCentiles";
import {
  bmiBand,
  computeBmi,
  computeHomaIr,
  formatBmi,
  formatHomaIr,
  homaIrBand,
  type MetabolicBand,
} from "../../utils/metabolicIndices";
import {
  getUmbilicalPiPercentile,
  getUmbilicalRiPercentile,
} from "../../utils/flussimetriaUtils";
import {
  getFetalGrowthDataPointsFromVisits,
  getVisitsOfSamePregnancy,
} from "../../utils/fetalGrowthChartUtils";
import {
  ArrowLeft,
  Printer,
  ClipboardList,
  AlertCircle,
  Save,
  User,
  ImagePlus,
  Trash2,
  Copy,
  X,
  TrendingUp,
  TrendingDown,
  Ruler,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { useDoctorProfileIncompleteModal } from "../../components/DoctorProfileIncompleteModal";
import { getMissingDoctorProfileFields, isDoctorProfileComplete } from "../../utils/doctorProfile";
import { AppModal } from "../../components/AppModal";

function getAltezzaCmForBmi(patient: Patient | null): number | null {
  if (patient?.altezza == null || patient.altezza <= 0) return null;
  return parseOptionalHeight(String(patient.altezza)) ?? null;
}

/**
 * Chip colorato con valore e fascia di un indice metabolico (BMI, HOMA-IR).
 * Il colore è quello della fascia, così la classificazione si legge a colpo
 * d'occhio senza dover ricordare le soglie.
 */
function MetabolicChip({
  sigla,
  valore,
  band,
  title,
}: {
  sigla: string;
  valore: string;
  band: MetabolicBand;
  title: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0 rounded-md border px-2 py-1 text-center animate-appearance-in ${band.chipClass}`}
      title={title}
    >
      <span className="text-xs font-semibold whitespace-nowrap">
        {sigla} {valore}
      </span>
      <span className="text-[10px] font-medium leading-tight opacity-90">
        {band.label}
      </span>
    </div>
  );
}

/** Barra grafica percentile (5°–95°): linea con rombo alla posizione del percentile */
function PercentileBar({
  percentile,
  showText = true,
}: {
  percentile: number | null;
  showText?: boolean;
}) {
  if (percentile == null)
    return <span className="text-default-400 text-xs">—</span>;
  const clamped = Math.max(5, Math.min(95, percentile));
  const leftPct = ((clamped - 5) / 90) * 100;
  return (
    <div className="inline-flex items-center gap-2 w-full">
      <div className="relative flex-1 h-4 flex items-center shrink-0 min-w-[40px]">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px bg-default-300" />
        <div
          className="absolute left-0 top-0 w-px h-3 bg-default-400 rounded-px"
          style={{ top: "2px" }}
        />
        <div
          className="absolute right-0 top-0 w-px h-3 bg-default-400 rounded-px"
          style={{ top: "2px" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-default-600 border border-default-500 shrink-0"
          style={{ left: `calc(${leftPct}% - 4px)` }}
        />
      </div>
      {showText && (
        <span className="text-xs text-default-600 tabular-nums shrink-0">
          {Math.round(percentile)}°
        </span>
      )}
    </div>
  );
}

/** Soglia (in punti percentile) oltre la quale segnaliamo una divergenza tra
 *  percentile inserito a mano e percentile calcolato dalla misura. */
const PERCENTILE_MISMATCH_THRESHOLD = 5;

/**
 * Avviso visivo (non distruttivo) quando il percentile mostrato/inserito diverge
 * dal percentile calcolato sulla misura corrente. Non modifica alcun dato:
 * segnala soltanto al medico una possibile incoerenza (es. valore stantio od
 * override sbagliato). Se i due coincidono (o non sono calcolabili) non mostra nulla.
 */
function PercentileMismatchWarning({
  displayed,
  auto,
}: {
  displayed: number | null | undefined;
  auto: number | null | undefined;
}) {
  if (
    displayed == null ||
    auto == null ||
    !Number.isFinite(displayed) ||
    !Number.isFinite(auto) ||
    Math.abs(displayed - auto) <= PERCENTILE_MISMATCH_THRESHOLD
  ) {
    return null;
  }
  return (
    <Tooltip
      content={`Il percentile indicato (${formatCentileLabel(displayed)}) non corrisponde alla misura inserita, che risulta ${formatCentileLabel(auto)}. Controlla la misura o il percentile.`}
      color="warning"
      placement="top"
    >
      <span className="shrink-0 inline-flex text-warning-500 cursor-help">
        <AlertTriangle size={14} />
      </span>
    </Tooltip>
  );
}

function formatCentileInputValue(
  percentile: number | null | undefined,
): string {
  if (percentile == null || !Number.isFinite(percentile)) return "";
  return formatCentileLabel(percentile).replace("°", "");
}

function parseCentileInputValue(value: string): number | undefined {
  const cleaned = value.trim().replace("°", "").replace(/[<>]/g, "");
  if (cleaned === "") return undefined;
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Mostra PI/IR con virgola decimale (locale IT). */
function formatFlussimetriaNumForInput(n: number): string {
  return String(n).replace(".", ",");
}

/**
 * Parsing durante digitazione: non committa se l'utente sta ancora scrivendo la parte decimale (es. "1,").
 */
function parseFlussimetriaFieldLive(
  raw: string,
): number | undefined | "incomplete" {
  const t = raw.trim();
  if (t === "") return undefined;
  if (t === "-" || t === "+") return "incomplete";
  if (/[.,]$/.test(t)) return "incomplete";
  const n = parseFloat(t.replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function parseFlussimetriaFieldBlur(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

// Helper Component for Templates
const TemplateSelector = ({
  templates,
  onSelect,
  label = "Modello",
}: {
  templates: MedicalTemplate[];
  onSelect: (text: string) => void;
  label?: string;
}) => {
  if (templates.length === 0) return null;

  return (
    <Dropdown
      classNames={{
        // `justify-start` non è decorativo: lo slot `content` di NextUI è un
        // flex column con `justify-center`, e in un contenitore scrollabile
        // centrato l'eccedenza sopra il primo elemento è irraggiungibile
        // (scrollTop non va sotto zero): con molti modelli metà lista restava
        // invisibile pur essendoci la scrollbar.
        content: "max-h-[min(20rem,60vh)] overflow-y-auto justify-start",
      }}
    >
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
          const selected = templates.find((t) => t.id === key);
          if (selected) onSelect(selected.text);
        }}
      >
        {templates.map((t) => (
          <DropdownItem
            key={t.id}
            description={t.text.substring(0, 50) + "..."}
          >
            {t.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

const createDefaultVisitData = () => ({
  dataVisita: todayIsoDate(),
  tipo: "ginecologica",
  descrizioneClinica: "",
  anamnesi: "",
  esamiObiettivo: "",
  conclusioniDiagnostiche: "",
  terapie: "",
});

/** Massimo consentito per i due valori di laboratorio dell'HOMA-IR. */
const HOMA_FIELD_MAX = {
  glicemiaDigiuno: MAX_GLICEMIA_MG_DL,
  insulinemiaDigiuno: MAX_INSULINEMIA_UU_ML,
} as const;

const createDefaultGinecologiaData = () => ({
  gravidanze: 0,
  parti: 0,
  partiSpontanei: 0,
  partiCesarei: 0,
  aborti: 0,
  abortiSpontanei: 0,
  ivg: 0,
  pesoCorporeo: 0,
  glicemiaDigiuno: 0,
  insulinemiaDigiuno: 0,
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
  ecografiaImmagini: [] as string[],
});

const createDefaultOstetriciaData = () => ({
  settimaneGestazione: "",
  ultimaMestruazione: "",
  dataPresunta: "",
  modalitaConcepimento: "",
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
  frequenzaCardiaca: "",
  fumaInGravidanza: "",
  pacchettiSigaretteAlGiorno: 0,
  assunzioneAcidoFolico: "",
  altezzaUterina: "",
  battitiFetali: "",
  movimentiFetali: "",
  esamiEseguiti: "",
  ecografiaOffice: "",
  noteOstetriche: "",
  prestazione: "",
  esameObiettivo: "",
  crlMm: undefined as number | undefined,
  ecografiaImmagini: [] as string[],
  biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 } as NonNullable<
    NonNullable<Visit["ostetricia"]>["biometriaFetale"]
  >,
  flussimetriaOmbelicale: undefined as
    | {
        pi?: number;
        ri?: number;
        edf?: "positivo" | "assente" | "invertito";
        piPercentile?: number;
        riPercentile?: number;
        psv?: number;
        edv?: number;
        velocitaMedia?: number;
      }
    | undefined,
});

type OstetriciaFormState = ReturnType<typeof createDefaultOstetriciaData>;

function mergeFlussimetriaDraftIntoOstetricia(
  ostetricia: OstetriciaFormState,
  draft: { pi: string | null; ri: string | null },
): OstetriciaFormState {
  if (draft.pi === null && draft.ri === null) return ostetricia;
  const prevF = ostetricia.flussimetriaOmbelicale ?? {};
  const nextF = { ...prevF };
  if (draft.pi !== null) {
    const v = parseFlussimetriaFieldBlur(draft.pi);
    if (v !== undefined) nextF.pi = v;
    else delete nextF.pi;
  }
  if (draft.ri !== null) {
    const v = parseFlussimetriaFieldBlur(draft.ri);
    if (v !== undefined) nextF.ri = v;
    else delete nextF.ri;
  }
  return { ...ostetricia, flussimetriaOmbelicale: nextF };
}

function mergePesoDraftIntoOstetricia(
  ostetricia: OstetriciaFormState,
  draft: { pre: string | null; attuale: string | null },
): OstetriciaFormState {
  if (draft.pre === null && draft.attuale === null) return ostetricia;
  const next = { ...ostetricia };
  if (draft.pre !== null) {
    next.pesoPreGravidanza = parseWeightFieldBlur(draft.pre);
  }
  if (draft.attuale !== null) {
    next.pesoAttuale = parseWeightFieldBlur(draft.attuale);
  }
  return next;
}

function computeFlussimetriaCalcoliSnapshot(ostetricia: OstetriciaFormState) {
  const f = ostetricia.flussimetriaOmbelicale;
  const ga = parseGestationalWeeks(ostetricia.settimaneGestazione ?? "");

  if (f?.pi != null && f?.ri != null) {
    const pi = Number(f.pi);
    const ri = Number(f.ri);
    if (!Number.isFinite(pi) || !Number.isFinite(ri)) return null;
    const piPercentile = ga != null ? getUmbilicalPiPercentile(pi, ga) : null;
    const riPercentile = ga != null ? getUmbilicalRiPercentile(ri, ga) : null;
    return { pi, ri, piPercentile, riPercentile };
  }

  const psv = f?.psv != null ? Number(f.psv) : NaN;
  const edv = f?.edv != null ? Number(f.edv) : NaN;
  const vm = f?.velocitaMedia != null ? Number(f.velocitaMedia) : 0;
  if (!isFinite(psv) || !isFinite(edv) || vm === 0) return null;
  const pi = (psv - edv) / vm;
  const ri = psv !== 0 ? (psv - edv) / psv : NaN;
  const piPercentile = ga != null ? getUmbilicalPiPercentile(pi, ga) : null;
  const riPercentile = ga != null ? getUmbilicalRiPercentile(ri, ga) : null;
  return { pi, ri, piPercentile, riPercentile };
}

export default function AddVisit() {
  const [searchParams] = useSearchParams();
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { open: openDoctorProfileIncompleteModal, modal: doctorProfileIncompleteModal } =
    useDoctorProfileIncompleteModal();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [existingVisit, setExistingVisit] = useState<Visit | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { guardAction } = useUnsavedChanges();
  useRegisterUnsavedChanges("add-visit", hasUnsavedChanges);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isPediatricVisitEnabled, setIsPediatricVisitEnabled] = useState(false);
  const [anamnesiConfig, setAnamnesiConfig] = useState(
    createDefaultAnamnesiConfig,
  );
  const [fetalFormula, setFetalFormula] = useState("hadlock4");
  const [isIncludeImagesModalOpen, setIsIncludeImagesModalOpen] =
    useState(false);
  const [includeImagesCount, setIncludeImagesCount] = useState(0);
  // Conferma copia anamnesi "campo unico" → anamnesi a campi multipli
  const [isFlattenAnamnesiModalOpen, setIsFlattenAnamnesiModalOpen] =
    useState(false);
  const [flattenAnamnesiOptions, setFlattenAnamnesiOptions] = useState<
    { key: string; label: string }[]
  >([]);
  const [flattenAnamnesiSelected, setFlattenAnamnesiSelected] =
    useState<string>("");
  const [flattenAnamnesiSource, setFlattenAnamnesiSource] = useState("");
  const flattenAnamnesiResolverRef = useRef<
    ((value: string | null) => void) | null
  >(null);
  const [
    isIncludeFetalGrowthChartModalOpen,
    setIsIncludeFetalGrowthChartModalOpen,
  ] = useState(false);
  const [copiedPreviousType, setCopiedPreviousType] = useState<
    "ginecologica" | "ginecologica_pediatrica" | "ostetrica" | null
  >(null);
  const includeImagesResolverRef = useRef<((value: boolean) => void) | null>(
    null,
  );
  const includeFetalGrowthChartResolverRef = useRef<
    ((value: boolean) => void) | null
  >(null);
  const initialLoadDone = useRef(false);
  /**
   * Visita o paziente ancora in caricamento: la bozza si cerca solo dopo,
   * quando si sa se la visita e' in archivio e quando e' stata salvata.
   */
  const [caricamento, setCaricamento] = useState(true);
  /** Bozza rimasta da una sessione chiusa senza salvare, in attesa di scelta. */
  const [bozzaTrovata, setBozzaTrovata] = useState<BozzaVisita | null>(null);

  // Templates state
  const [allTemplates, setAllTemplates] = useState<MedicalTemplate[]>([]);

  // Dati visita generale
  const [visitData, setVisitData] = useState(createDefaultVisitData);

  // Dati specifici ginecologia
  const [ginecologiaData, setGinecologiaData] = useState(
    createDefaultGinecologiaData,
  );

  // Dati specifici ostetricia
  const [ostetriciaData, setOstetriciaData] = useState(
    createDefaultOstetriciaData,
  );

  // Anamnesi strutturata condivisa tra i tipi di visita
  const [anamnesiStrutturata, setAnamnesiStrutturata] = useState(
    createEmptyAnamnesiStrutturata,
  );

  // Se sto modificando una visita "vecchia" salvata in modalità singola (testo in
  // prestazione/anamnesi e nessun dato strutturato), mostro comunque il campo singolo
  // così il testo esistente resta visibile e modificabile, anche con la preferenza attiva.
  const editingLegacySingleAnamnesi =
    isEditMode &&
    !hasAnamnesiStrutturataContent(existingVisit?.anamnesiStrutturata) &&
    Boolean(
      (
        existingVisit?.ginecologia?.prestazione ||
        existingVisit?.ostetricia?.prestazione ||
        existingVisit?.anamnesi ||
        ""
      ).trim(),
    );
  const anamnesiModeForTipo =
    visitData.tipo === "ginecologica" ||
    visitData.tipo === "ginecologica_pediatrica" ||
    visitData.tipo === "ostetrica"
      ? anamnesiConfig[visitData.tipo].mode
      : "singola";
  const useStructuredAnamnesi =
    anamnesiModeForTipo === "strutturata" && !editingLegacySingleAnamnesi;
  const campiAnamnesiAttivi = getCampiAttivi(anamnesiConfig, visitData.tipo);
  /** Testo libero PI/IR mentre il campo ha focus (virgola decimale senza perdere "1," durante la digitazione). */
  const [flussimetriaOmbelicaleDraft, setFlussimetriaOmbelicaleDraft] =
    useState<{ pi: string | null; ri: string | null }>({
      pi: null,
      ri: null,
    });
  /** Testo libero peso mentre il campo ha focus (evita clamp a 30 kg durante la digitazione). */
  const [pesoInputDraft, setPesoInputDraft] = useState<{
    pre: string | null;
    attuale: string | null;
  }>({ pre: null, attuale: null });
  /** Altezza da salvare in scheda paziente (banner BMI). */
  const [altezzaPendingInput, setAltezzaPendingInput] = useState("");
  const [savingAltezza, setSavingAltezza] = useState(false);
  /** Testo libero peso corporeo (ginecologia) mentre il campo ha focus. */
  const [pesoCorporeoDraft, setPesoCorporeoDraft] = useState<string | null>(
    null,
  );
  /** Testo libero dei valori HOMA-IR (ginecologia) mentre il campo ha focus. */
  const [homaDraft, setHomaDraft] = useState<{
    glicemia: string | null;
    insulinemia: string | null;
  }>({ glicemia: null, insulinemia: null });

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
      setAnamnesiStrutturata(createEmptyAnamnesiStrutturata());
      setFlussimetriaOmbelicaleDraft({ pi: null, ri: null });
      setPesoInputDraft({ pre: null, attuale: null });
      setPesoCorporeoDraft(null);
      setAltezzaPendingInput("");
      setSavingAltezza(false);

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
              terapie: visit.terapie,
            });
            setAnamnesiStrutturata({
              ...createEmptyAnamnesiStrutturata(),
              ...(visit.anamnesiStrutturata ?? {}),
            });

            if (visit.ginecologia) {
              setGinecologiaData((prev) => ({
                ...prev,
                ...visit.ginecologia,
                partiSpontanei: visit.ginecologia?.partiSpontanei ?? 0,
                partiCesarei: visit.ginecologia?.partiCesarei ?? 0,
                abortiSpontanei: visit.ginecologia?.abortiSpontanei ?? 0,
                ivg: visit.ginecologia?.ivg ?? 0,
              }));
            } else if (
              visit.tipo === "ginecologica" ||
              visit.tipo === "ginecologica_pediatrica"
            ) {
              // Visita importata da CSV o salvata solo con campi piatti: popola il form dai flat
              setGinecologiaData((prev) => ({
                ...prev,
                prestazione: visit.anamnesi ?? "",
                problemaClinico: visit.descrizioneClinica ?? "",
                esameBimanuale: visit.esamiObiettivo ?? "",
                conclusione: visit.conclusioniDiagnostiche ?? "",
                terapiaSpecifica:
                  [visit.conclusioniDiagnostiche, visit.terapie]
                    .filter(Boolean)
                    .join("\n") ||
                  (visit.terapie ?? ""),
              }));
            }
            if (visit.ostetricia) {
              setOstetriciaData((prev) => ({
                ...prev,
                ...visit.ostetricia,
                partiPrecSpontanei: visit.ostetricia?.partiPrecSpontanei ?? 0,
                partiPrecCesarei: visit.ostetricia?.partiPrecCesarei ?? 0,
                abortiPrecSpontanei: visit.ostetricia?.abortiPrecSpontanei ?? 0,
                ivgPrec: visit.ostetricia?.ivgPrec ?? 0,
                fumaInGravidanza: visit.ostetricia?.fumaInGravidanza ?? "",
                pacchettiSigaretteAlGiorno:
                  visit.ostetricia?.pacchettiSigaretteAlGiorno ?? 0,
                assunzioneAcidoFolico:
                  visit.ostetricia?.assunzioneAcidoFolico ?? "",
                modalitaConcepimento:
                  visit.ostetricia?.modalitaConcepimento ?? "",
                biometriaFetale: visit.ostetricia?.biometriaFetale ?? {
                  bpdMm: 0,
                  hcMm: 0,
                  acMm: 0,
                  flMm: 0,
                },
                flussimetriaOmbelicale:
                  visit.ostetricia?.flussimetriaOmbelicale,
              }));
            } else if (visit.tipo === "ostetrica") {
              // Visita importata da CSV o salvata solo con campi piatti
              setOstetriciaData((prev) => ({
                ...prev,
                prestazione: visit.anamnesi ?? "",
                problemaClinico: visit.descrizioneClinica ?? "",
                esameObiettivo: visit.esamiObiettivo ?? "",
                ecografiaOffice: visit.esamiObiettivo ?? "",
                noteOstetriche: visit.conclusioniDiagnostiche ?? "",
              }));
            }
            const patientData = await PatientService.getPatientById(
              visit.patientId,
            );
            setPatient(patientData);
            if (patientData) {
              const visitsData = await VisitService.getVisitsByPatientId(
                patientData.id,
              );
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff =
                  new Date(b.dataVisita).getTime() -
                  new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                );
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
              const visitsData = await VisitService.getVisitsByPatientId(
                patientData.id,
              );
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff =
                  new Date(b.dataVisita).getTime() -
                  new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                );
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
              const visitsData = await VisitService.getVisitsByPatientId(
                patientData.id,
              );
              const sortedVisits = visitsData.sort((a, b) => {
                const dateDiff =
                  new Date(b.dataVisita).getTime() -
                  new Date(a.dataVisita).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
                );
              });
              setPatientVisits(sortedVisits);
            }
          } catch (error) {
            setError("Errore nel caricamento dati paziente");
          }
        }
      }
      setTimeout(() => {
        initialLoadDone.current = true;
      }, 300);
      setCaricamento(false);
    };
    loadData();
  }, [searchParams, visitId]);

  // ── Bozza locale (vedi utils/bozzaVisita) ──────────────────────────────
  const chiaveBozza = patient ? chiaveBozzaVisita(visitId, patient.id) : null;

  // Alla riapertura: c'e' una bozza piu' recente dell'ultimo salvataggio?
  useEffect(() => {
    if (caricamento || !chiaveBozza) return;
    let attivo = true;
    void leggiBozzaVisita(chiaveBozza).then((bozza) => {
      if (attivo && bozzaDaProporre(bozza, existingVisit?.updatedAt)) {
        setBozzaTrovata(bozza);
      }
    });
    return () => {
      attivo = false;
    };
    // existingVisit arriva con lo stesso caricamento: basta riguardare quando finisce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caricamento, chiaveBozza]);

  // Scrittura a ogni pausa di battitura. Ferma finche' una bozza vecchia
  // aspetta una risposta, se no la sovrascriverebbe prima della scelta.
  // Le immagini dell'ecografia restano fuori: pesano anche qualche MB l'una,
  // e riscriverle a ogni pausa rallenterebbe la scrittura del referto.
  useEffect(() => {
    if (!hasUnsavedChanges || !chiaveBozza || bozzaTrovata) return;
    const timer = window.setTimeout(() => {
      const { ecografiaImmagini: _g, ...ginecologia } = ginecologiaData;
      const { ecografiaImmagini: _o, ...ostetricia } = ostetriciaData;
      void scriviBozzaVisita(chiaveBozza, {
        salvataIl: new Date().toISOString(),
        visitData,
        visitaData: { ginecologia, ostetricia },
        anamnesiStrutturata,
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hasUnsavedChanges, chiaveBozza, bozzaTrovata, visitData, ginecologiaData, ostetriciaData, anamnesiStrutturata]);

  // Uscendo dalla maschera dall'interno dell'app si e' salvato o si e'
  // confermato di non salvare: la bozza non serve piu'.
  useEffect(() => {
    if (!chiaveBozza) return;
    return () => {
      void cancellaBozzaVisita(chiaveBozza);
    };
  }, [chiaveBozza]);

  const riprendiBozza = () => {
    if (!bozzaTrovata) return;
    const b = bozzaTrovata;
    const sezioni = (b.visitaData ?? {}) as {
      ginecologia?: Partial<typeof ginecologiaData>;
      ostetricia?: Partial<typeof ostetriciaData>;
    };
    setVisitData((prev) => ({ ...prev, ...(b.visitData as Partial<typeof prev>) }));
    // Le immagini non sono nella bozza: restano quelle che ci sono.
    if (sezioni.ginecologia) setGinecologiaData((prev) => ({ ...prev, ...sezioni.ginecologia }));
    if (sezioni.ostetricia) setOstetriciaData((prev) => ({ ...prev, ...sezioni.ostetricia }));
    setAnamnesiStrutturata((prev) => ({
      ...prev,
      ...(b.anamnesiStrutturata as Partial<typeof prev>),
    }));
    setBozzaTrovata(null);
    setHasUnsavedChanges(true);
  };

  const scartaBozza = () => {
    if (chiaveBozza) void cancellaBozzaVisita(chiaveBozza);
    setBozzaTrovata(null);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const loadVisitPreferences = async () => {
      try {
        const prefs = await PreferenceService.getPreferences();
        if (!prefs) {
          setIsPediatricVisitEnabled(false);
          setAnamnesiConfig(createDefaultAnamnesiConfig());
          setFetalFormula("hadlock4");
          return;
        }
        setIsPediatricVisitEnabled(
          Boolean(prefs?.visitaGinecologicaPediatricaEnabled),
        );
        setAnamnesiConfig(parseAnamnesiConfig(prefs));
        setFetalFormula((prefs?.formulaPesoFetale as string) || "hadlock4");
      } catch {
        setIsPediatricVisitEnabled(false);
        setAnamnesiConfig(createDefaultAnamnesiConfig());
        setFetalFormula("hadlock4");
      }
    };

    void loadVisitPreferences();
    const onFocus = () => void loadVisitPreferences();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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

  const [suggestions, setSuggestions] = useState<{
    gestazione?: string;
    dpp?: string;
  }>({});

  // Calcolo suggerimenti gravidanza
  useEffect(() => {
    if (visitData.tipo !== "ostetrica") {
      setSuggestions({});
      return;
    }

    const newState: { gestazione?: string; dpp?: string } = {};
    const lmp = parseISO(ostetriciaData.ultimaMestruazione || "");
    const visitDate = parseISO(visitData.dataVisita);

    if (isValid(lmp)) {
      // DPP
      const dppDate = addDays(lmp, 280);
      const dppStr = format(dppDate, "yyyy-MM-dd");
      if (dppStr !== ostetriciaData.dataPresunta) {
        newState.dpp = dppStr;
      }

      // Settimane
      if (isValid(visitDate)) {
        const diffDays = differenceInDays(visitDate, lmp);
        if (diffDays > 0 && diffDays < 300) {
          // sanity check
          const weeks = Math.floor(diffDays / 7);
          const days = diffDays % 7;
          const gestStr = `${weeks}+${days}`;
          if (gestStr !== ostetriciaData.settimaneGestazione) {
            newState.gestazione = gestStr;
          }
        }
      }
    }
    setSuggestions(newState);
  }, [
    ostetriciaData.ultimaMestruazione,
    visitData.dataVisita,
    ostetriciaData.dataPresunta,
    ostetriciaData.settimaneGestazione,
    visitData.tipo,
  ]);

  // Calcolo automatico gravidanza spostato negli handler onChange per evitare sovrascritture indesiderate al mount.

  const handleTemplateSelect = (
    category: "ginecologia" | "ostetrica",
    field: string,
    text: string,
  ) => {
    if (category === "ginecologia") {
      setGinecologiaData((prev) => ({
        ...prev,
        [field]: prev[field as keyof typeof prev]
          ? `${prev[field as keyof typeof prev]}\n${text}`
          : text,
      }));
    } else {
      setOstetriciaData((prev) => ({
        ...prev,
        [field]: prev[field as keyof typeof prev]
          ? `${prev[field as keyof typeof prev]}\n${text}`
          : text,
      }));
    }
  };

  const handleSubmit = async (
    e?: React.FormEvent | { preventDefault: () => void },
    options?: { skipRedirect?: boolean },
  ): Promise<boolean> => {
    if (e && e.preventDefault) e.preventDefault();
    if (!patient) {
      setError("Nessun paziente selezionato");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const doctor = await DoctorService.getDoctor();
      if (!isDoctorProfileComplete(doctor)) {
        openDoctorProfileIncompleteModal(getMissingDoctorProfileFields(doctor));
        return false;
      }

      const visitDateErr = validateVisitDate(visitData.dataVisita);
      if (visitDateErr) {
        setError(visitDateErr);
        showToast(visitDateErr, "error");
        return false;
      }

      if (
        visitData.tipo === "ginecologica" ||
        visitData.tipo === "ginecologica_pediatrica"
      ) {
        const lmpErr =
          validatePastOrSameDate(
            ginecologiaData.ultimaMestruazione,
            "Ultima mestruazione",
          ) ??
          validateDateNotAfter(
            ginecologiaData.ultimaMestruazione,
            visitData.dataVisita,
            "Ultima mestruazione",
          );
        if (lmpErr) {
          setError(lmpErr);
          showToast(lmpErr, "error");
          return false;
        }
        const gynErrs = ginecologiaAnamnesiErrors(ginecologiaData);
        if (gynErrs.length > 0) {
          const message = gynErrs.join(". ");
          setError(message);
          showToast(message, "error");
          return false;
        }
        if (
          altezzaPendingInput.trim() &&
          (!patient.altezza || patient.altezza <= 0)
        ) {
          const valid = parseOptionalHeight(altezzaPendingInput.trim());
          if (valid != null) {
            await persistPatientAltezzaIfNeeded(valid);
          }
        }
      }

      if (visitData.tipo === "ostetrica") {
        const lmpErr =
          validatePastOrSameDate(
            ostetriciaData.ultimaMestruazione,
            "Ultima mestruazione",
          ) ??
          validateDateNotAfter(
            ostetriciaData.ultimaMestruazione,
            visitData.dataVisita,
            "Ultima mestruazione",
          );
        if (lmpErr) {
          setError(lmpErr);
          showToast(lmpErr, "error");
          return false;
        }
        const dppErr = validateOptionalIsoDate(
          ostetriciaData.dataPresunta,
          "Data presunta parto",
        );
        if (dppErr) {
          setError(dppErr);
          showToast(dppErr, "error");
          return false;
        }
        const obsErrs = ostetriciaAnamnesiErrors(ostetriciaData);
        if (obsErrs.length > 0) {
          const message = obsErrs.join(". ");
          setError(message);
          showToast(message, "error");
          return false;
        }
        const ostetriciaWithDrafts = mergePesoDraftIntoOstetricia(
          mergeFlussimetriaDraftIntoOstetricia(
            ostetriciaData,
            flussimetriaOmbelicaleDraft,
          ),
          pesoInputDraft,
        );
        const weightErr = validateObstetricWeights(
          ostetriciaWithDrafts.pesoPreGravidanza,
          ostetriciaWithDrafts.pesoAttuale,
        );
        if (weightErr) {
          setError(weightErr);
          showToast(weightErr, "error");
          return false;
        }
        // Anche la stampa passa di qui: un refuso nella biometria non arriva
        // al referto con un peso fetale impossibile.
        const biometriaErr = biometriaFuoriScala(
          ostetriciaWithDrafts.biometriaFetale,
        );
        if (biometriaErr) {
          setError(biometriaErr);
          showToast(biometriaErr, "error");
          return false;
        }
        if (
          altezzaPendingInput.trim() &&
          (!patient.altezza || patient.altezza <= 0)
        ) {
          const valid = parseOptionalHeight(altezzaPendingInput.trim());
          if (valid != null) {
            await persistPatientAltezzaIfNeeded(valid);
          }
        }
      }

      const ostetriciaForSave =
        visitData.tipo === "ostetrica"
          ? mergePesoDraftIntoOstetricia(
              mergeFlussimetriaDraftIntoOstetricia(
                ostetriciaData,
                flussimetriaOmbelicaleDraft,
              ),
              pesoInputDraft,
            )
          : ostetriciaData;
      const flussimetriaCalcoliForSave =
        visitData.tipo === "ostetrica"
          ? computeFlussimetriaCalcoliSnapshot(ostetriciaForSave)
          : null;
      // I campi numerici della ginecologia possono essere ancora "in bozza"
      // (focus nel campo, blur mai avvenuto): li normalizziamo prima di salvare.
      const ginecologiaForSave = {
        ...ginecologiaData,
        ...(pesoCorporeoDraft !== null
          ? { pesoCorporeo: parseWeightFieldBlur(pesoCorporeoDraft) }
          : {}),
        ...(homaDraft.glicemia !== null
          ? {
              glicemiaDigiuno: parseLabValueBlur(
                homaDraft.glicemia,
                MAX_GLICEMIA_MG_DL,
              ),
            }
          : {}),
        ...(homaDraft.insulinemia !== null
          ? {
              insulinemiaDigiuno: parseLabValueBlur(
                homaDraft.insulinemia,
                MAX_INSULINEMIA_UU_ML,
              ),
            }
          : {}),
      };

      // Modalità strutturata: salva i sotto-campi (puliti) e lascia intatta
      // `prestazione` (per non perdere dati se si torna alla modalità singola).
      // Modalità singola: azzera `anamnesiStrutturata` così il PDF usa `prestazione`.
      const anamnesiStrutturataForSave = useStructuredAnamnesi
        ? cleanAnamnesiStrutturata(
            pickCampiAttivi(anamnesiStrutturata, anamnesiConfig, visitData.tipo),
          )
        : undefined;

      const visitToSave = {
        patientId: patient.id,
        dataVisita: visitData.dataVisita,
        descrizioneClinica: visitData.descrizioneClinica,
        anamnesi: visitData.anamnesi,
        esamiObiettivo: visitData.esamiObiettivo,
        conclusioniDiagnostiche: visitData.conclusioniDiagnostiche,
        terapie: visitData.terapie,
        tipo: visitData.tipo as any,
        anamnesiStrutturata: anamnesiStrutturataForSave,
        ginecologia:
          visitData.tipo === "ginecologica" ||
          visitData.tipo === "ginecologica_pediatrica"
            ? ginecologiaForSave
            : undefined,
        ostetricia:
          visitData.tipo === "ostetrica"
            ? {
                ...ostetriciaForSave,
                flussimetriaOmbelicale: ostetriciaForSave.flussimetriaOmbelicale
                  ? {
                      ...ostetriciaForSave.flussimetriaOmbelicale,
                      piPercentile:
                        flussimetriaCalcoliForSave?.piPercentile ??
                        ostetriciaForSave.flussimetriaOmbelicale.piPercentile,
                      riPercentile:
                        flussimetriaCalcoliForSave?.riPercentile ??
                        ostetriciaForSave.flussimetriaOmbelicale.riPercentile,
                    }
                  : undefined,
              }
            : undefined,
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
      if (visitData.tipo === "ostetrica") {
        setOstetriciaData(ostetriciaForSave);
        setFlussimetriaOmbelicaleDraft({ pi: null, ri: null });
        setPesoInputDraft({ pre: null, attuale: null });
      }
      void cancellaBozzaVisita(chiaveBozzaVisita(visitId, patient.id));
      if (!options?.skipRedirect) {
        setTimeout(() => navigate(`/patient-history/${patient.id}`), 1000);
      }
      return true;
    } catch (error) {
      console.error("Errore nel salvataggio visita:", error);
      setError(
        isEditMode
          ? "Errore nell'aggiornamento della visita"
          : "Errore nel salvataggio della visita",
      );
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getPreviousVisitByType = (
    tipo: "ginecologica" | "ginecologica_pediatrica" | "ostetrica",
  ) => {
    return patientVisits.find(
      (v) => v.tipo === tipo && (!existingVisit || v.id !== existingVisit.id),
    );
  };

  const handleCopyPreviousVisit = async () => {
    const currentType = visitData.tipo as
      | "ginecologica"
      | "ginecologica_pediatrica"
      | "ostetrica";
    if (
      currentType !== "ginecologica" &&
      currentType !== "ginecologica_pediatrica" &&
      currentType !== "ostetrica"
    ) {
      showToast(
        "Copia disponibile solo per visite ginecologiche e ostetriche.",
        "info",
      );
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
        terapie: "",
      }));

      if (currentType === "ostetrica") {
        setOstetriciaData(createDefaultOstetriciaData());
      } else {
        setGinecologiaData(createDefaultGinecologiaData());
      }
      setAnamnesiStrutturata(createEmptyAnamnesiStrutturata());

      setCopiedPreviousType(null);
      setHasUnsavedChanges(true);
      showToast("Campi svuotati.");
      return;
    }

    const previousVisit = getPreviousVisitByType(currentType);
    if (!previousVisit) {
      showToast(
        `Nessuna visita ${currentType} precedente trovata per questo paziente.`,
        "info",
      );
      return;
    }

    setVisitData((prev) => ({
      ...prev,
      descrizioneClinica: previousVisit.descrizioneClinica || "",
      anamnesi: previousVisit.anamnesi || "",
      esamiObiettivo: previousVisit.esamiObiettivo || "",
      conclusioniDiagnostiche: previousVisit.conclusioniDiagnostiche || "",
      terapie: previousVisit.terapie || "",
    }));

    if (
      currentType === "ginecologica" ||
      currentType === "ginecologica_pediatrica"
    ) {
      if (previousVisit.ginecologia) {
        setGinecologiaData((prev) => ({
          ...prev,
          ...previousVisit.ginecologia,
          partiSpontanei: previousVisit.ginecologia?.partiSpontanei ?? 0,
          partiCesarei: previousVisit.ginecologia?.partiCesarei ?? 0,
          abortiSpontanei: previousVisit.ginecologia?.abortiSpontanei ?? 0,
          ivg: previousVisit.ginecologia?.ivg ?? 0,
          ecografiaImmagini: previousVisit.ginecologia?.ecografiaImmagini ?? [],
        }));
      } else {
        setGinecologiaData((prev) => ({
          ...prev,
          prestazione: previousVisit.anamnesi ?? "",
          problemaClinico: previousVisit.descrizioneClinica ?? "",
          esameBimanuale: previousVisit.esamiObiettivo ?? "",
          conclusione: previousVisit.conclusioniDiagnostiche ?? "",
          terapiaSpecifica:
            [previousVisit.conclusioniDiagnostiche, previousVisit.terapie]
              .filter(Boolean)
              .join("\n") ||
            (previousVisit.terapie ?? ""),
        }));
      }
    }

    if (currentType === "ostetrica") {
      if (previousVisit.ostetricia) {
        setOstetriciaData((prev) => ({
          ...prev,
          ...previousVisit.ostetricia,
          partiPrecSpontanei: previousVisit.ostetricia?.partiPrecSpontanei ?? 0,
          partiPrecCesarei: previousVisit.ostetricia?.partiPrecCesarei ?? 0,
          abortiPrecSpontanei:
            previousVisit.ostetricia?.abortiPrecSpontanei ?? 0,
          ivgPrec: previousVisit.ostetricia?.ivgPrec ?? 0,
          // Epoca ricalcolata alla data di oggi; misure del feto, parametri
          // materni e immagini sono di quel controllo e vanno rifatti.
          ...misureDaRifare(
            previousVisit.ostetricia?.ultimaMestruazione ?? "",
            visitData.dataVisita,
          ),
        }));
        setFlussimetriaOmbelicaleDraft({ pi: null, ri: null });
        setPesoInputDraft((d) => ({ ...d, attuale: null }));
      } else {
        setOstetriciaData((prev) => ({
          ...prev,
          prestazione: previousVisit.anamnesi ?? "",
          problemaClinico: previousVisit.descrizioneClinica ?? "",
          esameObiettivo: previousVisit.esamiObiettivo ?? "",
          ecografiaOffice: previousVisit.esamiObiettivo ?? "",
          noteOstetriche: previousVisit.conclusioniDiagnostiche ?? "",
        }));
      }
    }

    // ── Anamnesi: copia secondo la modalità del tipo di visita corrente ──
    const currentMode = anamnesiConfig[currentType].mode;
    const prevStructured = previousVisit.anamnesiStrutturata;
    const prevHasStructured = hasAnamnesiStrutturataContent(prevStructured);
    const prevSingleAnamnesi = (
      previousVisit.ginecologia?.prestazione ||
      previousVisit.ostetricia?.prestazione ||
      previousVisit.anamnesi ||
      ""
    ).trim();

    if (currentMode === "strutturata") {
      if (prevHasStructured) {
        // Precedente già a campi multipli: ogni campo va nel campo giusto
        // (solo i sotto-campi attualmente attivi).
        const next = createEmptyAnamnesiStrutturata();
        for (const f of campiAnamnesiAttivi) {
          const val = (prevStructured?.[f.key] ?? "").trim();
          if (val) next[f.key] = val;
        }
        setAnamnesiStrutturata(next);
      } else if (prevSingleAnamnesi && campiAnamnesiAttivi.length > 0) {
        // Precedente in campo unico → conversione non automatica: il medico
        // sceglie se distribuire manualmente o importare tutto in una sezione.
        const next = createEmptyAnamnesiStrutturata();
        const chosenKey = await askConfirmFlattenSingleToMulti(
          campiAnamnesiAttivi.map((c) => ({ key: c.key, label: c.label })),
          prevSingleAnamnesi,
        );
        if (chosenKey) next[chosenKey] = prevSingleAnamnesi;
        setAnamnesiStrutturata(next);
      } else {
        setAnamnesiStrutturata(createEmptyAnamnesiStrutturata());
      }
      // In modalità strutturata il campo unico non è usato: evita testo "dormiente"
      // copiato dalla visita precedente che riaffiorerebbe nel fallback del PDF.
      if (currentType === "ostetrica") {
        setOstetriciaData((prev) => ({ ...prev, prestazione: "" }));
      } else {
        setGinecologiaData((prev) => ({ ...prev, prestazione: "" }));
      }
    } else {
      // Modalità campo unico
      setAnamnesiStrutturata(createEmptyAnamnesiStrutturata());
      if (prevHasStructured) {
        // Precedente a campi multipli → tutto nel campo unico (prestazione)
        const flat = formatAnamnesiStrutturataText(
          prevStructured,
          undefined,
          getAnamnesiEtichette(anamnesiConfig, currentType),
        );
        if (currentType === "ostetrica") {
          setOstetriciaData((prev) => ({ ...prev, prestazione: flat }));
        } else {
          setGinecologiaData((prev) => ({ ...prev, prestazione: flat }));
        }
      }
      // Se anche la precedente era in campo unico, prestazione è già copiata sopra.
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

  const handleEcografiaImagesUpload = async (
    tipo: "ginecologia" | "ostetricia",
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return;
    const maxImages = 20;
    const maxFileSize = 7 * 1024 * 1024; // 7MB per immagine

    const currentImages =
      tipo === "ginecologia"
        ? (ginecologiaData.ecografiaImmagini ?? [])
        : (ostetriciaData.ecografiaImmagini ?? []);

    if (currentImages.length >= maxImages) {
      showToast(
        `Hai già raggiunto il massimo di ${maxImages} immagini.`,
        "info",
      );
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
        setGinecologiaData((prev) => ({
          ...prev,
          ecografiaImmagini: [...(prev.ecografiaImmagini ?? []), ...encoded],
        }));
      } else {
        setOstetriciaData((prev) => ({
          ...prev,
          ecografiaImmagini: [...(prev.ecografiaImmagini ?? []), ...encoded],
        }));
      }

      if (initialLoadDone.current) setHasUnsavedChanges(true);
      if (encoded.length > 0)
        showToast(`${encoded.length} immagine/i caricata/e.`);
    } catch (err) {
      console.error("Errore caricamento immagini ecografia:", err);
      showToast("Errore durante il caricamento delle immagini.", "error");
    }
  };

  const handleRemoveEcografiaImage = (
    tipo: "ginecologia" | "ostetricia",
    imageIndex: number,
  ) => {
    if (tipo === "ginecologia") {
      setGinecologiaData((prev) => ({
        ...prev,
        ecografiaImmagini: (prev.ecografiaImmagini ?? []).filter(
          (_, idx) => idx !== imageIndex,
        ),
      }));
    } else {
      setOstetriciaData((prev) => ({
        ...prev,
        ecografiaImmagini: (prev.ecografiaImmagini ?? []).filter(
          (_, idx) => idx !== imageIndex,
        ),
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

  const askConfirmFlattenSingleToMulti = (
    campi: { key: string; label: string }[],
    sourceText: string,
  ): Promise<string | null> => {
    setFlattenAnamnesiOptions(campi);
    setFlattenAnamnesiSelected(campi[0]?.key ?? "");
    setFlattenAnamnesiSource(sourceText);
    setIsFlattenAnamnesiModalOpen(true);
    return new Promise((resolve) => {
      flattenAnamnesiResolverRef.current = resolve;
    });
  };

  /** `null` = distribuisci manualmente (nessun campo precompilato). */
  const resolveFlattenAnamnesi = (value: string | null) => {
    setIsFlattenAnamnesiModalOpen(false);
    flattenAnamnesiResolverRef.current?.(value);
    flattenAnamnesiResolverRef.current = null;
  };

  const askIncludeFetalGrowthChart = (): Promise<boolean> => {
    setIsIncludeFetalGrowthChartModalOpen(true);
    return new Promise((resolve) => {
      includeFetalGrowthChartResolverRef.current = resolve;
    });
  };

  const resolveIncludeFetalGrowthChart = (include: boolean) => {
    setIsIncludeFetalGrowthChartModalOpen(false);
    includeFetalGrowthChartResolverRef.current?.(include);
    includeFetalGrowthChartResolverRef.current = null;
  };

  const handlePrintPdf = async () => {
    if (!patient) return;
    if (
      visitData.tipo !== "ginecologica" &&
      visitData.tipo !== "ginecologica_pediatrica" &&
      visitData.tipo !== "ostetrica"
    ) {
      showToast(
        "Stampa disponibile solo per visite ginecologiche e ostetriche.",
        "info",
      );
      return;
    }

    // Salva la visita prima di stampare (senza redirect)
    const saved = await handleSubmit(undefined, { skipRedirect: true });
    if (!saved) return;

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
      anamnesiStrutturata: useStructuredAnamnesi
        ? cleanAnamnesiStrutturata(
            pickCampiAttivi(anamnesiStrutturata, anamnesiConfig, visitData.tipo),
          )
        : undefined,
      ginecologia:
        visitData.tipo === "ginecologica" ||
        visitData.tipo === "ginecologica_pediatrica"
          ? ginecologiaData
          : undefined,
      ostetricia:
        visitData.tipo === "ostetrica"
          ? {
              ...ostetriciaData,
              flussimetriaOmbelicale: ostetriciaData.flussimetriaOmbelicale
                ? {
                    ...ostetriciaData.flussimetriaOmbelicale,
                    piPercentile:
                      flussimetriaCalcoli?.piPercentile ??
                      ostetriciaData.flussimetriaOmbelicale.piPercentile,
                    riPercentile:
                      flussimetriaCalcoli?.riPercentile ??
                      ostetriciaData.flussimetriaOmbelicale.riPercentile,
                  }
                : undefined,
            }
          : undefined,
      createdAt: existingVisit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const imageCount =
      visitData.tipo === "ginecologica" ||
      visitData.tipo === "ginecologica_pediatrica"
        ? (currentVisit.ginecologia?.ecografiaImmagini?.length ?? 0)
        : (currentVisit.ostetricia?.ecografiaImmagini?.length ?? 0);

    let includeEcografiaImages = false;
    if (imageCount > 0) {
      includeEcografiaImages = await askIncludeEcografiaImages(imageCount);
    }

    let includeFetalGrowthChart = false;
    if (visitData.tipo === "ostetrica") {
      includeFetalGrowthChart = await askIncludeFetalGrowthChart();
    }

    let fetalGrowthDataPoints:
      | { gaWeeks: number; pesoGrammi: number }[]
      | undefined;
    if (visitData.tipo === "ostetrica" && includeFetalGrowthChart) {
      const allVisits = await VisitService.getVisitsByPatientId(patient.id);
      // Solo visite fino a questa (inclusa) e stessa gravidanza (stessa LMP): tabelle/grafici si resettano per nuova gravidanza
      const fino = allVisits.filter(
        (v) =>
          v.tipo === "ostetrica" &&
          new Date(v.dataVisita).getTime() <=
            new Date(currentVisit.dataVisita).getTime(),
      );
      const stessaGravidanza = getVisitsOfSamePregnancy(fino, currentVisit);
      fetalGrowthDataPoints = getFetalGrowthDataPointsFromVisits(
        stessaGravidanza,
        fetalFormula,
      );
    } else {
      fetalGrowthDataPoints = undefined;
    }

    setPdfLoading(true);
    try {
      const blob =
        visitData.tipo === "ginecologica" ||
        visitData.tipo === "ginecologica_pediatrica"
          ? await PdfService.generateGynecologicalPDF(patient, currentVisit, {
              includeEcografiaImages,
            })
          : await PdfService.generateObstetricPDF(patient, currentVisit, {
              includeEcografiaImages,
              includeFetalGrowthChart,
              fetalGrowthDataPoints,
            });
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
        // La guida di primo avvio aspetta il referto aperto per andare avanti.
        window.dispatchEvent(new CustomEvent(EVENTO_REFERTO_APERTO));
        showToast("PDF aperto nell'app predefinita. Usa Stampa da lì.");
      } else {
        const pdfUrl = URL.createObjectURL(blob);
        const w = window.open(pdfUrl, "_blank");
        window.dispatchEvent(new CustomEvent(EVENTO_REFERTO_APERTO));
        if (w) {
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
        } else {
          const filename =
            visitData.tipo === "ginecologica" ||
            visitData.tipo === "ginecologica_pediatrica"
              ? `Ginecologia_${patient.cognome}_${currentVisit.dataVisita}.pdf`
              : `Ostetricia_${patient.cognome}_${currentVisit.dataVisita}.pdf`;
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

  const handleInputChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    if (field === "tipo") {
      setCopiedPreviousType(null);
    }
    setVisitData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnamnesiStrutturataChange = (
    field: string,
    value: string,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setAnamnesiStrutturata((prev) => ({ ...prev, [field]: value }));
  };

  const applyAnamnesiTemplate = (field: string, text: string) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setAnamnesiStrutturata((prev) => ({
      ...prev,
      [field]: prev[field] ? `${prev[field]}\n${text}` : text,
    }));
  };

  const handleGinecologiaChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    let nextValue = value;
    if (OBSTETRIC_COUNT_FIELDS.has(field)) {
      nextValue = clampObstetricCount(Number(value) || 0);
    }
    setGinecologiaData((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleOstetriciaChange = (field: string, value: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);

    if (OBSTETRIC_COUNT_FIELDS.has(field)) {
      const clamped = clampObstetricCount(Number(value) || 0);
      setOstetriciaData((prev) => ({ ...prev, [field]: clamped }));
      return;
    }

    if (field === "settimaneGestazione") {
      const newGa = parseGestationalWeeks((value as string) ?? "");
      setOstetriciaData((prev) => {
        const bio = prev.biometriaFetale;
        if (newGa == null || !bio) return { ...prev, [field]: value };
        const pctKeyMap = {
          bpdMm: "bpdPercentile",
          hcMm: "hcPercentile",
          acMm: "acPercentile",
          flMm: "flPercentile",
        } as const;
        const bioUpdates: Record<string, number | undefined> = {};
        (Object.keys(pctKeyMap) as Array<keyof typeof pctKeyMap>).forEach(
          (measField) => {
            const measVal = bio[measField];
            if (measVal && measVal > 0) {
              const p = getBiometryPercentile(measVal, newGa, measField);
              bioUpdates[pctKeyMap[measField]] =
                p != null ? Math.round(p) : undefined;
            }
          },
        );
        bioUpdates["efwPercentile"] = undefined;
        return {
          ...prev,
          [field]: value,
          biometriaFetale: { ...bio, ...bioUpdates },
        };
      });
      return;
    }

    setOstetriciaData((prev) => ({ ...prev, [field]: value }));
  };

  const liveOstetriciaWeight = (
    field: "pesoPreGravidanza" | "pesoAttuale",
    raw: string,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const live = parseWeightFieldLive(raw);
    if (live === "incomplete") {
      if (raw === "" || raw === ".") {
        setOstetriciaData((prev) => ({ ...prev, [field]: 0 }));
      }
      return;
    }
    setOstetriciaData((prev) => ({ ...prev, [field]: live }));
  };

  const commitOstetriciaWeight = (
    field: "pesoPreGravidanza" | "pesoAttuale",
    raw: string,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setOstetriciaData((prev) => ({
      ...prev,
      [field]: parseWeightFieldBlur(raw),
    }));
  };

  const liveGinecologiaWeight = (raw: string) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const live = parseWeightFieldLive(raw);
    if (live === "incomplete") {
      if (raw === "" || raw === ".") {
        setGinecologiaData((prev) => ({ ...prev, pesoCorporeo: 0 }));
      }
      return;
    }
    setGinecologiaData((prev) => ({ ...prev, pesoCorporeo: live }));
  };

  const commitGinecologiaWeight = (raw: string) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setGinecologiaData((prev) => ({
      ...prev,
      pesoCorporeo: parseWeightFieldBlur(raw),
    }));
  };

  const liveGinecologiaLabValue = (
    field: keyof typeof HOMA_FIELD_MAX,
    raw: string,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const live = parseLabValueLive(raw);
    if (live === "incomplete") {
      if (raw === "" || raw === ".") {
        setGinecologiaData((prev) => ({ ...prev, [field]: 0 }));
      }
      return;
    }
    setGinecologiaData((prev) => ({ ...prev, [field]: live }));
  };

  const commitGinecologiaLabValue = (
    field: keyof typeof HOMA_FIELD_MAX,
    raw: string,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setGinecologiaData((prev) => ({
      ...prev,
      [field]: parseLabValueBlur(raw, HOMA_FIELD_MAX[field]),
    }));
  };

  const persistPatientAltezzaIfNeeded = async (
    heightCm: number | undefined,
  ): Promise<boolean> => {
    if (!patient || heightCm == null || heightCm <= 0) return false;
    if (patient.altezza != null && patient.altezza > 0) return false;
    const valid = parseOptionalHeight(String(heightCm));
    if (valid == null) return false;
    try {
      await PatientService.updatePatient(patient.id, {
        altezza: valid,
        updatedAt: new Date().toISOString(),
      });
      setPatient((prev) => (prev ? { ...prev, altezza: valid } : prev));
      setAltezzaPendingInput("");
      return true;
    } catch (e) {
      console.error("Errore salvataggio altezza paziente:", e);
      showToast("Errore durante il salvataggio dell'altezza", "error");
      return false;
    }
  };

  const handleSaveAltezza = async () => {
    const raw = altezzaPendingInput.trim();
    if (!raw) {
      showToast("Inserisci l'altezza in cm", "error");
      return;
    }
    const valid = parseOptionalHeight(raw);
    if (valid == null) {
      showToast(
        `Altezza non valida (${MIN_HEIGHT_CM}–${MAX_HEIGHT_CM} cm)`,
        "error",
      );
      return;
    }
    setSavingAltezza(true);
    try {
      const saved = await persistPatientAltezzaIfNeeded(valid);
      if (saved) showToast("Altezza salvata nella scheda paziente");
    } finally {
      setSavingAltezza(false);
    }
  };

  /** CRL al momento del focus: all'uscita dal campo si data solo se è cambiato. */
  const crlAtFocus = useRef<number | undefined>(undefined);

  const handleCrlChange = (value: string) => {
    // Il CRL si misura al decimo di mm: parseInt troncava "62.4" a 62
    const parsed = parseFloat(value.replace(",", "."));
    const num = Number.isFinite(parsed) ? parsed : undefined;
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setOstetriciaData((prev) => ({ ...prev, crlMm: num }));
  };

  /**
   * Datazione da CRL (Robinson) all'uscita dal campo, non a ogni tasto:
   * digitando "45" il passaggio da "4" ridatava a 5+4 e falsava il confronto.
   * Settimane e DPP cambiano solo oltre la soglia ACOG.
   */
  const applyCrlDating = () => {
    const crl = ostetriciaData.crlMm;
    if (crl == null || crl === crlAtFocus.current) return;
    const gaDays = gestationalDaysFromCrl(crl);
    if (gaDays == null) return;
    const newSettimane = `${Math.floor(gaDays / 7)}+${gaDays % 7}`;
    const currentWeeksDec = parseGestationalWeeks(
      ostetriciaData.settimaneGestazione ?? "",
    );
    if (currentWeeksDec != null) {
      const currentGaDays = Math.round(currentWeeksDec * 7);
      const diffDays = Math.abs(gaDays - currentGaDays);
      const soglia = crlRedatingThresholdDays(currentGaDays);
      if (diffDays <= soglia) {
        showToast(
          `CRL ${crl} mm = ${newSettimane}: scarto di ${diffDays} giorni, entro la soglia di ${soglia}. Datazione invariata.`,
          "info",
        );
        return;
      }
    }
    const next = { ...ostetriciaData, settimaneGestazione: newSettimane };
    const visitDate = parseISO(visitData.dataVisita);
    if (isValid(visitDate)) {
      const edd = subDays(visitDate, gaDays);
      const dpp = addDays(edd, 280);
      next.dataPresunta = format(dpp, "yyyy-MM-dd");
    }
    // Ricalcola percentili biometria con la nuova GA
    const newGaDec = gaDays / 7;
    const bio = next.biometriaFetale;
    if (bio) {
      const pctKeyMap = {
        bpdMm: "bpdPercentile",
        hcMm: "hcPercentile",
        acMm: "acPercentile",
        flMm: "flPercentile",
      } as const;
      const bioUpdates: Record<string, number | undefined> = {};
      (Object.keys(pctKeyMap) as Array<keyof typeof pctKeyMap>).forEach(
        (measField) => {
          const measVal = bio[measField];
          if (measVal && measVal > 0) {
            const p = getBiometryPercentile(measVal, newGaDec, measField);
            bioUpdates[pctKeyMap[measField]] =
              p != null ? Math.round(p) : undefined;
          }
        },
      );
      bioUpdates["efwPercentile"] = undefined;
      next.biometriaFetale = { ...bio, ...bioUpdates };
    }
    setOstetriciaData((prev) => ({
      ...prev,
      settimaneGestazione: next.settimaneGestazione,
      dataPresunta: next.dataPresunta,
      biometriaFetale: next.biometriaFetale,
    }));
    const oldSett = ostetriciaData.settimaneGestazione || "—";
    const oldDpp = ostetriciaData.dataPresunta
      ? format(parseISO(ostetriciaData.dataPresunta), "dd/MM/yyyy")
      : "—";
    showToast(
      `In base al CRL (${crl} mm): settimane da ${oldSett} a ${newSettimane}; data presunta parto da ${oldDpp} a ${next.dataPresunta ? format(parseISO(next.dataPresunta), "dd/MM/yyyy") : "—"}.`,
      "warning",
    );
  };

  const handleBiometriaFetaleChange = (
    field: "bpdMm" | "hcMm" | "acMm" | "flMm",
    value: number,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);

    // Calcola il percentile automatico se abbiamo GA
    let autoPct: number | undefined = undefined;
    const ga = parseGestationalWeeks(ostetriciaData.settimaneGestazione ?? "");
    if (ga != null && value > 0 && value <= BIOMETRIA_MAX_MM[field]) {
      const p = getBiometryPercentile(value, ga, field);
      if (p != null) autoPct = Math.round(p);
    }

    const pctKeyMap: Record<string, string> = {
      bpdMm: "bpdPercentile",
      hcMm: "hcPercentile",
      acMm: "acPercentile",
      flMm: "flPercentile",
    };
    const pctKey = pctKeyMap[field];

    setOstetriciaData((prev) => ({
      ...prev,
      biometriaFetale: {
        ...(prev.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }),
        [field]: value,
        ...(pctKey ? { [pctKey]: autoPct } : {}),
      },
    }));
  };

  const handleBiometriaPercentileChange = (
    field: "bpdMm" | "hcMm" | "acMm" | "flMm",
    value: number | undefined,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const pctKeyMap: Record<string, string> = {
      bpdMm: "bpdPercentile",
      hcMm: "hcPercentile",
      acMm: "acPercentile",
      flMm: "flPercentile",
    };
    const pctKey = pctKeyMap[field];
    if (!pctKey) return;

    setOstetriciaData((prev) => ({
      ...prev,
      biometriaFetale: {
        ...(prev.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }),
        [pctKey]: value,
      },
    }));
  };

  const handleEfwPercentileChange = (value: number | undefined) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setOstetriciaData((prev) => ({
      ...prev,
      biometriaFetale: {
        ...(prev.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }),
        efwPercentile: value,
      },
    }));
  };

  const handleFlussimetriaOmbelicaleChange = (
    field: "pi" | "ri",
    value: number | undefined,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);

    // Calcolo automatico percentile
    let autoPct: number | undefined = undefined;
    const ga = parseGestationalWeeks(ostetriciaData.settimaneGestazione ?? "");

    if (ga != null && value != null && value > 0) {
      if (field === "pi") {
        const p = getUmbilicalPiPercentile(value, ga);
        if (p != null) autoPct = Math.round(p);
      } else if (field === "ri") {
        const p = getUmbilicalRiPercentile(value, ga);
        if (p != null) autoPct = Math.round(p);
      }
    }

    const pctKey = field === "pi" ? "piPercentile" : "riPercentile";

    setOstetriciaData((prev) => ({
      ...prev,
      flussimetriaOmbelicale: {
        ...(prev.flussimetriaOmbelicale ?? {}),
        [field]: value,
        ...(value !== undefined ? { [pctKey]: autoPct } : {}),
      },
    }));
  };

  const handleFlussimetriaPercentileChange = (
    field: "pi" | "ri",
    value: number | undefined,
  ) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const pctKey = field === "pi" ? "piPercentile" : "riPercentile";

    setOstetriciaData((prev) => ({
      ...prev,
      flussimetriaOmbelicale: {
        ...(prev.flussimetriaOmbelicale ?? {}),
        [pctKey]: value,
      },
    }));
  };

  const flussimetriaCalcoli = useMemo(
    () => computeFlussimetriaCalcoliSnapshot(ostetriciaData),
    [
      ostetriciaData.flussimetriaOmbelicale?.pi,
      ostetriciaData.flussimetriaOmbelicale?.ri,
      ostetriciaData.flussimetriaOmbelicale?.psv,
      ostetriciaData.flussimetriaOmbelicale?.edv,
      ostetriciaData.flussimetriaOmbelicale?.velocitaMedia,
      ostetriciaData.settimaneGestazione,
    ],
  );

  const scalePesoFetale = useMemo(() => {
    const b = ostetriciaData.biometriaFetale ?? {
      bpdMm: 0,
      hcMm: 0,
      acMm: 0,
      flMm: 0,
    };
    // Una misura fuori scala (il campo e' gia' in rosso) non entra nella
    // stima: si vedrebbe un peso di decine di chili.
    const credibile = (campo: keyof typeof BIOMETRIA_MAX_MM) =>
      b[campo] > BIOMETRIA_MAX_MM[campo] ? 0 : b[campo];
    return calcolaStimePesoFetale({
      ...b,
      bpdMm: credibile("bpdMm"),
      hcMm: credibile("hcMm"),
      acMm: credibile("acMm"),
      flMm: credibile("flMm"),
    });
  }, [
    ostetriciaData.biometriaFetale?.bpdMm,
    ostetriciaData.biometriaFetale?.hcMm,
    ostetriciaData.biometriaFetale?.acMm,
    ostetriciaData.biometriaFetale?.flMm,
  ]);

  const handleNavigateCronologia = () => {
    guardAction(() => navigate(`/patient-history/${patient?.id}`));
  };

  /**
   * Sezione "1. Anamnesi" del referto. Renderizza la modalità strutturata
   * (sotto-campi familiare/fisiologica/patologica/farmacologica/allergica/partner,
   * condivisi tra i tipi di visita) oppure quella singola a testo libero legata
   * a `prestazione`, secondo la preferenza. In strutturata il selettore di modelli
   * resta legato alla modalità singola, così i template esistenti non si rompono.
   */
  const renderAnamnesiSection = (
    templateCategory: "ginecologia" | "ostetricia",
    prestazione: string,
    onPrestazioneChange: (value: string) => void,
    prestazioneTemplates: MedicalTemplate[],
    applyPrestazioneTemplate: (text: string) => void,
  ) => (
    <div className="space-y-2 relative">
      <div className="flex justify-between items-end mb-1">
        <label className="text-sm font-bold text-gray-700">2. Anamnesi</label>
        {!useStructuredAnamnesi && (
          <TemplateSelector
            templates={prestazioneTemplates}
            onSelect={applyPrestazioneTemplate}
          />
        )}
      </div>
      {useStructuredAnamnesi ? (
        <div className="space-y-3">
          {campiAnamnesiAttivi.map(
            ({ key, label, placeholder, minRows, optional, templateSection }, idx) => {
              const fieldTemplates = allTemplates.filter(
                (t) =>
                  t.category === templateCategory &&
                  t.section === templateSection,
              );
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-semibold text-gray-500">
                      {`1.${idx + 1} ${label}`}
                      {optional ? " (facoltativa)" : ""}
                    </label>
                    {fieldTemplates.length > 0 && (
                      <TemplateSelector
                        templates={fieldTemplates}
                        onSelect={(t) => applyAnamnesiTemplate(key, t)}
                      />
                    )}
                  </div>
                  <RefertoTextarea
                    value={anamnesiStrutturata[key] ?? ""}
                    onValueChange={(value) =>
                      handleAnamnesiStrutturataChange(key, value)
                    }
                    variant="bordered"
                    minRows={minRows}
                    placeholder={placeholder}
                  />
                </div>
              );
            },
          )}
        </div>
      ) : (
        <RefertoTextarea
          value={prestazione}
          onValueChange={onPrestazioneChange}
          variant="bordered"
          minRows={3}
          placeholder="Nega patologie di rilievo, nega terapia in atto..."
        />
      )}
    </div>
  );

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

  const hasPreviousVisitForCurrentType =
    visitData.tipo === "ginecologica" ||
    visitData.tipo === "ginecologica_pediatrica" ||
    visitData.tipo === "ostetrica"
      ? Boolean(
          getPreviousVisitByType(
            visitData.tipo as
              | "ginecologica"
              | "ginecologica_pediatrica"
              | "ostetrica",
          ),
        )
      : false;
  const canCopyOrClear =
    hasPreviousVisitForCurrentType || copiedPreviousType === visitData.tipo;

  const showPediatricTab =
    isPediatricVisitEnabled || visitData.tipo === "ginecologica_pediatrica";

  return (
    <div className="corioli-page space-y-6 pb-12">
      {/* Barra della visita, come in Corioli Cardiologia: prende il posto di
          navbar, briciole, scheda della paziente e della pillola in basso con
          Annulla/Stampa/Salva. La pillola galleggiava sopra il referto e a
          1366x768 copriva il fondo della biometria (la riga del peso fetale)
          e i campi sotto il punto in cui si scriveva. Qui sta ferma in alto,
          con su chi si sta visitando e le azioni. */}
      <div className="sticky top-[calc(1.5rem_+_var(--titlebar-h))] z-40">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-default-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md"
          data-guida="barra-visita"
        >
          <Button
            isIconOnly
            variant="light"
            aria-label="Torna alla scheda della paziente"
            title="Torna alla scheda della paziente"
            onPress={handleNavigateCronologia}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-default-600">
              {isEditMode ? "Modifica visita" : "Nuova visita"}
              {hasUnsavedChanges && (
                <span className="ml-1 font-medium text-warning-700">
                  · modifiche non salvate
                </span>
              )}
            </p>
            <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-gray-900">
              <span className="truncate">
                {patient.nome} {patient.cognome}
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm font-normal text-default-600">
                {calculateAge(patient.dataNascita) != null &&
                  `${calculateAge(patient.dataNascita)} anni`}
                {patient.codiceFiscale && (
                  <>
                    {calculateAge(patient.dataNascita) != null && " · "}
                    <CodiceFiscaleValue
                      value={patient.codiceFiscale}
                      generatedFromImport={Boolean(patient.codiceFiscaleGenerato)}
                    />
                  </>
                )}
              </span>
            </h1>
          </div>
          <Input
            type="date"
            label="Data"
            value={visitData.dataVisita}
            onValueChange={(value) => handleInputChange("dataVisita", value)}
            max={todayIsoDate()}
            variant="bordered"
            size="sm"
            labelPlacement="outside-left"
            className="w-auto"
            classNames={{
              label: "text-default-600 font-medium whitespace-nowrap",
              input: "bg-transparent",
              inputWrapper:
                "border-default-300 hover:border-primary focus-within:border-primary min-w-[140px]",
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="light"
              onPress={handleNavigateCronologia}
              className="text-default-700"
            >
              Annulla
            </Button>
            {/* Col bordo: in grigio pieno accanto a "Salva Visita" sembrava
                un pulsante disattivato. */}
            <Button
              color="primary"
              variant="bordered"
              onPress={handlePrintPdf}
              data-guida="stampa-visita"
              isLoading={pdfLoading}
              isDisabled={loading || pdfLoading}
              startContent={!pdfLoading ? <Printer size={18} /> : undefined}
            >
              {pdfLoading ? "Preparazione..." : "Stampa"}
            </Button>
            <Button
              onPress={() => handleSubmit()}
              data-guida="salva-visita"
              color="primary"
              className="font-semibold"
              isLoading={loading}
              isDisabled={loading}
              startContent={!loading ? <Save size={18} /> : undefined}
            >
              {loading ? "Salvataggio..." : "Salva Visita"}
            </Button>
          </div>
        </div>
      </div>

      {bozzaTrovata && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-300 bg-warning-50 px-4 py-3"
        >
          <p className="text-sm text-warning-900">
            <span className="font-semibold">Visita non salvata ritrovata.</span>{" "}
            Bozza del{" "}
            {new Date(bozzaTrovata.salvataIl).toLocaleString("it-IT", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            : l'app si è chiusa prima del salvataggio. Le immagini dell'ecografia non sono nella bozza.
          </p>
          <div className="flex gap-2">
            <Button size="lg" variant="light" onPress={scartaBozza}>
              Scarta
            </Button>
            <Button size="lg" color="warning" onPress={riprendiBozza}>
              Riprendi la bozza
            </Button>
          </div>
        </div>
      )}

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
              {copiedPreviousType === visitData.tipo
                ? "Svuota campi"
                : "Copia visita precedente"}
            </Button>
          </div>
        )}

        {/* `data-guida`: la guida di primo avvio fa scegliere la visita ostetrica. */}
        <div data-guida="schede-visita">
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
            tabContent:
              "group-data-[selected=true]:text-primary group-data-[selected=true]:font-bold text-gray-500 font-medium",
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
                          <ul className="list-disc list-inside space-y-1">
                            {errs.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}

                    {/* Ultima Mestruazione */}
                    <Input
                      type="date"
                      label="Ultima Mestruazione"
                      value={ginecologiaData.ultimaMestruazione}
                      onValueChange={(value) =>
                        handleGinecologiaChange("ultimaMestruazione", value)
                      }
                      max={visitData.dataVisita || todayIsoDate()}
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
                        placeholder="0"
                        value={
                          ginecologiaData.gravidanze === 0
                            ? ""
                            : String(ginecologiaData.gravidanze)
                        }
                        onValueChange={(v) =>
                          handleGinecologiaChange(
                            "gravidanze",
                            parseInt(v) || 0,
                          )
                        }
                        variant="bordered"
                        size="sm"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                      <Input
                        type="number"
                        label="Parti"
                        placeholder="0"
                        value={
                          ginecologiaData.parti === 0
                            ? ""
                            : String(ginecologiaData.parti)
                        }
                        onValueChange={(v) =>
                          handleGinecologiaChange("parti", parseInt(v) || 0)
                        }
                        variant="bordered"
                        size="sm"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                      <Input
                        type="number"
                        label="Aborti"
                        placeholder="0"
                        value={
                          ginecologiaData.aborti === 0
                            ? ""
                            : String(ginecologiaData.aborti)
                        }
                        onValueChange={(v) =>
                          handleGinecologiaChange("aborti", parseInt(v) || 0)
                        }
                        variant="bordered"
                        size="sm"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        labelPlacement="outside"
                        classNames={{ input: "text-center font-semibold" }}
                      />
                    </div>

                    {/* Dettagli */}
                    <div className="bg-gray-50/80 p-4 rounded-xl border border-dashed border-gray-300">
                      <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">
                        Dettagli
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="PS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="0"
                          value={
                            (ginecologiaData.partiSpontanei ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.partiSpontanei ?? 0)
                          }
                          onValueChange={(v) =>
                            handleGinecologiaChange(
                              "partiSpontanei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="TC"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="0"
                          value={
                            (ginecologiaData.partiCesarei ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.partiCesarei ?? 0)
                          }
                          onValueChange={(v) =>
                            handleGinecologiaChange(
                              "partiCesarei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="AS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="0"
                          value={
                            (ginecologiaData.abortiSpontanei ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.abortiSpontanei ?? 0)
                          }
                          onValueChange={(v) =>
                            handleGinecologiaChange(
                              "abortiSpontanei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="IVG"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="0"
                          value={
                            (ginecologiaData.ivg ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.ivg ?? 0)
                          }
                          onValueChange={(v) =>
                            handleGinecologiaChange("ivg", parseInt(v) || 0)
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                      </div>
                    </div>

                    <Divider className="my-2" />

                    {/* Peso corporeo + BMI (stessa UI dell'ostetrica) */}
                    {patient != null &&
                      getAltezzaCmForBmi(patient) == null && (
                        <div className="mb-3 rounded-xl border border-dashed border-primary-200 bg-gradient-to-r from-primary-50/70 via-white to-primary-50/40 px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary">
                              <Ruler size={14} />
                            </div>
                            <p className="text-xs font-semibold text-primary-800">
                              Inserisci l&apos;altezza (cm) per calcolare il BMI
                            </p>
                          </div>
                          <div className="flex w-full flex-col gap-2">
                            <Input
                              aria-label="Altezza in cm"
                              type="text"
                              inputMode="numeric"
                              size="sm"
                              variant="bordered"
                              placeholder="Es. 165"
                              className="w-full"
                              classNames={{ base: "w-full" }}
                              value={altezzaPendingInput}
                              onValueChange={(v) => {
                                if (!isValidHeightInputDraft(v)) return;
                                setAltezzaPendingInput(v);
                              }}
                            />
                            <Button
                              size="sm"
                              color="primary"
                              className="corioli-cta w-full"
                              isLoading={savingAltezza}
                              onPress={() => void handleSaveAltezza()}
                            >
                              Salva
                            </Button>
                          </div>
                        </div>
                      )}

                    <div className="flex flex-col sm:flex-row items-end gap-3 w-full">
                      <Input
                        label="Peso corporeo (kg)"
                        type="text"
                        inputMode="decimal"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={
                          pesoCorporeoDraft ??
                          (ginecologiaData.pesoCorporeo === 0
                            ? ""
                            : ginecologiaData.pesoCorporeo.toString())
                        }
                        onFocus={() => {
                          setPesoCorporeoDraft(
                            ginecologiaData.pesoCorporeo > 0
                              ? ginecologiaData.pesoCorporeo.toString()
                              : "",
                          );
                        }}
                        onBlur={() => {
                          if (pesoCorporeoDraft !== null) {
                            commitGinecologiaWeight(pesoCorporeoDraft);
                          }
                          setPesoCorporeoDraft(null);
                        }}
                        onValueChange={(v) => {
                          if (!isValidWeightInputDraft(v)) return;
                          setPesoCorporeoDraft(v);
                          liveGinecologiaWeight(v);
                        }}
                        placeholder="Es. 65"
                        className="flex-1"
                        classNames={{ label: "pb-1" }}
                      />

                      {/* Indicatore BMI: valore, fascia OMS e colore della fascia */}
                      {(() => {
                        const bmi = computeBmi(
                          ginecologiaData.pesoCorporeo,
                          getAltezzaCmForBmi(patient),
                        );
                        if (bmi == null) return null;
                        return (
                          <div className="flex flex-col items-center justify-end pb-1 px-1.5">
                            <MetabolicChip
                              sigla="BMI"
                              valore={formatBmi(bmi)}
                              band={bmiBand(bmi)}
                              title="Indice di massa corporea (classificazione OMS)"
                            />
                          </div>
                        );
                      })()}
                    </div>

                    <Divider className="my-2" />

                    {/* HOMA-IR: indice di insulino-resistenza (utile nella PCOS) */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        HOMA-IR (a digiuno)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Glicemia (mg/dL)"
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="Es. 88"
                          value={
                            homaDraft.glicemia ??
                            ((ginecologiaData.glicemiaDigiuno ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.glicemiaDigiuno))
                          }
                          onFocus={() => {
                            setHomaDraft((d) => ({
                              ...d,
                              glicemia:
                                (ginecologiaData.glicemiaDigiuno ?? 0) > 0
                                  ? String(ginecologiaData.glicemiaDigiuno)
                                  : "",
                            }));
                          }}
                          onBlur={() => {
                            if (homaDraft.glicemia !== null) {
                              commitGinecologiaLabValue(
                                "glicemiaDigiuno",
                                homaDraft.glicemia,
                              );
                            }
                            setHomaDraft((d) => ({ ...d, glicemia: null }));
                          }}
                          onValueChange={(v) => {
                            if (!isValidDecimalInputDraft(v)) return;
                            setHomaDraft((d) => ({ ...d, glicemia: v }));
                            liveGinecologiaLabValue("glicemiaDigiuno", v);
                          }}
                          classNames={{ label: "pb-1" }}
                        />
                        <Input
                          label="Insulinemia (µU/mL)"
                          type="text"
                          inputMode="decimal"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          placeholder="Es. 9.5"
                          value={
                            homaDraft.insulinemia ??
                            ((ginecologiaData.insulinemiaDigiuno ?? 0) === 0
                              ? ""
                              : String(ginecologiaData.insulinemiaDigiuno))
                          }
                          onFocus={() => {
                            setHomaDraft((d) => ({
                              ...d,
                              insulinemia:
                                (ginecologiaData.insulinemiaDigiuno ?? 0) > 0
                                  ? String(ginecologiaData.insulinemiaDigiuno)
                                  : "",
                            }));
                          }}
                          onBlur={() => {
                            if (homaDraft.insulinemia !== null) {
                              commitGinecologiaLabValue(
                                "insulinemiaDigiuno",
                                homaDraft.insulinemia,
                              );
                            }
                            setHomaDraft((d) => ({ ...d, insulinemia: null }));
                          }}
                          onValueChange={(v) => {
                            if (!isValidDecimalInputDraft(v)) return;
                            setHomaDraft((d) => ({ ...d, insulinemia: v }));
                            liveGinecologiaLabValue("insulinemiaDigiuno", v);
                          }}
                          classNames={{ label: "pb-1" }}
                        />
                      </div>
                      {(() => {
                        const homa = computeHomaIr(
                          ginecologiaData.glicemiaDigiuno,
                          ginecologiaData.insulinemiaDigiuno,
                        );
                        if (homa == null) {
                          return (
                            <p className="text-[11px] text-default-400">
                              Inserisci entrambi i valori per calcolare
                              l&apos;HOMA-IR.
                            </p>
                          );
                        }
                        return (
                          <div className="flex justify-center">
                            <MetabolicChip
                              sigla="HOMA-IR"
                              valore={formatHomaIr(homa)}
                              band={homaIrBand(homa)}
                              title="glicemia x insulinemia / 405 - soglie orientative: <2 normale, 2-2.5 borderline, 2.5-5 insulino-resistenza, >5 marcata"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Ecografia
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {(ginecologiaData.ecografiaImmagini ?? []).length}/20
                        immagini
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
                          handleEcografiaImagesUpload(
                            "ginecologia",
                            e.target.files,
                          );
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {(ginecologiaData.ecografiaImmagini ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {(ginecologiaData.ecografiaImmagini ?? []).map(
                          (image, idx) => (
                            <div
                              key={`gyn-eco-${idx}`}
                              className="relative group border rounded-lg overflow-hidden bg-gray-50"
                            >
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
                                onClick={() =>
                                  handleRemoveEcografiaImage("ginecologia", idx)
                                }
                                aria-label="Rimuovi immagine ecografia"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ),
                        )}
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
                    {/* Sezione 1: Descrizione */}
                    <div className="space-y-2 group">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        1. Descrizione Problema / Dati Clinici
                      </label>
                      <RefertoTextarea
                        value={ginecologiaData.problemaClinico}
                        onValueChange={(value) =>
                          handleGinecologiaChange("problemaClinico", value)
                        }
                        variant="bordered"
                        minRows={3}
                        placeholder="La paziente riferisce..."
                      />
                    </div>

                    {/* Sezione 2: Anamnesi */}
                    {renderAnamnesiSection(
                      "ginecologia",
                      ginecologiaData.prestazione,
                      (value) => handleGinecologiaChange("prestazione", value),
                      allTemplates.filter(
                        (t) =>
                          t.category === "ginecologia" &&
                          t.section === "prestazione",
                      ),
                      (t) =>
                        handleTemplateSelect("ginecologia", "prestazione", t),
                    )}

                    {/* Sezione 3: Esame Obiettivo */}
                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">
                          3. Visita / Ecografia Office
                        </label>
                        <TemplateSelector
                          templates={allTemplates.filter(
                            (t) =>
                              t.category === "ginecologia" &&
                              t.section === "esameObiettivo",
                          )}
                          onSelect={(t) =>
                            handleTemplateSelect(
                              "ginecologia",
                              "esameBimanuale",
                              t,
                            )
                          }
                        />
                      </div>
                      <RefertoTextarea
                        value={ginecologiaData.esameBimanuale}
                        onValueChange={(value) =>
                          handleGinecologiaChange("esameBimanuale", value)
                        }
                        variant="bordered"
                        minRows={5}
                        placeholder="Esame bimanuale, speculum, ecografia TV office..."
                      />
                    </div>

                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">
                          4. Conclusioni e Terapie
                        </label>
                        <TemplateSelector
                          templates={allTemplates.filter(
                            (t) =>
                              (t.category === "ginecologia" &&
                                t.section === "conclusioni") ||
                              t.category === "terapie",
                          )}
                          onSelect={(t) =>
                            handleTemplateSelect(
                              "ginecologia",
                              "terapiaSpecifica",
                              t,
                            )
                          }
                        />
                      </div>
                      <RefertoTextarea
                        value={ginecologiaData.terapiaSpecifica}
                        onValueChange={(value) =>
                          handleGinecologiaChange("terapiaSpecifica", value)
                        }
                        variant="bordered"
                        minRows={3}
                        placeholder="Si consiglia..."
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </Tab>

          {showPediatricTab && (
            <Tab
              key="ginecologica_pediatrica"
              title="Visita Ginecologica Pediatrica"
            >
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
                        onValueChange={(value) =>
                          handleGinecologiaChange("menarca", value)
                        }
                        variant="bordered"
                        labelPlacement="outside"
                        placeholder="Eta o note (es. 12 anni)"
                      />

                      <Switch
                        isSelected={Boolean(ginecologiaData.vaccinazioneHPV)}
                        onValueChange={(checked) =>
                          handleGinecologiaChange("vaccinazioneHPV", checked)
                        }
                      >
                        Vaccinazione HPV
                      </Switch>

                      <Select
                        label="Stadio di Tanner (femmina)"
                        selectedKeys={
                          ginecologiaData.stadioTannerFemmina
                            ? [ginecologiaData.stadioTannerFemmina]
                            : []
                        }
                        onSelectionChange={(keys) =>
                          handleGinecologiaChange(
                            "stadioTannerFemmina",
                            String(Array.from(keys)[0] || ""),
                          )
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
                      Ecografia
                    </CardHeader>
                    <CardBody className="px-4 py-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {(ginecologiaData.ecografiaImmagini ?? []).length}/20
                          immagini
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
                            handleEcografiaImagesUpload(
                              "ginecologia",
                              e.target.files,
                            );
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      {(ginecologiaData.ecografiaImmagini ?? []).length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {(ginecologiaData.ecografiaImmagini ?? []).map(
                            (image, idx) => (
                              <div
                                key={`gyn-ped-eco-${idx}`}
                                className="relative group border rounded-lg overflow-hidden bg-gray-50"
                              >
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
                                  onClick={() =>
                                    handleRemoveEcografiaImage(
                                      "ginecologia",
                                      idx,
                                    )
                                  }
                                  aria-label="Rimuovi immagine ecografia"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ),
                          )}
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
                      {/* Sezione 1: Descrizione */}
                      <div className="space-y-2 group">
                        <label className="text-sm font-bold text-gray-700 block mb-1">
                          1. Descrizione Problema / Dati Clinici
                        </label>
                        <RefertoTextarea
                          value={ginecologiaData.problemaClinico}
                          onValueChange={(value) =>
                            handleGinecologiaChange("problemaClinico", value)
                          }
                          variant="bordered"
                          minRows={3}
                          placeholder="La paziente riferisce..."
                        />
                      </div>

                      {/* Sezione 2: Anamnesi */}
                      {renderAnamnesiSection(
                        "ginecologia",
                        ginecologiaData.prestazione,
                        (value) =>
                          handleGinecologiaChange("prestazione", value),
                        allTemplates.filter(
                          (t) =>
                            t.category === "ginecologia" &&
                            t.section === "prestazione",
                        ),
                        (t) =>
                          handleTemplateSelect("ginecologia", "prestazione", t),
                      )}

                      {/* Sezione 3: Esame Obiettivo */}
                      <div className="space-y-2 relative group">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-sm font-bold text-gray-700">
                            3. Visita / Ecografia Office
                          </label>
                          <TemplateSelector
                            templates={allTemplates.filter(
                              (t) =>
                                t.category === "ginecologia" &&
                                t.section === "esameObiettivo",
                            )}
                            onSelect={(t) =>
                              handleTemplateSelect(
                                "ginecologia",
                                "esameBimanuale",
                                t,
                              )
                            }
                          />
                        </div>
                        <RefertoTextarea
                          value={ginecologiaData.esameBimanuale}
                          onValueChange={(value) =>
                            handleGinecologiaChange("esameBimanuale", value)
                          }
                          variant="bordered"
                          minRows={5}
                          placeholder="Esame bimanuale, speculum, ecografia TV office..."
                        />
                      </div>

                      <div className="space-y-2 relative group">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-sm font-bold text-gray-700">
                            4. Conclusioni e Terapie
                          </label>
                          <TemplateSelector
                            templates={allTemplates.filter(
                              (t) =>
                                (t.category === "ginecologia" &&
                                  t.section === "conclusioni") ||
                                t.category === "terapie",
                            )}
                            onSelect={(t) =>
                              handleTemplateSelect(
                                "ginecologia",
                                "terapiaSpecifica",
                                t,
                              )
                            }
                          />
                        </div>
                        <RefertoTextarea
                          value={ginecologiaData.terapiaSpecifica}
                          onValueChange={(value) =>
                            handleGinecologiaChange("terapiaSpecifica", value)
                          }
                          variant="bordered"
                          minRows={3}
                          placeholder="Si consiglia..."
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
                    <div className="relative">
                      <Input
                        type="text"
                        label="Settimane di Gestazione"
                        value={ostetriciaData.settimaneGestazione}
                        onValueChange={(value) =>
                          handleOstetriciaChange("settimaneGestazione", value)
                        }
                        variant="bordered"
                        labelPlacement="outside"
                        placeholder="es. 22+3"
                        classNames={{ input: "text-base", label: "pb-1" }}
                      />
                      {suggestions.gestazione && (
                        <div className="absolute right-0 -top-1 z-10">
                          <Chip
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="cursor-pointer hover:bg-primary/20 h-6 px-1"
                            onClick={() =>
                              handleOstetriciaChange(
                                "settimaneGestazione",
                                suggestions.gestazione,
                              )
                            }
                          >
                            Suggerito: {suggestions.gestazione}
                          </Chip>
                        </div>
                      )}
                    </div>
                    <Input
                      type="date"
                      label="Ultima Mestruazione"
                      value={ostetriciaData.ultimaMestruazione}
                      onValueChange={(value) =>
                        handleOstetriciaChange("ultimaMestruazione", value)
                      }
                      max={visitData.dataVisita || todayIsoDate()}
                      variant="bordered"
                      labelPlacement="outside"
                      classNames={{ input: "text-base", label: "pb-1" }}
                    />
                    <div className="relative">
                      <Input
                        type="date"
                        label="Data Presunta Parto"
                        value={ostetriciaData.dataPresunta}
                        onValueChange={(value) =>
                          handleOstetriciaChange("dataPresunta", value)
                        }
                        variant="bordered"
                        labelPlacement="outside"
                        classNames={{ input: "text-base", label: "pb-1" }}
                      />
                      {suggestions.dpp && (
                        <div className="absolute right-0 -top-1 z-10">
                          <Chip
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="cursor-pointer hover:bg-primary/20 h-6 px-1"
                            onClick={() =>
                              handleOstetriciaChange(
                                "dataPresunta",
                                suggestions.dpp,
                              )
                            }
                          >
                            Suggerito:{" "}
                            {format(parseISO(suggestions.dpp), "dd/MM/yyyy")}
                          </Chip>
                        </div>
                      )}
                    </div>
                    <Select
                      label="Modalità di concepimento"
                      placeholder="Seleziona"
                      variant="bordered"
                      labelPlacement="outside"
                      selectedKeys={
                        ostetriciaData.modalitaConcepimento
                          ? [ostetriciaData.modalitaConcepimento]
                          : []
                      }
                      onSelectionChange={(keys) =>
                        handleOstetriciaChange(
                          "modalitaConcepimento",
                          (Array.from(keys)[0] as string) ?? "",
                        )
                      }
                      classNames={{ label: "pb-1" }}
                    >
                      <SelectItem key="spontaneo" value="spontaneo">
                        Spontaneo
                      </SelectItem>
                      <SelectItem key="fivet" value="fivet">
                        FIVET
                      </SelectItem>
                      <SelectItem key="icsi" value="icsi">
                        ICSI
                      </SelectItem>
                      <SelectItem key="iui" value="iui">
                        IUI / Inseminazione
                      </SelectItem>
                      <SelectItem
                        key="donazione_ovociti"
                        value="donazione_ovociti"
                      >
                        Donazione ovociti
                      </SelectItem>
                      <SelectItem key="altra" value="altra">
                        Altra
                      </SelectItem>
                    </Select>

                    <Divider className="my-2" />

                    {patient != null && getAltezzaCmForBmi(patient) == null && (
                      <div className="mb-3 rounded-xl border border-dashed border-primary-200 bg-gradient-to-r from-primary-50/70 via-white to-primary-50/40 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary">
                            <Ruler size={14} />
                          </div>
                          <p className="text-xs font-semibold text-primary-800">
                            Inserisci l&apos;altezza (cm) per calcolare il BMI
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2">
                          <Input
                            aria-label="Altezza in cm"
                            type="text"
                            inputMode="numeric"
                            size="sm"
                            variant="bordered"
                            placeholder="Es. 165"
                            className="w-full"
                            classNames={{ base: "w-full" }}
                            value={altezzaPendingInput}
                            onValueChange={(v) => {
                              if (!isValidHeightInputDraft(v)) return;
                              setAltezzaPendingInput(v);
                            }}
                          />
                          <Button
                            size="sm"
                            color="primary"
                            className="corioli-cta w-full"
                            isLoading={savingAltezza}
                            onPress={() => void handleSaveAltezza()}
                          >
                            Salva
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-end gap-3 w-full">
                      <Input
                        label="Peso Pre gravidanza (kg)"
                        type="text"
                        inputMode="decimal"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={
                          pesoInputDraft.pre ??
                          (ostetriciaData.pesoPreGravidanza === 0
                            ? ""
                            : ostetriciaData.pesoPreGravidanza.toString())
                        }
                        onFocus={() => {
                          setPesoInputDraft((d) => ({
                            ...d,
                            pre:
                              ostetriciaData.pesoPreGravidanza > 0
                                ? ostetriciaData.pesoPreGravidanza.toString()
                                : "",
                          }));
                        }}
                        onBlur={() => {
                          if (pesoInputDraft.pre !== null) {
                            commitOstetriciaWeight(
                              "pesoPreGravidanza",
                              pesoInputDraft.pre,
                            );
                          }
                          setPesoInputDraft((d) => ({ ...d, pre: null }));
                        }}
                        onValueChange={(v) => {
                          if (!isValidWeightInputDraft(v)) return;
                          setPesoInputDraft((d) => ({ ...d, pre: v }));
                          liveOstetriciaWeight("pesoPreGravidanza", v);
                        }}
                        placeholder="Es. 65"
                        className="flex-1"
                        classNames={{ label: "pb-1" }}
                      />

                      {/* Indicatore aumento peso + BMI pre-gravidanza (compatto) */}
                      {ostetriciaData.pesoPreGravidanza > 0 &&
                        ostetriciaData.pesoAttuale > 0 && (
                          <div className="flex flex-col items-center justify-end gap-1 pb-1 px-1.5 animate-appearance-in">
                            {(() => {
                              const diff =
                                ostetriciaData.pesoAttuale -
                                ostetriciaData.pesoPreGravidanza;
                              const isNegative = diff < 0;
                              // Il colore di questo chip segnala il verso della
                              // variazione di peso, non la fascia BMI: quella ha
                              // il suo chip colorato qui sotto.
                              const colorClass = isNegative
                                ? "corioli-text-brand bg-brand-50/80 border-brand-200"
                                : "text-primary-600 bg-primary-50/80 border-primary-200";
                              return (
                                <div
                                  className={`flex flex-col items-center gap-0 rounded-md border px-2 py-1 ${colorClass}`}
                                  title="Variazione di peso in gravidanza"
                                >
                                  <div className="flex items-center gap-1 text-xs font-semibold">
                                    {diff >= 0 ? (
                                      <TrendingUp size={12} />
                                    ) : (
                                      <TrendingDown size={12} />
                                    )}
                                    <span>
                                      {diff >= 0 ? "+" : "−"}
                                      {Math.abs(diff).toFixed(1)} kg
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                            {(() => {
                              const bmiPartenza = computeBmi(
                                ostetriciaData.pesoPreGravidanza,
                                getAltezzaCmForBmi(patient),
                              );
                              if (bmiPartenza == null) return null;
                              return (
                                <MetabolicChip
                                  sigla="BMI iniziale"
                                  valore={formatBmi(bmiPartenza)}
                                  band={bmiBand(bmiPartenza)}
                                  title="BMI pre-gravidanza (classificazione OMS)"
                                />
                              );
                            })()}
                          </div>
                        )}

                      <Input
                        label="Peso Attuale (kg)"
                        type="text"
                        inputMode="decimal"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={
                          pesoInputDraft.attuale ??
                          (ostetriciaData.pesoAttuale === 0
                            ? ""
                            : ostetriciaData.pesoAttuale.toString())
                        }
                        onFocus={() => {
                          setPesoInputDraft((d) => ({
                            ...d,
                            attuale:
                              ostetriciaData.pesoAttuale > 0
                                ? ostetriciaData.pesoAttuale.toString()
                                : "",
                          }));
                        }}
                        onBlur={() => {
                          if (pesoInputDraft.attuale !== null) {
                            commitOstetriciaWeight(
                              "pesoAttuale",
                              pesoInputDraft.attuale,
                            );
                          }
                          setPesoInputDraft((d) => ({ ...d, attuale: null }));
                        }}
                        onValueChange={(v) => {
                          if (!isValidWeightInputDraft(v)) return;
                          setPesoInputDraft((d) => ({ ...d, attuale: v }));
                          liveOstetriciaWeight("pesoAttuale", v);
                        }}
                        placeholder="Es. 72"
                        className="flex-1"
                        classNames={{ label: "pb-1" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Pressione Arteriosa"
                        placeholder="120/80"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={ostetriciaData.pressioneArteriosa}
                        onValueChange={(v) =>
                          handleOstetriciaChange("pressioneArteriosa", v)
                        }
                        classNames={{ label: "pb-1" }}
                      />
                      <Input
                        label="FC (bpm)"
                        placeholder="72"
                        type="number"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        value={ostetriciaData.frequenzaCardiaca ?? ""}
                        onValueChange={(v) =>
                          handleOstetriciaChange("frequenzaCardiaca", v)
                        }
                        classNames={{ label: "pb-1" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label="Fuma in gravidanza"
                        placeholder="Seleziona"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        selectedKeys={
                          ostetriciaData.fumaInGravidanza
                            ? [ostetriciaData.fumaInGravidanza]
                            : []
                        }
                        onSelectionChange={(keys) =>
                          handleOstetriciaChange(
                            "fumaInGravidanza",
                            (Array.from(keys)[0] as string) ?? "",
                          )
                        }
                        classNames={{ label: "pb-1" }}
                      >
                        <SelectItem key="no" value="no">
                          No (non fumatrice)
                        </SelectItem>
                        <SelectItem key="meno_1" value="meno_1">
                          Meno di 1 pacc./giorno
                        </SelectItem>
                        <SelectItem key="1" value="1">
                          1 pacc./giorno
                        </SelectItem>
                        <SelectItem key="2" value="2">
                          2 pacc./giorno
                        </SelectItem>
                        <SelectItem key="3" value="3">
                          3 pacc./giorno
                        </SelectItem>
                        <SelectItem key="4" value="4">
                          4 pacc./giorno
                        </SelectItem>
                        <SelectItem key="5_plus" value="5_plus">
                          5+ pacc./giorno
                        </SelectItem>
                      </Select>
                      <Select
                        label="Assunzione acido folico"
                        placeholder="Seleziona"
                        size="sm"
                        variant="bordered"
                        labelPlacement="outside"
                        selectedKeys={
                          ostetriciaData.assunzioneAcidoFolico
                            ? [ostetriciaData.assunzioneAcidoFolico]
                            : []
                        }
                        onSelectionChange={(keys) =>
                          handleOstetriciaChange(
                            "assunzioneAcidoFolico",
                            (Array.from(keys)[0] as string) ?? "",
                          )
                        }
                        classNames={{ label: "pb-1" }}
                      >
                        <SelectItem key="si" value="si">
                          Sì
                        </SelectItem>
                        <SelectItem key="no" value="no">
                          No
                        </SelectItem>
                      </Select>
                    </div>
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
                          <ul className="list-disc list-inside space-y-1">
                            {errs.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}

                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        type="number"
                        label="Gravid."
                        value={ostetriciaData.gravidanzePrec.toString()}
                        onValueChange={(v) =>
                          handleOstetriciaChange(
                            "gravidanzePrec",
                            parseInt(v) || 0,
                          )
                        }
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        classNames={{ input: "text-center" }}
                      />
                      <Input
                        type="number"
                        label="Parti"
                        value={ostetriciaData.partiPrec.toString()}
                        onValueChange={(v) =>
                          handleOstetriciaChange("partiPrec", parseInt(v) || 0)
                        }
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        classNames={{ input: "text-center" }}
                      />
                      <Input
                        type="number"
                        label="Aborti"
                        value={ostetriciaData.abortiPrec.toString()}
                        onValueChange={(v) =>
                          handleOstetriciaChange("abortiPrec", parseInt(v) || 0)
                        }
                        variant="bordered"
                        size="sm"
                        labelPlacement="outside"
                        min={0}
                        max={MAX_OBSTETRIC_COUNT}
                        classNames={{ input: "text-center" }}
                      />
                    </div>
                    {/* Dettagli */}
                    <div className="bg-gray-50/80 p-4 rounded-xl border border-dashed border-gray-300">
                      <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">
                        Dettagli
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="PS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.partiPrecSpontanei ?? 0)}
                          onValueChange={(v) =>
                            handleOstetriciaChange(
                              "partiPrecSpontanei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="TC"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.partiPrecCesarei ?? 0)}
                          onValueChange={(v) =>
                            handleOstetriciaChange(
                              "partiPrecCesarei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="AS"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(
                            ostetriciaData.abortiPrecSpontanei ?? 0,
                          )}
                          onValueChange={(v) =>
                            handleOstetriciaChange(
                              "abortiPrecSpontanei",
                              parseInt(v) || 0,
                            )
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                        <Input
                          label="IVG"
                          type="number"
                          size="sm"
                          variant="bordered"
                          labelPlacement="outside"
                          value={String(ostetriciaData.ivgPrec ?? 0)}
                          onValueChange={(v) =>
                            handleOstetriciaChange("ivgPrec", parseInt(v) || 0)
                          }
                          min={0}
                          max={MAX_OBSTETRIC_COUNT}
                          classNames={{ input: "text-center" }}
                        />
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Ecografia
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-3">
                    <Input
                      type="number"
                      label="CRL (mm)"
                      placeholder="Lunghezza vertice-sacro"
                      description="Robinson, fino a 84 mm. Settimane e data presunta parto si aggiornano se lo scarto supera 5 giorni (prima di 9 settimane) o 7 giorni"
                      value={
                        ostetriciaData.crlMm != null && ostetriciaData.crlMm > 0
                          ? String(ostetriciaData.crlMm)
                          : ""
                      }
                      onValueChange={handleCrlChange}
                      onFocus={() => {
                        crlAtFocus.current = ostetriciaData.crlMm;
                      }}
                      onBlur={applyCrlDating}
                      variant="bordered"
                      labelPlacement="outside"
                      min={3}
                      max={100}
                      classNames={{ label: "pb-1" }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {(ostetriciaData.ecografiaImmagini ?? []).length}/20
                        immagini
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
                          handleEcografiaImagesUpload(
                            "ostetricia",
                            e.target.files,
                          );
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {(ostetriciaData.ecografiaImmagini ?? []).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {(ostetriciaData.ecografiaImmagini ?? []).map(
                          (image, idx) => (
                            <div
                              key={`obs-eco-${idx}`}
                              className="relative group border rounded-lg overflow-hidden bg-gray-50"
                            >
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
                                onClick={() =>
                                  handleRemoveEcografiaImage("ostetricia", idx)
                                }
                                aria-label="Rimuovi immagine ecografia"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* RIGHT COLUMN: Referto Testuale */}
              <div className="w-full lg:flex-1 space-y-6">
                {/* Biometria fetale e peso stimato */}
                <Card className="shadow-sm border border-default-200 bg-white" data-guida="card-biometria">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Biometria fetale
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(
                        FORMULA_BIOMETRIA_FIELDS[fetalFormula] ??
                        FORMULA_BIOMETRIA_FIELDS.hadlock4
                      ).map((field) => {
                        const pctKey =
                          field === "bpdMm"
                            ? "bpdPercentile"
                            : field === "hcMm"
                              ? "hcPercentile"
                              : field === "acMm"
                                ? "acPercentile"
                                : "flPercentile";
                        const storedPct = ostetriciaData.biometriaFetale?.[
                          pctKey as keyof typeof ostetriciaData.biometriaFetale
                        ] as number | undefined;

                        // Percentile calcolato dalla misura (sempre, per il confronto)
                        let autoPct: number | undefined;
                        {
                          const val = ostetriciaData.biometriaFetale?.[field];
                          const ga = parseGestationalWeeks(
                            ostetriciaData.settimaneGestazione ?? "",
                          );
                          // Fuori scala niente percentile: la tabella lo
                          // dava al 10°, come fosse una misura vera.
                          if (
                            val &&
                            val > 0 &&
                            val <= BIOMETRIA_MAX_MM[field] &&
                            ga != null
                          ) {
                            const p = getBiometryPercentile(val, ga, field);
                            if (p != null) autoPct = Math.round(p);
                          }
                        }
                        // Mostrato: l'eventuale valore inserito/salvato, altrimenti il calcolato
                        const currentPct = storedPct ?? autoPct;

                        return (
                          <div key={field} className="flex flex-col gap-1">
                            <Input
                              type="number"
                              label={BIOMETRIA_FIELD_LABELS[field]}
                              size="sm"
                              variant="bordered"
                              labelPlacement="outside"
                              value={
                                ostetriciaData.biometriaFetale?.[field]
                                  ? String(
                                      ostetriciaData.biometriaFetale[field],
                                    )
                                  : ""
                              }
                              onValueChange={(v) =>
                                handleBiometriaFetaleChange(
                                  field,
                                  parseInt(v) || 0,
                                )
                              }
                              min={0}
                              max={BIOMETRIA_MAX_MM[field]}
                              isInvalid={
                                (ostetriciaData.biometriaFetale?.[field] ?? 0) >
                                BIOMETRIA_MAX_MM[field]
                              }
                              errorMessage={`Oltre ${BIOMETRIA_MAX_MM[field]} mm: c'è una cifra in più?`}
                              classNames={{ label: "pb-1" }}
                            />
                            <div className="flex items-center gap-2 px-1 min-h-[24px]">
                              <div className="flex-1">
                                <PercentileBar
                                  percentile={currentPct ?? null}
                                  showText={false}
                                />
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="number"
                                  className="w-7 text-right text-[11px] bg-transparent border-b border-default-200 focus:border-primary outline-none tabular-nums text-default-500 focus:text-primary placeholder:text-default-300"
                                  placeholder="-"
                                  value={currentPct ?? ""}
                                  onChange={(e) => {
                                    const v =
                                      e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value);
                                    handleBiometriaPercentileChange(field, v);
                                  }}
                                />
                                <span className="text-[11px] text-default-400 ml-0.5">
                                  °
                                </span>
                              </div>
                              <PercentileMismatchWarning
                                displayed={currentPct}
                                auto={autoPct}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-primary-50/50 rounded-xl p-4 flex items-center justify-between">
                      <p className="font-semibold text-gray-900">
                        Peso fetale stimato{" "}
                        <span className="font-normal text-default-500">
                          (
                          {scalePesoFetale[
                            fetalFormula as keyof typeof scalePesoFetale
                          ]?.nome ?? fetalFormula}
                          )
                        </span>
                      </p>
                      <div className="text-right flex flex-col items-end gap-1">
                        {(() => {
                          const result =
                            scalePesoFetale[
                              fetalFormula as keyof typeof scalePesoFetale
                            ];
                          if (
                            result?.calcolabile &&
                            result.pesoGrammi != null
                          ) {
                            const ga = parseGestationalWeeks(
                              ostetriciaData.settimaneGestazione ?? "",
                            );
                            const centileCalcolato =
                              ga != null
                                ? getCentileForWeight(result.pesoGrammi, ga)
                                : null;
                            const currentEfwPct =
                              ostetriciaData.biometriaFetale?.efwPercentile ??
                              centileCalcolato;
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <p className="text-xl font-bold text-primary">
                                  {result.pesoGrammi} g
                                </p>
                                <div className="flex items-center gap-2 min-h-[24px]">
                                  <div className="flex-1 min-w-[60px]">
                                    <PercentileBar
                                      percentile={currentEfwPct ?? null}
                                      showText={false}
                                    />
                                  </div>
                                  <div className="flex items-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      className="w-7 text-right text-[11px] bg-transparent border-b border-default-200 focus:border-primary outline-none tabular-nums text-default-500 focus:text-primary placeholder:text-default-300"
                                      placeholder="-"
                                      value={formatCentileInputValue(
                                        currentEfwPct,
                                      )}
                                      onChange={(e) => {
                                        const v = parseCentileInputValue(
                                          e.target.value,
                                        );
                                        handleEfwPercentileChange(v);
                                      }}
                                    />
                                    <span className="text-[11px] text-default-400 ml-0.5">
                                      °
                                    </span>
                                  </div>
                                  <PercentileMismatchWarning
                                    displayed={currentEfwPct}
                                    auto={centileCalcolato}
                                  />
                                </div>
                              </div>
                            );
                          }
                          return (
                            <p className="text-gray-400 font-medium text-sm">
                              Dati insufficienti
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Flussimetria Doppler arteria ombelicale: input PI, IR, EDF; GA da Settimane di gestazione */}
                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Flussimetria cordone ombelicale
                  </CardHeader>
                  <CardBody className="px-4 py-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          key: "pi",
                          label: "PI (Pulsatility Index)",
                          pctKey: "piPercentile",
                          placeholder: "es. 0,88",
                        },
                        {
                          key: "ri",
                          label: "IR (Indice di resistenza)",
                          pctKey: "riPercentile",
                          placeholder: "es. 0,58",
                        },
                      ].map((item) => {
                        const val =
                          ostetriciaData.flussimetriaOmbelicale?.[
                            item.key as "pi" | "ri"
                          ];
                        const storedPct = ostetriciaData
                          .flussimetriaOmbelicale?.[
                          item.pctKey as keyof typeof ostetriciaData.flussimetriaOmbelicale
                        ] as number | undefined;

                        // Percentile calcolato dal valore (sempre, per il confronto)
                        let autoPct: number | undefined;
                        {
                          const ga = parseGestationalWeeks(
                            ostetriciaData.settimaneGestazione ?? "",
                          );
                          const valNum =
                            typeof val === "number"
                              ? val
                              : parseFloat(String(val).replace(",", "."));

                          if (
                            ga != null &&
                            Number.isFinite(valNum) &&
                            valNum > 0
                          ) {
                            const p =
                              item.key === "pi"
                                ? getUmbilicalPiPercentile(valNum, ga)
                                : getUmbilicalRiPercentile(valNum, ga);
                            if (p != null) autoPct = Math.round(p);
                          }
                        }
                        const currentPct = storedPct ?? autoPct;

                        const fieldKey = item.key as "pi" | "ri";
                        const draftVal =
                          fieldKey === "pi"
                            ? flussimetriaOmbelicaleDraft.pi
                            : flussimetriaOmbelicaleDraft.ri;

                        return (
                          <div key={item.key} className="flex flex-col gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              label={item.label}
                              size="sm"
                              variant="bordered"
                              labelPlacement="outside"
                              placeholder={item.placeholder}
                              value={
                                draftVal ??
                                (val != null && Number.isFinite(Number(val))
                                  ? formatFlussimetriaNumForInput(Number(val))
                                  : "")
                              }
                              onFocus={() => {
                                setFlussimetriaOmbelicaleDraft((d) => ({
                                  ...d,
                                  [fieldKey]:
                                    val != null && Number.isFinite(Number(val))
                                      ? formatFlussimetriaNumForInput(
                                          Number(val),
                                        )
                                      : "",
                                }));
                              }}
                              onBlur={() => {
                                const raw =
                                  fieldKey === "pi"
                                    ? flussimetriaOmbelicaleDraft.pi
                                    : flussimetriaOmbelicaleDraft.ri;
                                if (raw !== null) {
                                  handleFlussimetriaOmbelicaleChange(
                                    fieldKey,
                                    parseFlussimetriaFieldBlur(raw),
                                  );
                                }
                                setFlussimetriaOmbelicaleDraft((d) => ({
                                  ...d,
                                  [fieldKey]: null,
                                }));
                              }}
                              onValueChange={(v) => {
                                setFlussimetriaOmbelicaleDraft((d) => ({
                                  ...d,
                                  [fieldKey]: v,
                                }));
                                const live = parseFlussimetriaFieldLive(v);
                                if (live !== "incomplete") {
                                  handleFlussimetriaOmbelicaleChange(
                                    fieldKey,
                                    live,
                                  );
                                }
                              }}
                              classNames={{ label: "pb-1" }}
                            />
                            <div className="flex items-center gap-2 px-1 min-h-[24px]">
                              <div className="flex-1">
                                <PercentileBar
                                  percentile={currentPct ?? null}
                                  showText={false}
                                />
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-7 text-right text-[11px] bg-transparent border-b border-default-200 focus:border-primary outline-none tabular-nums text-default-500 focus:text-primary placeholder:text-default-300"
                                  placeholder="-"
                                  value={formatCentileInputValue(currentPct)}
                                  onChange={(e) => {
                                    const v = parseCentileInputValue(
                                      e.target.value,
                                    );
                                    handleFlussimetriaPercentileChange(
                                      item.key as "pi" | "ri",
                                      v,
                                    );
                                  }}
                                />
                                <span className="text-[11px] text-default-400 ml-0.5">
                                  °
                                </span>
                              </div>
                              <PercentileMismatchWarning
                                displayed={currentPct}
                                auto={autoPct}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>

                <Card className="shadow-sm border border-default-200 bg-white">
                  <CardHeader className="pb-0 pt-4 px-6 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Referto Medico
                  </CardHeader>
                  <CardBody className="p-6 space-y-8">
                    {/* Sezione 1: Descrizione */}
                    <div className="space-y-2 group">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        1. Descrizione Problema / Dati Clinici
                      </label>
                      <RefertoTextarea
                        value={ostetriciaData.problemaClinico}
                        onValueChange={(value) =>
                          handleOstetriciaChange("problemaClinico", value)
                        }
                        variant="bordered"
                        minRows={3}
                        placeholder="Motivo della visita, sintomi riferiti..."
                      />
                    </div>

                    {/* Sezione 2: Anamnesi */}
                    {renderAnamnesiSection(
                      "ostetricia",
                      ostetriciaData.prestazione,
                      (value) => handleOstetriciaChange("prestazione", value),
                      allTemplates.filter(
                        (t) =>
                          t.category === "ostetricia" &&
                          t.section === "prestazione",
                      ),
                      (t) => handleTemplateSelect("ostetrica", "prestazione", t),
                    )}

                    {/* Sezione 3: Esame Obiettivo */}
                    <div className="space-y-2 relative group" data-guida="campo-esame-obiettivo">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">
                          3. Visita / Ecografia Office
                        </label>
                        <TemplateSelector
                          templates={allTemplates.filter(
                            (t) =>
                              t.category === "ostetricia" &&
                              t.section === "esameObiettivo",
                          )}
                          onSelect={(t) =>
                            handleTemplateSelect(
                              "ostetrica",
                              "esameObiettivo",
                              t,
                            )
                          }
                        />
                      </div>
                      <RefertoTextarea
                        value={ostetriciaData.esameObiettivo}
                        onValueChange={(value) =>
                          handleOstetriciaChange("esameObiettivo", value)
                        }
                        variant="bordered"
                        minRows={5}
                        placeholder="Biometria fetale, liquido amniotico..."
                      />
                    </div>

                    <div className="space-y-2 relative group">
                      <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-bold text-gray-700">
                          4. Conclusioni e Terapie
                        </label>
                        <TemplateSelector
                          templates={allTemplates.filter(
                            (t) =>
                              (t.category === "ostetricia" &&
                                t.section === "conclusioni") ||
                              t.category === "terapie",
                          )}
                          onSelect={(t) =>
                            handleTemplateSelect(
                              "ostetrica",
                              "noteOstetriche",
                              t,
                            )
                          }
                        />
                      </div>
                      <RefertoTextarea
                        value={ostetriciaData.noteOstetriche}
                        onValueChange={(value) =>
                          handleOstetriciaChange("noteOstetriche", value)
                        }
                        variant="bordered"
                        minRows={3}
                        placeholder="Raccomandazioni e follow-up..."
                      />
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </Tab>
        </Tabs>
        </div>
      </form>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
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

      <AppModal
        isOpen={isIncludeImagesModalOpen}
        onClose={() => resolveIncludeEcografiaImages(false)}
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
              onPress={() => resolveIncludeEcografiaImages(false)}
            >
              No, genera senza immagini
            </Button>
            <Button
              color="primary"
              onPress={() => resolveIncludeEcografiaImages(true)}
            >
              Si, includi immagini
            </Button>
          </ModalFooter>
        </ModalContent>
      </AppModal>

      <AppModal
        isOpen={isFlattenAnamnesiModalOpen}
        onClose={() => resolveFlattenAnamnesi(null)}
        size="md"
      >
        <ModalContent>
          <ModalHeader>Conversione anamnesi non automatica</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600">
              La visita precedente ha un&apos;anamnesi scritta in un{" "}
              <span className="font-semibold">unico campo</span>, mentre questa
              visita usa l&apos;anamnesi a{" "}
              <span className="font-semibold">sezioni multiple</span>. Non è
              possibile suddividerla automaticamente nelle singole sezioni.
            </p>
            <p className="text-sm text-gray-600">
              Puoi <span className="font-semibold">distribuirla manualmente</span>{" "}
              (copiando dal testo qui sotto) oppure importarla tutta in una
              sezione e poi spostarne le parti.
            </p>
            {flattenAnamnesiSource && (
              <div className="max-h-32 overflow-auto rounded-lg border border-default-200 bg-default-50 p-2 text-xs text-gray-700 whitespace-pre-wrap break-words select-text">
                {flattenAnamnesiSource}
              </div>
            )}
            <Select
              label="Importa tutto nella sezione"
              variant="bordered"
              labelPlacement="outside"
              selectedKeys={
                flattenAnamnesiSelected ? [flattenAnamnesiSelected] : []
              }
              onSelectionChange={(keys) =>
                setFlattenAnamnesiSelected(
                  (Array.from(keys)[0] as string) ?? "",
                )
              }
            >
              {flattenAnamnesiOptions.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => resolveFlattenAnamnesi(null)}
            >
              Distribuisci manualmente
            </Button>
            <Button
              color="primary"
              isDisabled={!flattenAnamnesiSelected}
              onPress={() =>
                resolveFlattenAnamnesi(flattenAnamnesiSelected || null)
              }
            >
              Importa nella sezione
            </Button>
          </ModalFooter>
        </ModalContent>
      </AppModal>

      <AppModal
        isOpen={isIncludeFetalGrowthChartModalOpen}
        onClose={() => resolveIncludeFetalGrowthChart(false)}
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
              onPress={() => resolveIncludeFetalGrowthChart(false)}
            >
              No, genera senza grafico
            </Button>
            <Button
              color="primary"
              onPress={() => resolveIncludeFetalGrowthChart(true)}
            >
              Sì, includi grafico
            </Button>
          </ModalFooter>
        </ModalContent>
      </AppModal>

      {doctorProfileIncompleteModal}
    </div>
  );
}
