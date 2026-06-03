import ReactDOM from "react-dom/client";
import { NextUIProvider } from "@nextui-org/react";
import { HashRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { seedDemoDataIfNeeded } from "./services/seed";
import { ToastProvider } from "./contexts/ToastContext";
import { AppLockProvider } from "./contexts/AppLockContext";
import { configureClientApiAuth } from "./utils/configureClientApi";

configureClientApiAuth();

// Seed dati demo all'avvio (non bloccante)
seedDemoDataIfNeeded();

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <NextUIProvider>
    <Router>
      <ToastProvider>
        <AppLockProvider>
          <App />
        </AppLockProvider>
      </ToastProvider>
    </Router>
  </NextUIProvider>,
);
