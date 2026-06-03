import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Switch,
} from "@nextui-org/react";
import { ShieldCheck, KeyRound, Fingerprint, Lock, RefreshCw } from "lucide-react";
import {
  getAppLockStatus,
  revealRecoveryCode,
  regenerateRecoveryCode,
  changeAppLockPin,
  setBiometricUnlockEnabled,
} from "../../services/AppLockService";
import RecoveryCodePanel from "./RecoveryCodePanel";
import PinDigitInput from "./PinDigitInput";
import { useAppLock } from "../../contexts/AppLockContext";

const PIN_LENGTH = 4;
type ModalType = null | "reveal" | "regenerate" | "change";

export default function AppLockSettingsCard() {
  const { lock } = useAppLock();
  const [pinModal, setPinModal] = useState<ModalType>(null);
  const [canReveal, setCanReveal] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [regeneratedCode, setRegeneratedCode] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioToggleLoading, setBioToggleLoading] = useState(false);
  const [bioPinModal, setBioPinModal] = useState(false);
  const [bioPin, setBioPin] = useState("");
  const [bioPendingEnable, setBioPendingEnable] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const refreshLockStatus = () => {
    void getAppLockStatus().then((s) => {
      setCanReveal(Boolean(s?.canRevealRecovery));
      setBiometricAvailable(Boolean(s?.biometricAvailable));
      setBiometricLabel(s?.biometricLabel ?? null);
      setBiometricEnabled(Boolean(s?.biometricEnabled));
    });
  };

  useEffect(() => { refreshLockStatus(); }, []);

  const closeModal = () => {
    setPinModal(null);
    setPin(""); setNewPin(""); setNewPinConfirm("");
    setError(null); setRevealedCode(null); setRegeneratedCode(null);
  };

  const handlePinAction = async () => {
    setError(null);
    setLoading(true);
    try {
      if (pinModal === "reveal") {
        const res = await revealRecoveryCode(pin.replace(/\D/g, ""));
        if (!res.ok) { setError(res.error || "Impossibile mostrare il codice."); return; }
        setRevealedCode(res.recoveryCode || null);
        return;
      }
      if (pinModal === "regenerate") {
        const res = await regenerateRecoveryCode(pin.replace(/\D/g, ""));
        if (!res.ok || !res.recoveryCode) { setError(res.error || "Impossibile rigenerare."); return; }
        setRegeneratedCode(res.recoveryCode);
        return;
      }
      if (pinModal === "change") {
        const a = newPin.replace(/\D/g, ""), b = newPinConfirm.replace(/\D/g, "");
        if (a !== b) { setError("I nuovi PIN non coincidono."); return; }
        const res = await changeAppLockPin(pin.replace(/\D/g, ""), a);
        if (!res.ok) { setError(res.error || "Impossibile cambiare il PIN."); return; }
        closeModal();
      }
    } finally { setLoading(false); }
  };

  const changeDisabled =
    pinModal === "change"
      ? pin.replace(/\D/g, "").length !== PIN_LENGTH ||
        newPin.replace(/\D/g, "").length !== PIN_LENGTH ||
        newPinConfirm.replace(/\D/g, "").length !== PIN_LENGTH
      : pin.replace(/\D/g, "").length !== PIN_LENGTH;

  const confirmBio = async (code: string, enable: boolean) => {
    setBioError(null);
    setBioToggleLoading(true);
    try {
      const res = await setBiometricUnlockEnabled(code, enable);
      if (!res.ok) { setBioError(res.error || "Operazione non riuscita."); return; }
      setBiometricEnabled(enable);
      setBioPinModal(false);
      setBioPin("");
      refreshLockStatus();
    } finally { setBioToggleLoading(false); }
  };

  return (
    <>
      {/* ROW 1 — PIN di accesso */}
      <div className="settings-row">
        <div
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{ width: 36, height: 36, background: "#e1f5ee" }}
        >
          <ShieldCheck size={18} color="#0f6e56" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-[500] text-foreground leading-snug">
            PIN di accesso
          </p>
          <p className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
            PIN a 4 cifre
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <button
            className="settings-ghost-btn"
            onClick={() => { setPin(""); setError(null); setPinModal("change"); }}
          >
            <KeyRound size={13} />
            Cambia PIN
          </button>

          <button
            className="settings-ghost-btn"
            onClick={() => { setPin(""); setError(null); setPinModal(canReveal ? "reveal" : "regenerate"); }}
          >
            <RefreshCw size={13} />
            Codice recupero
          </button>

          <button
            className="settings-ghost-btn settings-ghost-btn--danger"
            onClick={lock}
          >
            <Lock size={13} />
            Blocca ora
          </button>
        </div>
      </div>

      {/* ROW 2 — Windows Hello (condizionale) */}
      {biometricAvailable && biometricLabel ? (
        <div className="settings-row">
          <div
            className="flex items-center justify-center shrink-0 rounded-lg"
            style={{ width: 36, height: 36, background: "var(--color-background-secondary)" }}
          >
            <Fingerprint size={18} style={{ color: "var(--color-text-tertiary)" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-[500] text-foreground leading-snug">
              {biometricLabel}
            </p>
            <p className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
              Sblocco rapido con impronta o volto
            </p>
          </div>

          <Switch
            isSelected={biometricEnabled}
            isDisabled={bioToggleLoading}
            size="sm"
            color="primary"
            onValueChange={(next) => {
              setBioPendingEnable(next);
              setBioPin("");
              setBioError(null);
              setBioPinModal(true);
            }}
          />
        </div>
      ) : null}

      {/* Modal conferma biometria */}
      <Modal
        isOpen={bioPinModal}
        onOpenChange={(o) => { if (!o) { setBioPinModal(false); setBioPin(""); setBioError(null); } }}
        placement="center"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Fingerprint size={17} className="text-primary" />
            {bioPendingEnable ? `Attiva ${biometricLabel}` : `Disattiva ${biometricLabel}`}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-2">
            <p className="text-sm text-default-600">Conferma con il tuo PIN attuale.</p>
            <PinDigitInput
              value={bioPin} onChange={setBioPin} length={PIN_LENGTH} autoFocus
              onComplete={(v) => void confirmBio(v, bioPendingEnable)}
              aria-label="PIN attuale"
            />
            {bioError ? <p className="text-sm text-danger">{bioError}</p> : null}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => { setBioPinModal(false); setBioPin(""); setBioError(null); }}>
              Annulla
            </Button>
            <Button
              color="primary" isLoading={bioToggleLoading}
              isDisabled={bioPin.replace(/\D/g, "").length !== PIN_LENGTH}
              onPress={() => void confirmBio(bioPin.replace(/\D/g, ""), bioPendingEnable)}
            >
              Conferma
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal azioni PIN */}
      <Modal isOpen={pinModal !== null} onOpenChange={(o) => !o && closeModal()} placement="center">
        <ModalContent>
          <ModalHeader>
            {pinModal === "reveal" ? "Codice di recupero"
              : pinModal === "regenerate" ? "Rigenera codice di recupero"
              : "Cambia PIN"}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-2">
            {revealedCode ? (
              <RecoveryCodePanel recoveryCode={revealedCode} confirmLabel="Chiudi" onConfirmSaved={closeModal} />
            ) : regeneratedCode ? (
              <>
                <p className="text-sm text-warning-700">Il codice precedente non è più valido. Salva questo nuovo codice.</p>
                <RecoveryCodePanel recoveryCode={regeneratedCode} confirmLabel="Ho salvato il nuovo codice" onConfirmSaved={closeModal} />
              </>
            ) : (
              <>
                <p className="text-sm text-default-600">Inserisci il PIN attuale per continuare.</p>
                <PinDigitInput value={pin} onChange={setPin} length={PIN_LENGTH} autoFocus aria-label="PIN attuale" />
                {pinModal === "change" && (
                  <>
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-default-500 text-center">Nuovo PIN</p>
                      <PinDigitInput value={newPin} onChange={setNewPin} length={PIN_LENGTH} aria-label="Nuovo PIN" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-default-500 text-center">Conferma nuovo PIN</p>
                      <PinDigitInput value={newPinConfirm} onChange={setNewPinConfirm} length={PIN_LENGTH} aria-label="Conferma nuovo PIN" />
                    </div>
                  </>
                )}
                {pinModal === "regenerate" && (
                  <p className="text-xs text-default-500">Verrà generato un nuovo codice; quello vecchio smetterà di funzionare.</p>
                )}
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </>
            )}
          </ModalBody>
          {!revealedCode && !regeneratedCode ? (
            <ModalFooter>
              <Button variant="light" onPress={closeModal}>Annulla</Button>
              <Button color="primary" isLoading={loading} isDisabled={changeDisabled} onPress={() => void handlePinAction()}>
                {pinModal === "change" ? "Salva PIN" : "Continua"}
              </Button>
            </ModalFooter>
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
