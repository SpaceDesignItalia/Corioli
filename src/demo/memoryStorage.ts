import { IS_DEMO } from "./index";

/**
 * Nella demo localStorage e sessionStorage sono sostituiti da una memoria
 * volatile: l'app scrive come sempre, ma niente arriva al browser. Va
 * importato per primo in main.tsx, prima di qualsiasi servizio.
 */
function creaMemoria(): Storage {
  const dati = new Map<string, string>();
  return {
    get length() {
      return dati.size;
    },
    clear: () => dati.clear(),
    getItem: (k) => (dati.has(k) ? (dati.get(k) as string) : null),
    key: (i) => Array.from(dati.keys())[i] ?? null,
    removeItem: (k) => void dati.delete(k),
    setItem: (k, v) => void dati.set(k, String(v)),
  };
}

if (IS_DEMO && typeof window !== "undefined") {
  for (const nome of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(window, nome, {
      value: creaMemoria(),
      configurable: true,
    });
  }
}
