import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { AlertCircle, ChevronRight, Search, UserPlus } from "lucide-react";
import { PatientService } from "../services/OfflineServices";
import type { Patient } from "../types/Storage";
import { CodiceFiscaleValue } from "../components/CodiceFiscaleValue";
import { isValidCodiceFiscaleFormat } from "../utils/codiceFiscale";
import { AppModal } from "../components/AppModal";
import { EVENTO_PAZIENTI_CAMBIATI } from "../utils/guidaPrimoAvvio";

type CheckPatientModalContextValue = {
  openCheckPatientModal: () => void;
  closeCheckPatientModal: () => void;
};

const CheckPatientModalContext =
  createContext<CheckPatientModalContextValue | null>(null);

function patientInitials(patient: Patient): string {
  const n = (patient.nome?.[0] ?? "").toUpperCase();
  const c = (patient.cognome?.[0] ?? "").toUpperCase();
  return `${c}${n}` || "?";
}

/**
 * Le pazienti che corrispondono a quello che si scrive: per cognome (come si
 * cerca davvero, al banco) o per codice fiscale, dalla terza lettera.
 */
function filterSuggestions(patients: Patient[], query: string): Patient[] {
  if (query.length < 3) return [];
  const cf = (p: Patient) => p.codiceFiscale?.toUpperCase() ?? "";
  const cognome = (p: Patient) => (p.cognome ?? "").toUpperCase();

  const startsWithMatches = patients.filter(
    (p) => cognome(p).startsWith(query) || cf(p).startsWith(query),
  );
  const includesMatches = patients.filter(
    (p) => !startsWithMatches.includes(p) && query.length >= 4 && cf(p).includes(query),
  );

  return [...startsWithMatches, ...includesMatches].slice(0, 6);
}

export function CheckPatientModalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [cf, setCf] = useState("");
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckPatientModal = useCallback(() => {
    setCf("");
    setError(null);
    setIsOpen(true);
  }, []);

  const closeCheckPatientModal = useCallback(() => {
    setIsOpen(false);
    setCf("");
    setError(null);
    setIsLoading(false);
  }, []);

  // L'archivio e' cambiato sotto il pannello (la guida di primo avvio che
  // chiude il suo archivio di prova): i suggerimenti non valgono piu'.
  useEffect(() => {
    window.addEventListener(EVENTO_PAZIENTI_CAMBIATI, closeCheckPatientModal);
    return () => window.removeEventListener(EVENTO_PAZIENTI_CAMBIATI, closeCheckPatientModal);
  }, [closeCheckPatientModal]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void PatientService.getAllPatients()
      .then((patients) => {
        if (!cancelled) setAllPatients(patients);
      })
      .catch((err) => {
        console.error("Errore nel caricamento pazienti per suggerimenti:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingContext = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable ||
            target.getAttribute("role") === "textbox"),
      );
      if (isTypingContext || e.isComposing) return;

      const hasCmdOrCtrl = e.ctrlKey || e.metaKey;
      const noExtraModifiers = !e.altKey && !e.shiftKey;
      if (hasCmdOrCtrl && noExtraModifiers && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCheckPatientModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCheckPatientModal]);

  const cfNormalized = cf.trim().toUpperCase();
  const cfHasInput = cf.trim().length > 0;
  const showCfFormatError =
    cfHasInput && cfNormalized.length === 16 && !isValidCodiceFiscaleFormat(cfNormalized);
  const suggestions = filterSuggestions(allPatients, cfNormalized);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCf(e.target.value.toUpperCase());
    if (error) setError(null);
  };

  const goToPatient = (patient: Patient) => {
    closeCheckPatientModal();
    navigate(`/patient-history/${patient.id}`);
  };

  const handleSuggestionClick = (patient: Patient) => {
    setCf(patient.codiceFiscale?.toUpperCase() ?? "");
    if (error) setError(null);
    goToPatient(patient);
  };

  const handleRegisterNew = (cfValue?: string) => {
    closeCheckPatientModal();
    const q = (cfValue ?? cfNormalized).trim();
    navigate(q ? `/add-patient?cf=${encodeURIComponent(q)}` : "/add-patient");
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cf.trim()) {
      setError("Inserisci un codice fiscale");
      return;
    }

    if (!isValidCodiceFiscaleFormat(cf)) {
      // Un cognome: si sceglie fra le pazienti trovate.
      setError(
        suggestions.length > 0
          ? "Scegli la paziente fra quelle trovate, o scrivi il codice fiscale completo."
          : "Nessuna paziente con questo cognome: scrivi il codice fiscale per registrarla.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const patient = await PatientService.getPatientByCF(cf);
      if (patient) {
        goToPatient(patient);
      } else {
        handleRegisterNew(cfNormalized);
      }
    } catch (err) {
      console.error("Errore durante la verifica del paziente:", err);
      setError("Errore durante la verifica del paziente");
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo(
    () => ({ openCheckPatientModal, closeCheckPatientModal }),
    [openCheckPatientModal, closeCheckPatientModal],
  );

  return (
    <CheckPatientModalContext.Provider value={value}>
      {children}
      <AppModal
        isOpen={isOpen}
        onClose={closeCheckPatientModal}
        // In alto e non al centro: i risultati crescono verso il basso senza
        // far saltare la finestra, e nella guida di primo avvio il fumetto
        // trova posto sotto di loro invece di coprirli.
        placement="top"
        backdrop="blur"
        size="md"
        scrollBehavior="inside"
        classNames={{
          base: "border border-default-200",
          header: "border-b border-default-100",
          footer: "border-t border-default-100",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 items-start">
            <span className="text-base font-semibold text-gray-900">
              Nuova visita
            </span>
            <span className="text-sm font-normal text-default-500">
              Cerca la paziente per cognome o codice fiscale
            </span>
          </ModalHeader>
          <ModalBody>
            {/* `data-guida`: la guida di primo avvio illumina la ricerca. */}
            <form id="check-patient-form" onSubmit={handleCheck} className="space-y-4" data-guida="pannello-paziente">
              {error && (
                <div className="rounded-lg border border-danger-200 bg-danger-50/60 px-3 py-2.5">
                  <p className="text-danger text-sm flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </p>
                </div>
              )}

              <Input
                autoFocus
                label="Cognome o codice fiscale"
                placeholder="ROSSI o RSSMRA80A01H501U"
                value={cf}
                onChange={handleChange}
                variant="bordered"
                maxLength={16}
                isRequired
                isInvalid={showCfFormatError}
                errorMessage={
                  showCfFormatError
                    ? "Codice fiscale non valido (16 caratteri)"
                    : undefined
                }
                classNames={{
                  label: "text-gray-700 font-medium",
                  input: "uppercase font-mono tracking-wide",
                }}
                description="Dopo tre lettere compaiono le pazienti in archivio."
              />

              {suggestions.length > 0 && (
                <div className="rounded-xl border border-default-200 overflow-hidden">
                  <div className="px-3 py-2 bg-default-50 border-b border-default-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Suggerimenti
                    </p>
                  </div>
                  <div className="divide-y divide-default-100">
                    {suggestions.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        data-paziente={patient.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-default-50 group"
                        onClick={() => handleSuggestionClick(patient)}
                      >
                        <span className="dashboard-pregnancy-avatar">
                          {patientInitials(patient)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {patient.cognome} {patient.nome}
                          </p>
                          <p className="text-xs text-default-500 mt-0.5">
                            <CodiceFiscaleValue
                              value={patient.codiceFiscale}
                              generatedFromImport={Boolean(
                                patient.codiceFiscaleGenerato,
                              )}
                            />
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-default-300 group-hover:text-brand-800 transition-colors shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </ModalBody>
          <ModalFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="light"
              startContent={<UserPlus size={16} />}
              onPress={() => handleRegisterNew()}
              className="text-default-600"
            >
              Registra nuovo paziente
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="flat" onPress={closeCheckPatientModal}>
                Annulla
              </Button>
              <Button
                type="submit"
                form="check-patient-form"
                color="primary"
                className="corioli-cta flex-1 sm:flex-none"
                isLoading={isLoading}
                isDisabled={isLoading || !cf.trim() || showCfFormatError}
                startContent={!isLoading ? <Search size={16} /> : undefined}
              >
                Verifica
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </AppModal>
    </CheckPatientModalContext.Provider>
  );
}

export function useCheckPatientModal() {
  const ctx = useContext(CheckPatientModalContext);
  if (!ctx) {
    throw new Error(
      "useCheckPatientModal must be used within CheckPatientModalProvider",
    );
  }
  return ctx;
}

/** Apre il modale e torna alla dashboard (compatibilità link /check-patient). */
export function CheckPatientOpener() {
  const { openCheckPatientModal } = useCheckPatientModal();
  const navigate = useNavigate();

  useEffect(() => {
    openCheckPatientModal();
    navigate("/", { replace: true });
  }, [openCheckPatientModal, navigate]);

  return null;
}
