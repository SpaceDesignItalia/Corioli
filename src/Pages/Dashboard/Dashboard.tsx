import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useDeferredValue,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Avatar,
  Spinner,
  Select,
  SelectItem,
} from "@nextui-org/react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { SearchIcon } from "../../components/navbar/SearchIcon";
import {
  PatientService,
  DoctorService,
  PreferenceService,
} from "../../services/OfflineServices";
import { Patient } from "../../types/Storage";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { calculateAge } from "../../utils/dateUtils";

// Interfaccia compatibile con il componente esistente
interface PatientData {
  id: string; // Added ID for editing
  name?: string;
  surname?: string;
  birthday?: string;
  gender?: string;
  email?: string;
  phone?: string;
  cf?: string;
  cfGenerated?: boolean;
  birthplace?: string;
}

interface RecentPatientSearchEntry {
  id: string;
  name?: string;
  surname?: string;
  cf?: string;
  cfGenerated?: boolean;
}

const RECENT_PATIENT_SEARCHES_KEY = "appdottori_recent_patient_searches";
const MAX_RECENT_PATIENT_SEARCHES = 6;

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
const DEFAULT_PAGE_SIZE = 24;

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [recentPatientSearches, setRecentPatientSearches] = useState<
    RecentPatientSearchEntry[]
  >([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const patients = await PatientService.getAllPatients();
      const sorted = [...patients].sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      );
      const convertedPatients: PatientData[] = sorted.map((patient) => ({
        id: patient.id,
        name: patient.nome,
        surname: patient.cognome,
        birthday: patient.dataNascita,
        gender: patient.sesso,
        email: patient.email,
        phone: patient.telefono,
        cf: patient.codiceFiscale,
        cfGenerated: Boolean(patient.codiceFiscaleGenerato),
        birthplace: patient.luogoNascita,
      }));
      setPatients(convertedPatients);
    } catch (error) {
      console.error("Error fetching patient data:", error);
      setErrorMessage("Errore nel caricamento dei pazienti");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const msg = sessionStorage.getItem("appdottori_toast");
    if (msg) {
      setToast({ open: true, message: msg });
      sessionStorage.removeItem("appdottori_toast");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        let raw = await PreferenceService.getRecentPatientSearches();
        if (!raw && typeof localStorage !== "undefined") {
          raw = localStorage.getItem(RECENT_PATIENT_SEARCHES_KEY);
          if (raw) await PreferenceService.setRecentPatientSearches(raw);
        }
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentPatientSearches(
            parsed
              .filter((p) => p && typeof p.id === "string")
              .slice(0, MAX_RECENT_PATIENT_SEARCHES),
          );
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        const doctor = await DoctorService.initializeDefaultDoctor();
        setDoctorName(`${doctor.nome} ${doctor.cognome}`);
      } catch (error) {
        console.error("Error fetching doctor data:", error);
        setDoctorName("Dottore Default");
      }
    };

    fetchDoctorData();
    loadPatients();
  }, [loadPatients]);

  // Ricerca: capisce da solo se stai cercando per nome/cognome o per codice fiscale
  const deferredSearch = useDeferredValue(searchTerm);
  const filteredPatients = useMemo(() => {
    const raw = deferredSearch.trim();
    if (!raw) return patients;
    const search = raw.toLowerCase();
    const cfOnly = raw.replace(/\s/g, "").toUpperCase();
    // Considera CF solo se plausibile:
    // - 6-16 caratteri alfanumerici
    // - e contiene almeno un numero, oppure è lungo 16 caratteri
    // In questo modo una ricerca testuale tipo "elisabetta" resta una ricerca per nome/cognome.
    const looksLikeCf =
      /^[A-Za-z0-9]{6,16}$/.test(cfOnly) &&
      (/\d/.test(cfOnly) || cfOnly.length === 16);
    if (looksLikeCf) {
      return patients.filter((p) => {
        const cf = (p.cf || "").toUpperCase();
        return cf.includes(cfOnly) || cf.startsWith(cfOnly);
      });
    }
    // Altrimenti ricerca per nome e/o cognome: ogni parola deve matchare nome o cognome
    const tokens = search.split(/\s+/).filter(Boolean);
    return patients.filter((patient) => {
      const nome = (patient.name || "").toLowerCase();
      const cognome = (patient.surname || "").toLowerCase();
      return tokens.every(
        (token) => nome.includes(token) || cognome.includes(token),
      );
    });
  }, [patients, deferredSearch]);

  const totalFiltered = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / rowsPerPage));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPatients.slice(start, start + rowsPerPage);
  }, [filteredPatients, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, rowsPerPage]);

  useEffect(() => {
    // Mantieni in memoria solo pazienti ancora esistenti/aggiornati.
    if (patients.length === 0 || recentPatientSearches.length === 0) return;
    const byId = new Map(patients.map((p) => [p.id, p]));
    const normalized = recentPatientSearches
      .map((p) => {
        const live = byId.get(p.id);
        if (!live) return null;
        return {
          id: live.id,
          name: live.name,
          surname: live.surname,
          cf: live.cf,
          cfGenerated: live.cfGenerated,
        };
      })
      .filter(Boolean) as RecentPatientSearchEntry[];

    if (normalized.length !== recentPatientSearches.length) {
      setRecentPatientSearches(normalized);
      PreferenceService.setRecentPatientSearches(
        JSON.stringify(normalized),
      ).catch(() => {});
    }
  }, [patients, recentPatientSearches]);

  const getPatientInitials = (patient: PatientData) => {
    return `${patient.name?.[0] || ""}${patient.surname?.[0] || ""}`.toUpperCase();
  };

  const getGenderColor = (gender?: string) => {
    return gender === "M"
      ? "primary"
      : gender === "F"
        ? "secondary"
        : "default";
  };

  const saveRecentPatientSearch = useCallback((patient: PatientData) => {
    const entry: RecentPatientSearchEntry = {
      id: patient.id,
      name: patient.name,
      surname: patient.surname,
      cf: patient.cf,
      cfGenerated: patient.cfGenerated,
    };
    setRecentPatientSearches((prev) => {
      const next = [entry, ...prev.filter((p) => p.id !== patient.id)].slice(
        0,
        MAX_RECENT_PATIENT_SEARCHES,
      );
      PreferenceService.setRecentPatientSearches(JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

  const handleOpenPatientHistory = useCallback(
    (patient: PatientData) => {
      saveRecentPatientSearch(patient);
      navigate(`/patient-history/${patient.id}`);
    },
    [navigate, saveRecentPatientSearch],
  );

  const HeaderActions = (
    <div className="flex gap-3">
      <Button
        color="success"
        // variant="shadow"
        className="shadow-md shadow-success/20 text-white"
        onPress={() => navigate("/add-patient")}
        startContent={<span className="text-lg">+</span>}
      >
        Aggiungi Paziente
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Lista Pazienti"
        subtitle="Cerca e gestisci i tuoi pazienti"
        icon={Users}
        iconColor="success"
        actions={HeaderActions}
      >
        {/* Search Bar embedded in header area */}
        <Card className="shadow-sm mt-4">
          <CardBody className="p-4">
            <Input
              placeholder="Cerca per nome, cognome o codice fiscale (ricerca automatica)"
              size="lg"
              startContent={
                <SearchIcon size={20} className="text-default-400" />
              }
              value={searchTerm}
              onValueChange={setSearchTerm}
              variant="bordered"
              classNames={{
                input: "text-base",
                inputWrapper: "h-12 border-default-200",
              }}
              isClearable
              onClear={() => setSearchTerm("")}
            />
            {recentPatientSearches.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">
                    Ultimi pazienti cercati
                  </p>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-6 min-w-0 px-2 text-xs"
                    onPress={() => {
                      setRecentPatientSearches([]);
                      PreferenceService.setRecentPatientSearches("[]").catch(
                        () => {},
                      );
                    }}
                  >
                    Pulisci
                  </Button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recentPatientSearches.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="flat"
                      className="justify-start shrink-0"
                      onPress={() => handleOpenPatientHistory(p as PatientData)}
                    >
                      <span className="mr-2">
                        {p.name} {p.surname}
                      </span>
                      <CodiceFiscaleValue
                        value={p.cf}
                        generatedFromImport={Boolean(p.cfGenerated)}
                      />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </PageHeader>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Card className="border-l-4 border-l-danger">
          <CardBody>
            <p className="text-danger">{errorMessage}</p>
          </CardBody>
        </Card>
      )}

      {/* Patients Grid (paginated) */}
      {!loading && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <p className="text-sm text-default-500">
              {totalFiltered === 0
                ? "Nessun paziente"
                : `${totalFiltered} paziente${totalFiltered === 1 ? "" : "i"} — pagina ${currentPage} di ${totalPages}`}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-default-500">
                Righe per pagina:
              </span>
              <Select
                size="sm"
                className="w-20"
                selectedKeys={[String(rowsPerPage)]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0];
                  if (v) setRowsPerPage(Number(v));
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={String(n)} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedPatients.map((patient) => (
              <Card
                key={patient.id}
                isPressable
                onPress={() => handleOpenPatientHistory(patient)}
                className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 w-full">
                    <Avatar
                      name={getPatientInitials(patient)}
                      className="flex-shrink-0"
                      color={getGenderColor(patient.gender)}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">
                        {patient.name} {patient.surname}
                      </h4>
                      <p className="text-sm text-gray-500 truncate">
                        <CodiceFiscaleValue
                          value={patient.cf}
                          generatedFromImport={Boolean(patient.cfGenerated)}
                        />
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Data di nascita:</span>
                      <span>
                        {patient.birthday
                          ? `${new Date(patient.birthday).toLocaleDateString("it-IT")}${calculateAge(patient.birthday) != null ? ` (${calculateAge(patient.birthday)} anni)` : ""}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Luogo:</span>
                      <span className="truncate max-w-[120px]">
                        {patient.birthplace || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Genere:</span>
                      <Chip
                        size="sm"
                        color={getGenderColor(patient.gender)}
                        variant="flat"
                      >
                        {patient.gender === "M"
                          ? "Maschio"
                          : patient.gender === "F"
                            ? "Femmina"
                            : "N/A"}
                      </Chip>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                size="md"
                variant="flat"
                isDisabled={currentPage <= 1}
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                startContent={<ChevronLeft size={18} />}
              >
                Precedente
              </Button>
              <span className="text-sm text-default-600">
                Pagina {currentPage} di {totalPages}
              </span>
              <Button
                size="md"
                variant="flat"
                isDisabled={currentPage >= totalPages}
                onPress={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                endContent={<ChevronRight size={18} />}
              >
                Successiva
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && filteredPatients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Users size={48} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm
              ? "Nessun paziente trovato"
              : "Nessun paziente registrato"}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            {searchTerm
              ? "Prova a modificare i termini di ricerca o aggiungi un nuovo paziente."
              : "Inizia aggiungendo il tuo primo paziente per gestire le visite mediche."}
          </p>
          <Button
            color="primary"
            size="lg"
            onPress={() => navigate("/add-patient")}
            startContent={<span className="text-xl">+</span>}
            className="shadow-lg shadow-primary/20"
          >
            Aggiungi Paziente
          </Button>
        </div>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
