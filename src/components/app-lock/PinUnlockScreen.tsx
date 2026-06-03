import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardBody,
  Input,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { Fingerprint, Lock } from "lucide-react";
import {
  verifyAppLockPin,
  resetPinWithRecovery,
  getAppLockStatus,
  verifyAppLockBiometric,
} from "../../services/AppLockService";

type Props = {
  onUnlocked: () => void;
};

export default function PinUnlockScreen({ onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const autoBioAttempted = useRef(false);

  useEffect(() => {
    void getAppLockStatus().then((s) => {
      if (s?.biometricAvailable && s.biometricEnabled && s.biometricLabel) {
        setBiometricLabel(s.biometricLabel);
        setBiometricEnabled(true);
      }
    });
  }, []);

  const handleBiometricUnlock = useCallback(async () => {
    setError(null);
    setBioLoading(true);
    try {
      const result = await verifyAppLockBiometric();
      if (!result.ok) {
        if (!result.cancelled) {
          setError(result.error || "Autenticazione non riuscita.");
        }
        return;
      }
      onUnlocked();
    } finally {
      setBioLoading(false);
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (!biometricEnabled || autoBioAttempted.current) return;
    autoBioAttempted.current = true;
    void handleBiometricUnlock();
  }, [biometricEnabled, handleBiometricUnlock]);

  const handleUnlock = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await verifyAppLockPin(pin.replace(/\D/g, ""));
      if (!result.ok) {
        setError(result.error || "PIN non corretto.");
        return;
      }
      onUnlocked();
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryReset = async () => {
    setRecoveryError(null);
    const a = newPin.replace(/\D/g, "");
    const b = newPinConfirm.replace(/\D/g, "");
    if (a.length < 4 || a.length > 8) {
      setRecoveryError("Il nuovo PIN deve avere tra 4 e 8 cifre.");
      return;
    }
    if (a !== b) {
      setRecoveryError("I PIN non coincidono.");
      return;
    }
    setRecoveryLoading(true);
    try {
      const result = await resetPinWithRecovery(recoveryCode, a);
      if (!result.ok) {
        setRecoveryError(result.error || "Recupero non riuscito.");
        return;
      }
      setRecoveryOpen(false);
      setPin(a);
      onUnlocked();
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen corioli-auth-bg flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg corioli-card">
          <CardBody className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center">
                <Lock className="text-primary h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Sblocca Corioli</h1>
              <p className="text-sm text-default-500">
                {biometricEnabled && biometricLabel
                  ? `Usa ${biometricLabel} o inserisci il PIN.`
                  : "Inserisci il PIN per accedere alla cartella clinica."}
              </p>
            </div>

            {biometricEnabled && biometricLabel ? (
              <Button
                color="primary"
                variant="flat"
                className="w-full font-medium"
                startContent={<Fingerprint size={18} />}
                isLoading={bioLoading}
                onPress={() => void handleBiometricUnlock()}
              >
                Sblocca con {biometricLabel}
              </Button>
            ) : null}

            <Input
              label="PIN"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onValueChange={setPin}
              variant="bordered"
              maxLength={8}
              autoFocus={!biometricEnabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleUnlock();
              }}
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
              onPress={() => void handleUnlock()}
            >
              Sblocca con PIN
            </Button>
            <button
              type="button"
              className="w-full text-sm text-primary font-medium hover:underline"
              onClick={() => {
                setRecoveryOpen(true);
                setRecoveryError(null);
              }}
            >
              Ho dimenticato il PIN
            </button>
          </CardBody>
        </Card>
      </div>

      <Modal isOpen={recoveryOpen} onOpenChange={setRecoveryOpen} placement="center">
        <ModalContent>
          <ModalHeader>Recupero con codice</ModalHeader>
          <ModalBody className="space-y-3">
            <p className="text-sm text-default-600">
              Inserisci il codice di recupero che hai salvato alla configurazione del PIN,
              poi imposta un nuovo PIN.
            </p>
            <Input
              label="Codice di recupero"
              value={recoveryCode}
              onValueChange={setRecoveryCode}
              variant="bordered"
              placeholder="CORI-XXXX-XXXX-XXXX"
            />
            <Input
              label="Nuovo PIN"
              type="password"
              inputMode="numeric"
              value={newPin}
              onValueChange={setNewPin}
              variant="bordered"
              maxLength={8}
            />
            <Input
              label="Conferma nuovo PIN"
              type="password"
              inputMode="numeric"
              value={newPinConfirm}
              onValueChange={setNewPinConfirm}
              variant="bordered"
              maxLength={8}
            />
            {recoveryError ? (
              <p className="text-sm text-danger">{recoveryError}</p>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setRecoveryOpen(false)}>
              Annulla
            </Button>
            <Button
              color="primary"
              isLoading={recoveryLoading}
              onPress={() => void handleRecoveryReset()}
            >
              Imposta nuovo PIN
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
