import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { Mail, KeyRound } from "lucide-react";
import {
  resetPinWithRecovery,
  resetPinWithOnlineGrant,
} from "../../services/AppLockService";
import {
  requestPinRecoveryOtp,
  verifyPinRecoveryOtp,
} from "../../services/PinRecoveryService";
import { DoctorService } from "../../services/OfflineServices";
import { doctorValuesFromProfile } from "./DoctorProfileSetupFields";
import PinDigitInput from "./PinDigitInput";

const PIN_LENGTH = 4;

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (newPin?: string) => void;
};

type View = "choose" | "code" | "email" | "email-otp" | "email-pin";

export default function PinForgotModal({ isOpen, onOpenChange, onUnlocked }: Props) {
  const [view, setView] = useState<View>("choose");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [otp, setOtp] = useState("");
  const [grant, setGrant] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setView("choose");
    setRecoveryCode("");
    setOtp("");
    setGrant(null);
    setNewPin("");
    setNewPinConfirm("");
    setError(null);
    setInfo(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    void DoctorService.getDoctor().then((doctor) => {
      const values = doctorValuesFromProfile(doctor);
      setClientId(doctor?.id ?? "");
      setEmail(values.email);
    });
  }, [isOpen]);

  const validateNewPin = (): string | null => {
    const a = newPin.replace(/\D/g, "");
    const b = newPinConfirm.replace(/\D/g, "");
    if (a.length !== PIN_LENGTH) {
      return `Il nuovo PIN deve avere esattamente ${PIN_LENGTH} cifre.`;
    }
    if (a !== b) {
      return "I PIN non coincidono.";
    }
    return null;
  };

  const handleCodeReset = async () => {
    setError(null);
    const pinErr = validateNewPin();
    if (pinErr) {
      setError(pinErr);
      return;
    }
    setLoading(true);
    try {
      const a = newPin.replace(/\D/g, "");
      const result = await resetPinWithRecovery(recoveryCode, a);
      if (!result.ok) {
        setError(result.error || "Recupero non riuscito.");
        return;
      }
      onOpenChange(false);
      resetState();
      onUnlocked(a);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError(null);
    setInfo(null);
    if (!clientId) {
      setError("Profilo medico non trovato su questo dispositivo.");
      return;
    }
    if (!email.trim()) {
      setError("Inserisci l'email del profilo medico.");
      return;
    }
    setLoading(true);
    try {
      const result = await requestPinRecoveryOtp(clientId, email);
      if (!result.ok) {
        setError(result.error || "Invio non riuscito.");
        return;
      }
      setInfo(result.message || "Codice inviato. Controlla la casella email.");
      setView("email-otp");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!clientId) {
      setError("Profilo medico non trovato.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyPinRecoveryOtp(clientId, email, otp);
      if (!result.ok || !result.grant) {
        setError(result.error || "Codice non valido.");
        return;
      }
      setGrant(result.grant);
      setView("email-pin");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPinReset = async () => {
    setError(null);
    const pinErr = validateNewPin();
    if (pinErr) {
      setError(pinErr);
      return;
    }
    if (!grant || !clientId) {
      setError("Sessione di recupero scaduta. Richiedi un nuovo codice.");
      return;
    }
    setLoading(true);
    try {
      const a = newPin.replace(/\D/g, "");
      const result = await resetPinWithOnlineGrant(clientId, grant, a);
      if (!result.ok) {
        setError(result.error || "Impossibile impostare il nuovo PIN.");
        return;
      }
      onOpenChange(false);
      resetState();
      onUnlocked(a);
    } finally {
      setLoading(false);
    }
  };

  const header = () => {
    if (view === "choose") return "Recupero PIN";
    if (view === "code") return "Codice di recupero";
    if (view === "email") return "Recupero via email";
    if (view === "email-otp") return "Codice ricevuto via email";
    return "Nuovo PIN";
  };

  const pinReady =
    newPin.replace(/\D/g, "").length === PIN_LENGTH &&
    newPinConfirm.replace(/\D/g, "").length === PIN_LENGTH;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetState();
      }}
      placement="center"
      size="lg"
    >
      <ModalContent>
        <ModalHeader>{header()}</ModalHeader>
        <ModalBody className="space-y-3">
          {view === "choose" ? (
            <>
              <p className="text-sm text-default-600">
                Scegli come recuperare l&apos;accesso. L&apos;uso quotidiano dell&apos;app
                resta possibile anche senza internet; il recupero via email richiede
                connessione.
              </p>
              <Button
                variant="bordered"
                className="w-full justify-start"
                startContent={<KeyRound size={18} />}
                onPress={() => {
                  setError(null);
                  setView("code");
                }}
              >
                Ho il codice CORI-… salvato
              </Button>
              <Button
                variant="bordered"
                className="w-full justify-start"
                startContent={<Mail size={18} />}
                onPress={() => {
                  setError(null);
                  setView("email");
                }}
                isDisabled={!navigator.onLine}
              >
                Recupero via email (serve internet)
              </Button>
              {!navigator.onLine ? (
                <p className="text-xs text-warning-700">
                  Senza connessione usa il codice di recupero o un backup dei dati.
                </p>
              ) : null}
            </>
          ) : null}

          {view === "code" ? (
            <>
              <p className="text-sm text-default-600">
                Inserisci il codice ricevuto alla configurazione del PIN, poi imposta un
                nuovo PIN a 4 cifre.
              </p>
              <Input
                label="Codice di recupero"
                value={recoveryCode}
                onValueChange={setRecoveryCode}
                variant="bordered"
                placeholder="CORI-XXXX-XXXX-XXXX"
              />
              <PinPairInputs
                newPin={newPin}
                newPinConfirm={newPinConfirm}
                onNewPin={setNewPin}
                onConfirm={setNewPinConfirm}
              />
            </>
          ) : null}

          {view === "email" ? (
            <>
              <p className="text-sm text-default-600">
                Invieremo un codice a 6 cifre all&apos;email del profilo medico (deve
                coincidere con quella registrata sul server).
              </p>
              <Input
                label="Email"
                type="email"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
              />
            </>
          ) : null}

          {view === "email-otp" ? (
            <>
              {info ? <p className="text-sm text-success-700">{info}</p> : null}
              <Input
                label="Codice a 6 cifre"
                inputMode="numeric"
                value={otp}
                onValueChange={setOtp}
                variant="bordered"
                maxLength={6}
              />
            </>
          ) : null}

          {view === "email-pin" ? (
            <>
              <p className="text-sm text-default-600">
                Email verificata. Imposta il nuovo PIN a 4 cifre.
              </p>
              <PinPairInputs
                newPin={newPin}
                newPinConfirm={newPinConfirm}
                onNewPin={setNewPin}
                onConfirm={setNewPinConfirm}
              />
            </>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </ModalBody>
        <ModalFooter>
          {view !== "choose" ? (
            <Button
              variant="light"
              onPress={() => {
                setError(null);
                setInfo(null);
                if (view === "email-otp") setView("email");
                else if (view === "email-pin") setView("email-otp");
                else setView("choose");
              }}
            >
              Indietro
            </Button>
          ) : (
            <Button variant="light" onPress={() => onOpenChange(false)}>
              Annulla
            </Button>
          )}
          {view === "code" ? (
            <Button
              color="primary"
              isLoading={loading}
              isDisabled={!pinReady || !recoveryCode.trim()}
              onPress={() => void handleCodeReset()}
            >
              Imposta nuovo PIN
            </Button>
          ) : null}
          {view === "email" ? (
            <Button color="primary" isLoading={loading} onPress={() => void handleSendOtp()}>
              Invia codice
            </Button>
          ) : null}
          {view === "email-otp" ? (
            <Button
              color="primary"
              isLoading={loading}
              isDisabled={otp.replace(/\D/g, "").length < 6}
              onPress={() => void handleVerifyOtp()}
            >
              Verifica codice
            </Button>
          ) : null}
          {view === "email-pin" ? (
            <Button
              color="primary"
              isLoading={loading}
              isDisabled={!pinReady}
              onPress={() => void handleEmailPinReset()}
            >
              Salva PIN
            </Button>
          ) : null}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PinPairInputs({
  newPin,
  newPinConfirm,
  onNewPin,
  onConfirm,
}: {
  newPin: string;
  newPinConfirm: string;
  onNewPin: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <p className="text-xs text-default-500 text-center">Nuovo PIN</p>
        <PinDigitInput
          value={newPin}
          onChange={onNewPin}
          length={PIN_LENGTH}
          aria-label="Nuovo PIN"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-default-500 text-center">Conferma nuovo PIN</p>
        <PinDigitInput
          value={newPinConfirm}
          onChange={onConfirm}
          length={PIN_LENGTH}
          aria-label="Conferma nuovo PIN"
        />
      </div>
    </>
  );
}
