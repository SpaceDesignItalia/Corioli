import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
} from "@nextui-org/react";
import { Lock, KeyRound } from "lucide-react";
import {
  getAppLockStatus,
  revealRecoveryCode,
  regenerateRecoveryCode,
  changeAppLockPin,
} from "../../services/AppLockService";
import RecoveryCodePanel from "./RecoveryCodePanel";
import { useAppLock } from "../../contexts/AppLockContext";

export default function AppLockSettingsCard() {
  const { lock } = useAppLock();
  const [canReveal, setCanReveal] = useState(false);
  const [pinModal, setPinModal] = useState<
    null | "reveal" | "regenerate" | "change"
  >(null);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [regeneratedCode, setRegeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    void getAppLockStatus().then((s) => {
      setCanReveal(Boolean(s?.canRevealRecovery));
    });
  }, []);

  const closeModal = () => {
    setPinModal(null);
    setPin("");
    setNewPin("");
    setNewPinConfirm("");
    setError(null);
    setRevealedCode(null);
    setRegeneratedCode(null);
  };

  const handlePinAction = async () => {
    setError(null);
    setLoading(true);
    try {
      if (pinModal === "reveal") {
        const res = await revealRecoveryCode(pin.replace(/\D/g, ""));
        if (!res.ok) {
          setError(res.error || "Impossibile mostrare il codice.");
          return;
        }
        setRevealedCode(res.recoveryCode || null);
        return;
      }
      if (pinModal === "regenerate") {
        const res = await regenerateRecoveryCode(pin.replace(/\D/g, ""));
        if (!res.ok || !res.recoveryCode) {
          setError(res.error || "Impossibile rigenerare il codice.");
          return;
        }
        setRegeneratedCode(res.recoveryCode);
        return;
      }
      if (pinModal === "change") {
        const a = newPin.replace(/\D/g, "");
        const b = newPinConfirm.replace(/\D/g, "");
        if (a !== b) {
          setError("I nuovi PIN non coincidono.");
          return;
        }
        const res = await changeAppLockPin(pin.replace(/\D/g, ""), a);
        if (!res.ok) {
          setError(res.error || "Impossibile cambiare il PIN.");
          return;
        }
        closeModal();
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="shadow-sm border border-default-200">
        <CardBody className="py-4 px-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">Sicurezza (PIN)</h2>
            <Chip size="sm" color="success" variant="flat">
              Attivo
            </Chip>
          </div>
          <p className="text-sm text-default-500">
            Il PIN protegge l&apos;accesso all&apos;app su questo computer. Usa il codice
            di recupero se lo dimentichi.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant="bordered"
              startContent={<KeyRound size={16} />}
              onPress={() => setPinModal("reveal")}
            >
              Mostra codice di recupero
            </Button>
            <Button
              size="sm"
              variant="bordered"
              onPress={() => setPinModal("regenerate")}
            >
              Rigenera codice di recupero
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={() => setPinModal("change")}
            >
              Cambia PIN
            </Button>
            <Button size="sm" variant="light" onPress={lock}>
              Blocca app ora
            </Button>
          </div>
          {!canReveal ? (
            <p className="text-xs text-warning-700">
              Su questo sistema il codice non può essere riletto in automatico: conserva
              il codice che hai ricevuto alla configurazione, oppure rigenerane uno nuovo.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Modal isOpen={pinModal !== null} onOpenChange={(o) => !o && closeModal()}>
        <ModalContent>
          <ModalHeader>
            {pinModal === "reveal" && "Codice di recupero"}
            {pinModal === "regenerate" && "Rigenera codice di recupero"}
            {pinModal === "change" && "Cambia PIN"}
          </ModalHeader>
          <ModalBody className="space-y-3">
            {revealedCode ? (
              <RecoveryCodePanel
                recoveryCode={revealedCode}
                confirmLabel="Chiudi"
                onConfirmSaved={closeModal}
              />
            ) : regeneratedCode ? (
              <>
                <p className="text-sm text-warning-700">
                  Il codice precedente non è più valido. Salva questo nuovo codice.
                </p>
                <RecoveryCodePanel
                  recoveryCode={regeneratedCode}
                  confirmLabel="Ho salvato il nuovo codice"
                  onConfirmSaved={closeModal}
                />
              </>
            ) : (
              <>
                <p className="text-sm text-default-600">
                  Inserisci il PIN attuale per continuare.
                </p>
                <Input
                  label="PIN attuale"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onValueChange={setPin}
                  variant="bordered"
                  maxLength={8}
                />
                {pinModal === "change" ? (
                  <>
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
                  </>
                ) : pinModal === "regenerate" ? (
                  <p className="text-xs text-default-500">
                    Verrà generato un nuovo codice; quello vecchio smetterà di funzionare.
                  </p>
                ) : null}
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </>
            )}
          </ModalBody>
          {!revealedCode && !regeneratedCode ? (
            <ModalFooter>
              <Button variant="light" onPress={closeModal}>
                Annulla
              </Button>
              <Button
                color="primary"
                isLoading={loading}
                onPress={() => void handlePinAction()}
              >
                {pinModal === "change" ? "Salva PIN" : "Continua"}
              </Button>
            </ModalFooter>
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
