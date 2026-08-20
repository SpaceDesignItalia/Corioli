import type { ReactNode } from "react";
import {
  Button,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { Trash2 } from "lucide-react";
import { AppModal } from "./AppModal";

type ConfirmDangerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function ConfirmDangerModal({
  isOpen,
  onClose,
  title,
  subtitle = "L'operazione non può essere annullata",
  children,
  confirmLabel,
  onConfirm,
  isLoading = false,
}: ConfirmDangerModalProps) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={() => {
        if (isLoading) return;
        onClose();
      }}
      size="md"
      placement="center"
      backdrop="blur"
      classNames={{
        base: "border border-danger-200",
        header: "border-b border-default-200",
        footer: "border-t border-default-200",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-100">
            <Trash2 size={18} className="text-danger" />
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">{title}</p>
            <p className="text-sm font-normal text-default-500">{subtitle}</p>
          </div>
        </ModalHeader>
        <ModalBody>{children}</ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isLoading}>
            Annulla
          </Button>
          <Button color="danger" onPress={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </AppModal>
  );
}
