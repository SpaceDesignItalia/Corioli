import axios from "axios";
import { IS_DEMO } from "../demo";
import { Doctor } from "../types/Storage";
import { conteggiArchivioReale } from "./StorageServiceFallback";
import { salvaLicenza, type LicenzaServer } from "./AbbonamentoService";

interface HeartbeatResult {
  blocked: boolean | null;
  reason: string | null;
}

const getAppVersion = async (): Promise<string> => {
  const electronApi = (window as unknown as {
    electronAPI?: {
      getAppVersion?: () => Promise<string>;
    };
  }).electronAPI;

  if (electronApi?.getAppVersion) {
    try {
      return await electronApi.getAppVersion();
    } catch {
      // fallback below
    }
  }

  return import.meta.env.VITE_APP_VERSION || "unknown";
};

export const sendHeartbeat = async (
  doctor: Doctor,
  app: "corioli" | "corioli-pediatria",
): Promise<HeartbeatResult> => {
  // Demo: nessun contatto con il server.
  if (IS_DEMO) return { blocked: false, reason: null };
  try {
    // Servono solo i conteggi, e dall'archivio vero anche a guida aperta: le
    // pazienti inventate della prova non vanno contate.
    const [{ pazienti: patients, visite: visits }, version] = await Promise.all([
      conteggiArchivioReale(),
      getAppVersion(),
    ]);

    const isOnline = navigator.onLine;
    const activeUsers = isOnline ? 1 : 0;
    const offlineUsers = isOnline ? 0 : 1;

    const result = await axios.post(`${import.meta.env.VITE_API_URL}/heartbeat`, {
      id: doctor.id,
      nome: doctor.nome,
      cognome: doctor.cognome,
      email: doctor.email,
      numero_telefono: doctor.telefono,
      specializzazione: doctor.specializzazione,
      tipo: app === "corioli-pediatria" ? "pediatria" : "ginecologia",
      app,
      version,
      activeUsers,
      offlineUsers,
      patients,
      visits,
    });

    // Licenza dell'abbonamento: i backend precedenti non la mandano, e allora
    // resta quella salvata l'ultima volta.
    const license = result.data?.license as LicenzaServer | null | undefined;
    if (license && typeof license.required === "boolean") {
      await salvaLicenza(license);
    }

    return {
      blocked: Boolean(result.data?.blocked),
      reason: typeof result.data?.reason === "string" ? result.data.reason : null,
    };
  } catch (e) {
    console.error("sendHeartbeat:", e);
    return { blocked: null, reason: null };
  }
};
