import React from "react";
import AppNavbar from "./AppNavbar";

type DesktopShellProps = {
  children: React.ReactNode;
};

export default function DesktopShell({ children }: DesktopShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-50">
      <div className="sticky top-0 z-50 px-6 pt-6">
        <AppNavbar />
      </div>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
