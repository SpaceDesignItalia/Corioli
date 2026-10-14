import ReactDOM from "react-dom/client";
import { NextUIProvider } from "@nextui-org/react";
import { HashRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { initializeAppData } from "./services/seed";
import { ToastProvider } from "./contexts/ToastContext";
import { AppLockProvider } from "./contexts/AppLockContext";
import { configureClientApiAuth } from "./utils/configureClientApi";
import WindowTitleBar from "./components/WindowTitleBar";

configureClientApiAuth();

// Inizializzazione dati all'avvio (non bloccante)
void initializeAppData();

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <NextUIProvider>
    <WindowTitleBar />
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
