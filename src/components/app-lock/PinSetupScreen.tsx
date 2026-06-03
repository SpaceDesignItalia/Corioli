import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardBody, Button } from "@nextui-org/react";
import { Lock, User } from "lucide-react";
import { setupAppLock } from "../../services/AppLockService";
import { DoctorService } from "../../services/OfflineServices";
import { sendHeartbeat } from "../../services/HeartbeatService";
import {
  isDoctorProfileComplete,
  getMissingDoctorProfileFields,
} from "../../utils/doctorProfile";
import RecoveryCodePanel from "./RecoveryCodePanel";
import PinDigitInput from "./PinDigitInput";
import DoctorProfileSetupFields, {
  doctorValuesFromProfile,
  validateDoctorProfileForm,
  getMissingProfileFieldKeys,
  type DoctorProfileFormValues,
} from "./DoctorProfileSetupFields";

const PIN_LENGTH = 4;

type Props = {
  mode: "first-run" | "migration";
  onComplete: () => void;
};

type Step = "profile" | "pin" | "recovery";

export default function PinSetupScreen({ mode, onComplete }: Props) {
  const [step, setStep] = useState<Step>("profile");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileValues, setProfileValues] = useState<DoctorProfileFormValues>({
    nome: "",
    cognome: "",
    email: "",
    telefono: "",
    specializzazione: "",
  });
  const [profileFieldsToShow, setProfileFieldsToShow] = useState<
    Array<keyof DoctorProfileFormValues>
  >(["nome", "cognome", "email", "telefono", "specializzazione"]);

  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryStoredSecurely, setRecoveryStoredSecurely] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const [confirmShake, setConfirmShake] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await DoctorService.initializeDefaultDoctor();
        const doctor = await DoctorService.getDoctor();
        const values = doctorValuesFromProfile(doctor);
        setProfileValues(values);

        if (mode === "first-run") {
          setProfileFieldsToShow([
            "nome",
            "cognome",
            "email",
            "telefono",
            "specializzazione",
          ]);
          setStep("profile");
        } else if (!isDoctorProfileComplete(doctor)) {
          const missing = getMissingProfileFieldKeys(values);
          setProfileFieldsToShow(
            missing.length > 0
              ? missing
              : ["nome", "cognome", "email", "telefono", "specializzazione"],
          );
          setStep("profile");
        } else {
          setStep("pin");
        }
      } catch {
        setStep("profile");
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [mode]);

  const title = useMemo(() => {
    if (step === "profile") {
      return mode === "first-run" ? "Benvenuto in Corioli" : "Completa il profilo";
    }
    if (step === "pin") {
      return mode === "migration" ? "Imposta il PIN di accesso" : "Proteggi l'app con un PIN";
    }
    return "Codice di recupero";
  }, [step, mode]);

  const subtitle = useMemo(() => {
    if (step === "profile") {
      return mode === "first-run"
        ? "Inserisci i tuoi dati e un PIN per iniziare. I campi coincidono con il profilo in Impostazioni."
        : "Prima del PIN servono alcuni dati del profilo medico (come in Impostazioni).";
    }
    if (step === "pin") {
      return mode === "migration"
        ? "Con l'aggiornamento è richiesto un PIN a 4 cifre per proteggere la cartella clinica."
        : "Scegli un PIN a 4 cifre per sbloccare l'app.";
    }
    return "Conservalo in un luogo sicuro oppure usa il recupero via email quando sei online.";
  }, [step, mode]);

  const stepLabel = useMemo(() => {
    const order: Step[] =
      step === "profile" || profileFieldsToShow.length > 0
        ? ["profile", "pin", "recovery"]
        : ["pin", "recovery"];
    const idx = order.indexOf(step);
    return `Passo ${idx + 1} di ${order.length}`;
  }, [step, profileFieldsToShow.length]);

  const handleProfileContinue = async () => {
    setError(null);
    const validationError = validateDoctorProfileForm(
      profileValues,
      profileFieldsToShow,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const doctor = await DoctorService.updateDoctor({
        nome: profileValues.nome.trim(),
        cognome: profileValues.cognome.trim(),
        email: profileValues.email.trim().toLowerCase(),
        telefono: profileValues.telefono.trim(),
        specializzazione: profileValues.specializzazione.trim(),
      });
      if (navigator.onLine) {
        void sendHeartbeat(doctor, "corioli").catch(() => {});
      }
      setStep("pin");
    } catch {
      setError("Impossibile salvare il profilo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePin = async () => {
    setError(null);
    const a = pin.replace(/\D/g, "");
    const b = pinConfirm.replace(/\D/g, "");
    if (a.length !== PIN_LENGTH) {
      setError(`Il PIN deve avere esattamente ${PIN_LENGTH} cifre.`);
      setPinShake(true);
      setTimeout(() => setPinShake(false), 600);
      return;
    }
    if (a !== b) {
      setError("I PIN non coincidono.");
      setConfirmShake(true);
      setTimeout(() => setConfirmShake(false), 600);
      return;
    }
    setLoading(true);
    try {
      const result = await setupAppLock(a);
      if (!result.ok || !result.recoveryCode) {
        setError(result.error || "Impossibile configurare il PIN.");
        return;
      }
      setRecoveryCode(result.recoveryCode);
      setRecoveryStoredSecurely(result.recoveryStoredSecurely !== false);
      setStep("recovery");
    } finally {
      setLoading(false);
    }
  };

  const bothFilled =
    pin.replace(/\D/g, "").length === PIN_LENGTH &&
    pinConfirm.replace(/\D/g, "").length === PIN_LENGTH;

  if (profileLoading) {
    return (
      <AppLockShell title="Configurazione" subtitle="Caricamento…" icon="lock">
        <p className="text-sm text-center text-default-500">Attendere…</p>
      </AppLockShell>
    );
  }

  if (step === "recovery" && recoveryCode) {
    return (
      <AppLockShell title={title} subtitle={`${stepLabel} — ${subtitle}`} icon="lock">
        <RecoveryCodePanel
          recoveryCode={recoveryCode}
          storedSecurely={recoveryStoredSecurely}
          loading={loading}
          onConfirmSaved={() => {
            setLoading(true);
            onComplete();
          }}
        />
      </AppLockShell>
    );
  }

  if (step === "profile") {
    const missingLabels = getMissingDoctorProfileFields(profileValues);
    return (
      <AppLockShell title={title} subtitle={`${stepLabel} — ${subtitle}`} icon="user">
        <div className="space-y-4">
          {mode === "migration" && missingLabels.length > 0 ? (
            <p className="text-xs text-default-500">
              Campi mancanti: {missingLabels.join(", ")}.
            </p>
          ) : null}
          <DoctorProfileSetupFields
            values={profileValues}
            onChange={(field, value) =>
              setProfileValues((prev) => ({ ...prev, [field]: value }))
            }
            showFields={profileFieldsToShow}
          />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            color="primary"
            className="w-full font-medium"
            isLoading={loading}
            onPress={() => void handleProfileContinue()}
          >
            Continua
          </Button>
        </div>
      </AppLockShell>
    );
  }

  return (
    <AppLockShell title={title} subtitle={`${stepLabel} — ${subtitle}`} icon="lock">
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs text-default-500 text-center">Scegli un PIN a 4 cifre</p>
          <PinDigitInput
            value={pin}
            onChange={setPin}
            length={PIN_LENGTH}
            autoFocus
            disabled={loading}
            invalid={pinShake}
            aria-label="Nuovo PIN"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-default-500 text-center">Conferma PIN</p>
          <PinDigitInput
            value={pinConfirm}
            onChange={setPinConfirm}
            length={PIN_LENGTH}
            disabled={loading}
            invalid={confirmShake}
            onComplete={() => void handleCreatePin()}
            onSubmit={() => void handleCreatePin()}
            aria-label="Conferma PIN"
          />
        </div>
        {error ? (
          <p className="text-sm text-danger text-center" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          color="primary"
          className="w-full font-medium"
          isLoading={loading}
          isDisabled={!bothFilled}
          onPress={() => void handleCreatePin()}
        >
          Continua
        </Button>
      </div>
    </AppLockShell>
  );
}

function AppLockShell({
  title,
  subtitle,
  children,
  icon = "lock",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  icon?: "lock" | "user";
}) {
  return (
    <div className="min-h-screen corioli-auth-bg flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg corioli-card">
        <CardBody className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center">
              {icon === "user" ? (
                <User className="text-primary h-7 w-7" />
              ) : (
                <Lock className="text-primary h-7 w-7" />
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-default-500">{subtitle}</p>
          </div>
          {children}
        </CardBody>
      </Card>
    </div>
  );
}
