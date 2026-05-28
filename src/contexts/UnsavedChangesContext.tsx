import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@nextui-org/react";
import { AlertTriangle } from "lucide-react";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (key: string, dirty: boolean) => void;
  requestNavigation: (href: string) => boolean;
  guardAction: (action: () => void) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [dirtyFlags, setDirtyFlags] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const allowLeaveRef = useRef(false);
  const isDirtyRef = useRef(false);

  const isDirty = Object.values(dirtyFlags).some(Boolean);
  isDirtyRef.current = isDirty;

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyFlags((prev) => {
      if (!dirty) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === dirty) return prev;
      return { ...prev, [key]: dirty };
    });
  }, []);

  const openModal = useCallback((href: string | null, action: (() => void) | null) => {
    pendingHref.current = href;
    pendingAction.current = action;
    setModalOpen(true);
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      if (!isDirty) return true;
      openModal(href, null);
      return false;
    },
    [isDirty, openModal],
  );

  const guardAction = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      openModal(null, action);
    },
    [isDirty, openModal],
  );

  const confirmLeave = useCallback(() => {
    setModalOpen(false);
    allowLeaveRef.current = true;
    setDirtyFlags({});
    const href = pendingHref.current;
    const action = pendingAction.current;
    pendingHref.current = null;
    pendingAction.current = null;
    if (action) {
      action();
    } else if (href) {
      navigate(href);
    }
    queueMicrotask(() => {
      allowLeaveRef.current = false;
    });
  }, [navigate]);

  const cancelLeave = useCallback(() => {
    setModalOpen(false);
    pendingHref.current = null;
    pendingAction.current = null;
  }, []);

  // Intercetta il pulsante Indietro del browser (useBlocker richiede data router).
  useEffect(() => {
    if (!isDirty) return;

    const trapBack = () => {
      window.history.pushState({ unsavedGuard: true }, "", window.location.href);
    };

    trapBack();

    const onPopState = () => {
      if (allowLeaveRef.current || !isDirtyRef.current) return;
      trapBack();
      openModal(null, () => {
        allowLeaveRef.current = true;
        window.history.back();
        queueMicrotask(() => {
          allowLeaveRef.current = false;
        });
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty, openModal]);

  const value = useMemo(
    () => ({ isDirty, setDirty, requestNavigation, guardAction }),
    [isDirty, setDirty, requestNavigation, guardAction],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <Modal
        isOpen={modalOpen}
        onClose={cancelLeave}
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
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-base font-semibold text-gray-900">Corioli</p>
              <p className="text-sm font-normal text-gray-500">
                Modifiche non salvate
              </p>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-gray-700">
              Hai modifiche non salvate. Se esci ora, andranno perse. Vuoi
              uscire comunque?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={cancelLeave}>
              Resta sulla pagina
            </Button>
            <Button color="danger" variant="flat" onPress={confirmLeave}>
              Esci senza salvare
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return ctx;
}

/** Registra lo stato dirty di una pagina (es. form visita/paziente). */
export function useRegisterUnsavedChanges(key: string, dirty: boolean) {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}
