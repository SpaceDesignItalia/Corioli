import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { AlertCircle } from "lucide-react";
import {
  getMissingDoctorProfileFields,
  isDoctorProfileComplete,
} from "../utils/doctorProfile";
import type { Doctor } from "../types/Storage";

type DoctorProfileLike = Pick<
  Doctor,
  "nome" | "cognome" | "email" | "telefono" | "specializzazione"
>;

type DoctorProfileIncompleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  missingFields: string[];
};

export function DoctorProfileIncompleteModal({
  isOpen,
  onClose,
  missingFields,
}: DoctorProfileIncompleteModalProps) {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    onClose();
    navigate("/settings");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      classNames={{
        base: "border border-warning-200",
        header: "border-b border-default-100",
        footer: "border-t border-default-100",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3 text-warning-700">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-100">
            <AlertCircle size={20} />
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">
              Profilo dottore incompleto
            </p>
            <p className="text-sm font-normal text-gray-500">Impostazioni</p>
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="text-gray-700">
            Completa prima il profilo dottore in Impostazioni.
          </p>
          {missingFields.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-600 mb-2">
                Campi mancanti:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Chiudi
          </Button>
          <Button color="primary" onPress={handleGoToSettings}>
            Vai a Impostazioni
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function useDoctorProfileIncompleteModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const open = useCallback((fields: string[]) => {
    setMissingFields(fields);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const ensureComplete = useCallback(
    (doctor: DoctorProfileLike | null) => {
      if (isDoctorProfileComplete(doctor)) return true;
      open(getMissingDoctorProfileFields(doctor));
      return false;
    },
    [open],
  );

  const modal = (
    <DoctorProfileIncompleteModal
      isOpen={isOpen}
      onClose={close}
      missingFields={missingFields}
    />
  );

  return { ensureComplete, open, close, modal };
}
