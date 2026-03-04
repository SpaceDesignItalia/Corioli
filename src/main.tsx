import ReactDOM from "react-dom/client";
import { NextUIProvider } from "@nextui-org/react";
import { HashRouter as Router } from "react-router-dom";
import App from "./App";
import "./index.css";
import { seedDemoDataIfNeeded } from "./services/seed";
import { ToastProvider } from "./contexts/ToastContext";
import { OrbytProvider } from "@orbytapp/orbyt-sdk/react";

// Seed dati demo all'avvio (non bloccante)
seedDemoDataIfNeeded();

// App key per Orbyt (può essere configurata tramite variabile d'ambiente)
const ORBYT_APP_KEY =
  import.meta.env.VITE_ORBYT_APP_KEY || "1735af1f-68b6-4514-b010-e931592aedcb";

console.log(OrbytProvider);

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <NextUIProvider>
    <Router>
      <ToastProvider>
        <OrbytProvider
          app_key={ORBYT_APP_KEY}
          environment={import.meta.env.VITE_ORBYT_ENVIRONMENT || "Development"}
        >
          <App />
        </OrbytProvider>
      </ToastProvider>
    </Router>
  </NextUIProvider>,
);
