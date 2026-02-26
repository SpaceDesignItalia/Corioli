import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Documents from "./Pages/Dashboard/Documents";
import DesktopShell from "./components/DesktopShell";
import { ContextMenu } from "./components/ContextMenu";
import { Spinner } from "@nextui-org/react";

// Lazy loaded routes per ottimizzare il bundle iniziale
const Home = lazy(() => import("./Pages/Dashboard/Home"));
const PatientList = lazy(() => import("./Pages/Dashboard/Dashboard"));
const AboutUs = lazy(() => import("./Pages/About/About"));
const AddPatient = lazy(() => import("./Pages/Dashboard/AddPatient"));
const CheckPatient = lazy(() => import("./Pages/Dashboard/CheckPatient"));
const AddVisit = lazy(() => import("./Pages/Dashboard/AddVisit"));
const Visite = lazy(() => import("./Pages/Dashboard/Visite"));
const Settings = lazy(() => import("./Pages/Dashboard/Settings"));
const Help = lazy(() => import("./Pages/Dashboard/Help"));
const PatientHistory = lazy(() => import("./Pages/Dashboard/PatientHistory"));

const App: React.FC = () => {
  const navigate = useNavigate();

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
      if (hasCmdOrCtrl && noExtraModifiers) {
        const key = e.key.toLowerCase();
        if (key === "n") {
          e.preventDefault();
          navigate("/check-patient");
        } else if (key === "p") {
          e.preventDefault();
          navigate("/add-patient");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return (
    <ContextMenu>
      <DesktopShell>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <Spinner color="primary" size="lg" />
            </div>
          }
        >
          <Routes>
            <Route element={<Home />} path="/" />
            <Route element={<PatientList />} path="/pazienti" />
            <Route element={<AboutUs />} path="/about-us" />
            <Route element={<AddPatient />} path="/add-patient" />
            <Route element={<CheckPatient />} path="/check-patient" />
            <Route element={<AddVisit />} path="/add-visit" />
            <Route element={<AddVisit />} path="/edit-visit/:visitId" />
            <Route element={<Visite />} path="/visite" />
            <Route element={<Documents />} path="/documents" />
            <Route element={<Settings />} path="/settings" />
            <Route element={<PatientHistory />} path="/patient-history/:patientId" />
            <Route element={<Help />} path="/help" />
          </Routes>
        </Suspense>
      </DesktopShell>
    </ContextMenu>
  );
};
export default App;
