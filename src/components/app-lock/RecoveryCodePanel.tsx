import { useState } from "react";
import { Button, Checkbox } from "@nextui-org/react";
import { Copy, Check } from "lucide-react";

type Props = {
  recoveryCode: string;
  storedSecurely?: boolean;
  onConfirmSaved: () => void;
  confirmLabel?: string;
  loading?: boolean;
};

export default function RecoveryCodePanel({
  recoveryCode,
  storedSecurely = true,
  onConfirmSaved,
  confirmLabel = "Ho salvato il codice, continua",
  loading = false,
}: Props) {
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-600 leading-relaxed">
        Conserva questo codice in un posto sicuro (stampa o gestore password). Serve se
        dimentichi il PIN. Senza PIN e senza questo codice non potrai sbloccare l&apos;app.
      </p>
      {!storedSecurely ? (
        <p className="text-sm text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
          Su questo dispositivo il codice non può essere mostrato di nuovo in Impostazioni:
          salvalo ora.
        </p>
      ) : (
        <p className="text-xs text-default-500">
          Potrai rivederlo in seguito da Impostazioni → Sicurezza, inserendo il PIN.
        </p>
      )}
      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/80 px-4 py-3">
        <code className="flex-1 text-center text-lg font-mono font-bold tracking-wider text-primary-900 break-all">
          {recoveryCode}
        </code>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          aria-label="Copia codice"
          onPress={() => void handleCopy()}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </Button>
      </div>
      <Checkbox isSelected={ack} onValueChange={setAck} size="sm">
        Ho annotato o stampato il codice di recupero
      </Checkbox>
      <Button
        color="primary"
        className="w-full font-medium"
        isDisabled={!ack}
        isLoading={loading}
        onPress={onConfirmSaved}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
