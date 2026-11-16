import "./demo/memoryStorage";
import ReactDOM from "react-dom/client";
import { NextUIProvider } from "@nextui-org/react";
import { HashRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initializeAppData } from "./services/seed";
import { ToastProvider } from "./contexts/ToastContext";
import { AppLockProvider } from "./contexts/AppLockContext";
import { configureClientApiAuth } from "./utils/configureClientApi";
import { IS_DEMO } from "./demo";
import { prepareDemo } from "./demo/prepareDemo";
import DemoBanner from "./demo/DemoBanner";
import WindowTitleBar from "./components/WindowTitleBar";

configureClientApiAuth();


function avvia() {
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <NextUIProvider>
    <WindowTitleBar />
    <DemoBanner />
    <Router
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ToastProvider>
        <AppLockProvider>
          <App />
        </AppLockProvider>
      </ToastProvider>
    </Router>
  </NextUIProvider>,
);
}

// Nella demo prima si caricano i dati di prova, poi si disegna l'app.
void (IS_DEMO ? prepareDemo() : Promise.resolve()).then(() => {
  // Inizializzazione dati all'avvio (non bloccante)
  void initializeAppData();
  avvia();
});
