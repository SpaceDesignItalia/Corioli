import { useState, type ReactNode } from "react";
import { Card, CardBody, Button } from "@nextui-org/react";
import { Lock } from "lucide-react";
import { setupAppLock } from "../../services/AppLockService";
import RecoveryCodePanel from "./RecoveryCodePanel";
import PinDigitInput from "./PinDigitInput";

const PIN_LENGTH = 4;

type Props = {
  mode: "first-run" | "migration";
  onComplete: () => void;
};

export default function PinSetupScreen({ mode, onComplete }: Props) {
  const [step, setStep] = useState<"pin" | "recovery">("pin");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryStoredSecurely, setRecoveryStoredSecurely] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const [confirmShake, setConfirmShake] = useState(false);

  const title =
    mode === "migration"
      ? "Imposta il PIN di accesso"
      : "Benvenuto in Corioli";
  const subtitle =
    mode === "migration"
      ? "Con l'aggiornamento è richiesto un PIN per proteggere la cartella clinica su questo computer."
      : "Per iniziare, imposta un PIN a 4 cifre per proteggere i dati sul dispositivo.";

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

  if (step === "recovery" && recoveryCode) {
    return (
      <AppLockShell title="Codice di recupero" subtitle="Passo 2 di 2 — conservalo subito">
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

  const bothFilled =
    pin.replace(/\D/g, "").length === PIN_LENGTH &&
    pinConfirm.replace(/\D/g, "").length === PIN_LENGTH;

  return (
    <AppLockShell title={title} subtitle={subtitle}>
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
          onComplete={(_v) => void handleCreatePin()}
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
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen corioli-auth-bg flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg corioli-card">
        <CardBody className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center">
              <Lock className="text-primary h-7 w-7" />
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
