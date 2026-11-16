import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Documents from "./Pages/Dashboard/Documents";
import DesktopShell from "./components/DesktopShell";
import { ContextMenu } from "./components/ContextMenu";
import {
  AppStartupGate,
  RoutePageSkeleton,
} from "./components/AppStartupSkeleton";
import { storageService } from "./services/StorageServiceFallback";
import { AbbonamentoProvider } from "./contexts/AbbonamentoContext";
import SoloConAbbonamento from "./components/abbonamento/SoloConAbbonamento";

// Lazy loaded routes per ottimizzare il bundle iniziale
const Home = lazy(() => import("./Pages/Dashboard/Home"));
const PatientList = lazy(() => import("./Pages/Dashboard/Dashboard"));
const AboutUs = lazy(() => import("./Pages/About/About"));
const AddPatient = lazy(() => import("./Pages/Dashboard/AddPatient"));
import { CheckPatientOpener } from "./contexts/CheckPatientModalContext";
import { GuidaPrimoAvvioProvider } from "./components/guida/GuidaPrimoAvvio";
const AddVisit = lazy(() => import("./Pages/Dashboard/AddVisit"));
const Visite = lazy(() => import("./Pages/Dashboard/Visite"));
const Gravidanze = lazy(() => import("./Pages/Dashboard/Gravidanze"));
const Settings = lazy(() => import("./Pages/Dashboard/Settings"));
const ModelliStampa = lazy(() => import("./Pages/Dashboard/ModelliStampa"));
const Help = lazy(() => import("./Pages/Dashboard/Help"));
const PatientHistory = lazy(() => import("./Pages/Dashboard/PatientHistory"));
const PatientFiles = lazy(() => import("./Pages/Dashboard/PatientFiles"));
const BlockedPage = lazy(() => import("./Pages/Blocked"));

const BLOCKED_STORAGE_KEY = "blocked_users";

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/blocked") return;
    const checkBlocked = async () => {
      try {
        const raw = await storageService.getPreference(BLOCKED_STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw) as { blocked?: boolean };
        if (data.blocked === true) navigate("/blocked", { replace: true });
      } catch {
        // ignore
      }
    };
    void checkBlocked();
  }, [navigate, location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingContext = Boolean(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      );
      if (isTypingContext || e.isComposing) return;

      const hasCmdOrCtrl = e.ctrlKey || e.metaKey;
      const noExtraModifiers = !e.altKey && !e.shiftKey;
      if (hasCmdOrCtrl && noExtraModifiers && e.key.toLowerCase() === "p") {
        e.preventDefault();
        navigate("/add-patient");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <ContextMenu>
      <AppStartupGate>
        <Routes>
          <Route element={<BlockedPage />} path="/blocked" />
          <Route
            path="/*"
            element={
              <AbbonamentoProvider>
              <GuidaPrimoAvvioProvider>
              <DesktopShell>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <Routes>
                    <Route element={<Home />} path="/" />
                    <Route element={<PatientList />} path="/pazienti" />
                    <Route element={<AboutUs />} path="/about-us" />
                    <Route element={<SoloConAbbonamento><AddPatient /></SoloConAbbonamento>} path="/add-patient" />
                    <Route element={<CheckPatientOpener />} path="/check-patient" />
                    <Route element={<SoloConAbbonamento><AddVisit /></SoloConAbbonamento>} path="/add-visit" />
                    <Route element={<SoloConAbbonamento><AddVisit /></SoloConAbbonamento>} path="/edit-visit/:visitId" />
                    <Route element={<Visite />} path="/visite" />
                    <Route element={<Gravidanze />} path="/gravidanze" />
                    <Route element={<Documents />} path="/documents" />
                    <Route element={<Settings />} path="/settings" />
                    <Route element={<ModelliStampa />} path="/modelli-stampa" />
                    <Route element={<PatientHistory />} path="/patient-history/:patientId" />
                    <Route element={<PatientFiles />} path="/patient-history/:patientId/files" />
                    <Route element={<Help />} path="/help" />
                  </Routes>
                </Suspense>
              </DesktopShell>
              </GuidaPrimoAvvioProvider>
              </AbbonamentoProvider>
            }
          />
        </Routes>
      </AppStartupGate>
    </ContextMenu>
  );
};
export default App;
