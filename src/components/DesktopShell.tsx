import React from "react";
import { useLocation } from "react-router-dom";
import AppNavbar from "./AppNavbar";
import { CheckPatientModalProvider } from "../contexts/CheckPatientModalContext";
import { UnsavedChangesProvider } from "../contexts/UnsavedChangesContext";

type DesktopShellProps = {
  children: React.ReactNode;
  navbar?: React.ReactNode;
};

/** Larghezza unica per navbar e contenuto — evita salti tra le pagine */
const SHELL_CLASS = "mx-auto w-full max-w-7xl px-6";

/**
 * Nella maschera della visita la navbar non si vede: al suo posto la pagina
 * ha una barra sua con la paziente, la data e le azioni (`AddVisit`), come in
 * Corioli Cardiologia. Resta montata, nascosta, perche' al ritorno non rifaccia
 * i controlli dell'avvio.
 */
function isMascheraVisita(pathname: string): boolean {
  return pathname.startsWith("/add-visit") || pathname.startsWith("/edit-visit");
}

export default function DesktopShell({ children, navbar }: DesktopShellProps) {
  const { pathname } = useLocation();
  const senzaNavbar = isMascheraVisita(pathname);

  return (
    <UnsavedChangesProvider>
      <CheckPatientModalProvider>
        <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-50">
          {/* pt: spazio sopra la navbar + barra del titolo dell'app desktop (WindowTitleBar) */}
          <header
            className={`sticky top-0 z-50 pt-[calc(1.5rem_+_var(--titlebar-h))] ${SHELL_CLASS}`}
            hidden={senzaNavbar}
          >
            {navbar ?? <AppNavbar />}
          </header>

          <main
            className={`${senzaNavbar ? "pb-8 pt-[calc(1.5rem_+_var(--titlebar-h))]" : "py-8"} ${SHELL_CLASS}`}
          >
            {children}
          </main>
        </div>
      </CheckPatientModalProvider>
    </UnsavedChangesProvider>
  );
}
