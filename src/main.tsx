import React from "react";
import ReactDOM from "react-dom/client";
import { NextUIProvider } from "@nextui-org/react";
import { HashRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { seedDemoDataIfNeeded } from "./services/seed";
import { ToastProvider } from "./contexts/ToastContext";

// Seed dati demo all'avvio (non bloccante)
seedDemoDataIfNeeded();

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <NextUIProvider>
    <Router>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Router>
  </NextUIProvider>
);
