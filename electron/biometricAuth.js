import { systemPreferences } from "electron";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const PROMPT_REASON = "Sblocca Corioli";

let winHelloFactory = undefined;

function loadWinHello() {
  if (process.platform !== "win32") return null;
  if (winHelloFactory !== undefined) return winHelloFactory;
  try {
    const mod = _require("win-hello");
    winHelloFactory = mod.default ?? mod;
    return winHelloFactory;
  } catch {
    winHelloFactory = null;
    return null;
  }
}

export async function checkBiometricAvailable() {
  if (process.platform === "darwin") {
    const available =
      typeof systemPreferences.canPromptTouchID === "function" &&
      systemPreferences.canPromptTouchID();
    return {
      available,
      kind: available ? "touchId" : null,
      label: available ? "riconoscimento biometrico" : null,
    };
  }

  if (process.platform === "win32") {
    const factory = loadWinHello();
    if (!factory) {
      return { available: false, kind: null, label: null };
    }
    try {
      const api = factory();
      await api.isHelloAvailable();
      return {
        available: true,
        kind: "windowsHello",
        label: "riconoscimento biometrico",
      };
    } catch {
      return { available: false, kind: null, label: null };
    }
  }

  return { available: false, kind: null, label: null };
}

export async function promptBiometric(mainWindow) {
  if (process.platform === "darwin") {
    if (
      typeof systemPreferences.canPromptTouchID !== "function" ||
      !systemPreferences.canPromptTouchID()
    ) {
      return { ok: false, error: "Impronta digitale non disponibile su questo Mac." };
    }
    try {
      await systemPreferences.promptTouchID(PROMPT_REASON);
      return { ok: true };
    } catch (err) {
      const message = String(err?.message || err || "Autenticazione annullata.");
      const cancelled =
        /cancel|annull|user cancel|not available|failed/i.test(message);
      return { ok: false, error: message, cancelled };
    }
  }

  if (process.platform === "win32") {
    const factory = loadWinHello();
    if (!factory) {
      return {
        ok: false,
        error: "Il riconoscimento biometrico non è disponibile su questo sistema.",
      };
    }
    try {
      const api = factory();
      await api.isHelloAvailable();
      const hwnd = mainWindow?.getNativeWindowHandle?.() ?? null;
      await api.requestHello(PROMPT_REASON, hwnd);
      return { ok: true };
    } catch (err) {
      const message = String(err?.message || err || "Autenticazione annullata.");
      const cancelled = /cancel|annull|user cancel|denied|declined/i.test(
        message,
      );
      return { ok: false, error: message, cancelled };
    }
  }

  return { ok: false, error: "Biometria non supportata su questa piattaforma." };
}
