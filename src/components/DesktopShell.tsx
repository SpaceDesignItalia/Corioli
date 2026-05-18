import React from "react";
import AppNavbar from "./AppNavbar";

type DesktopShellProps = {
  children: React.ReactNode;
};

/** Larghezza unica per navbar e contenuto — evita salti tra le pagine */
const SHELL_CLASS = "mx-auto w-full max-w-7xl px-6";

export default function DesktopShell({ children }: DesktopShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-50">
      <header className={`sticky top-0 z-50 pt-6 ${SHELL_CLASS}`}>
        <AppNavbar />
      </header>

      <main className={`py-8 ${SHELL_CLASS}`}>{children}</main>
    </div>
  );
}
