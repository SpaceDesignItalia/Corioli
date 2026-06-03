import axios from "axios";

const baseUrl = () => import.meta.env.VITE_API_URL as string;

export async function requestPinRecoveryOtp(
  clientId: string,
  email: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const url = baseUrl();
  if (!url) {
    return { ok: false, error: "Servizio cloud non configurato." };
  }
  if (!navigator.onLine) {
    return {
      ok: false,
      error: "Connessione internet necessaria per il recupero via email.",
    };
  }
  try {
    const res = await axios.post(`${url}/pin-recovery/request`, {
      id: clientId,
      email: email.trim().toLowerCase(),
    });
    return { ok: true, message: res.data?.message };
  } catch (e: unknown) {
    const msg =
      axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
        ? e.response.data.error
        : "Impossibile inviare il codice. Verifica la connessione.";
    return { ok: false, error: msg };
  }
}

export async function verifyPinRecoveryOtp(
  clientId: string,
  email: string,
  otp: string,
): Promise<{ ok: boolean; grant?: string; error?: string }> {
  const url = baseUrl();
  if (!url) {
    return { ok: false, error: "Servizio cloud non configurato." };
  }
  try {
    const res = await axios.post(`${url}/pin-recovery/verify`, {
      id: clientId,
      email: email.trim().toLowerCase(),
      otp: otp.replace(/\D/g, ""),
    });
    const grant = res.data?.grant;
    if (!grant) {
      return { ok: false, error: "Risposta server non valida." };
    }
    return { ok: true, grant: String(grant) };
  } catch (e: unknown) {
    const msg =
      axios.isAxiosError(e) && typeof e.response?.data?.error === "string"
        ? e.response.data.error
        : "Codice non valido o scaduto.";
    return { ok: false, error: msg };
  }
}
