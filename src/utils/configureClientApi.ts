import axios from "axios";

/**
 * Aggiunge Authorization Bearer alle richieste verso VITE_API_URL (heartbeat, support, aggiornamenti).
 * La chiave va impostata in VITE_CLIENT_API_SECRET (stesso valore di CLIENT_API_SECRET sul backend).
 */
export function configureClientApiAuth(): void {
  const secret = import.meta.env.VITE_CLIENT_API_SECRET;
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!secret || !apiUrl) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Corioli] VITE_CLIENT_API_SECRET o VITE_API_URL non configurati: le API cloud potrebbero rispondere 401.",
      );
    }
    return;
  }

  axios.interceptors.request.use((config) => {
    const url = config.url ?? "";
    const isCorioliApi =
      url.startsWith(apiUrl) ||
      (config.baseURL?.replace(/\/$/, "") === apiUrl && url.startsWith("/"));

    if (isCorioliApi) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${secret}`;
    }
    return config;
  });
}

/**
 * Allegati support: il backend restituisce URL con `file_token` temporaneo.
 * Fallback legacy `access_token` solo se assente (deprecato).
 */
export function appendClientFileAccessToken(url: string): string {
  if (!url.includes("/support/files/")) {
    return url;
  }
  if (url.includes("file_token=")) {
    return url;
  }
  const secret = import.meta.env.VITE_CLIENT_API_SECRET;
  if (!secret) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(secret)}`;
}
