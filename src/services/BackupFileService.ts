import { storageService } from "./StorageServiceFallback";
import { todayIsoDate } from "../utils/dateUtils";

/**
 * Backup automatici del database locale.
 *
 * Sono copie del file SQLite gestite dal main process in `userData/backups/`.
 * A differenza dell'export JSON manuale non richiedono alcuna azione del medico:
 * l'app ne crea uno al primo avvio di ogni giorno e prima di ogni operazione
 * distruttiva (import di un backup, ripristino).
 */

export type BackupReason = "auto" | "manuale" | "pre-import" | "pre-restore";

export interface BackupFileInfo {
  fileName: string;
  reason: string;
  size: number;
  createdAt: string;
}

interface BackupApi {
  backupCreate?: (reason: BackupReason) => Promise<{
    ok: boolean;
    fileName?: string;
    error?: string;
  }>;
  backupList?: () => Promise<{ ok: boolean; items: BackupFileInfo[] }>;
  backupRestore?: (fileName: string) => Promise<{ ok: boolean; error?: string }>;
  backupOpenFolder?: () => Promise<{ ok: boolean; error?: string }>;
}

function api(): BackupApi | null {
  const electronApi = (window as unknown as { electronAPI?: BackupApi })
    .electronAPI;
  return electronApi?.backupCreate ? electronApi : null;
}

/** True se i backup automatici su file sono disponibili (app desktop). */
export function isFileBackupAvailable(): boolean {
  return api() !== null;
}

/**
 * Crea subito un backup del database.
 * Restituisce `null` fuori da Electron (nel browser il file DB non esiste).
 */
export async function createBackupFile(
  reason: BackupReason,
): Promise<{ ok: boolean; fileName?: string; error?: string } | null> {
  const electronApi = api();
  if (!electronApi?.backupCreate) return null;
  try {
    return await electronApi.backupCreate(reason);
  } catch (error) {
    console.error("Backup automatico non riuscito:", error);
    return { ok: false, error: String(error) };
  }
}

export async function listBackupFiles(): Promise<BackupFileInfo[]> {
  const electronApi = api();
  if (!electronApi?.backupList) return [];
  try {
    const res = await electronApi.backupList();
    return res?.ok ? res.items : [];
  } catch (error) {
    console.error("Elenco backup non disponibile:", error);
    return [];
  }
}

/** Ripristina un backup e riavvia l'app. Operazione distruttiva: chiedere conferma prima. */
export async function restoreBackupFile(
  fileName: string,
): Promise<{ ok: boolean; error?: string }> {
  const electronApi = api();
  if (!electronApi?.backupRestore) {
    return { ok: false, error: "Ripristino disponibile solo nell'app desktop." };
  }
  return await electronApi.backupRestore(fileName);
}

export async function openBackupsFolder(): Promise<void> {
  const electronApi = api();
  if (!electronApi?.backupOpenFolder) return;
  await electronApi.backupOpenFolder();
}

/** Chiave dedicata: non condivide il blob `preferences` per non rischiare sovrascritture. */
const LAST_AUTO_BACKUP_KEY = "last_auto_backup_date";

/**
 * Crea un backup automatico al massimo una volta al giorno.
 * Chiamata all'avvio; silenziosa e non bloccante.
 */
export async function runDailyAutoBackup(): Promise<void> {
  if (!isFileBackupAvailable()) return;
  const today = todayIsoDate();
  const last = await storageService.getPreference(LAST_AUTO_BACKUP_KEY);
  if (last === today) return;

  const result = await createBackupFile("auto");
  if (result?.ok) {
    await storageService.setPreference(LAST_AUTO_BACKUP_KEY, today);
  }
}

/** Data (YYYY-MM-DD) dell'ultimo backup automatico riuscito. */
export async function getLastAutoBackupDate(): Promise<string | null> {
  return await storageService.getPreference(LAST_AUTO_BACKUP_KEY);
}
