export type AppLockStatus = {
  configured: boolean;
  canRevealRecovery: boolean;
};

export type AppLockSetupResult = {
  ok: boolean;
  recoveryCode?: string;
  recoveryStoredSecurely?: boolean;
  error?: string;
};

type ElectronAppLockApi = {
  appLockStatus?: () => Promise<AppLockStatus>;
  appLockSetup?: (pin: string) => Promise<AppLockSetupResult>;
  appLockVerifyPin?: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  appLockRevealRecovery?: (pin: string) => Promise<{
    ok: boolean;
    recoveryCode?: string;
    error?: string;
  }>;
  appLockRegenerateRecovery?: (pin: string) => Promise<AppLockSetupResult>;
  appLockChangePin?: (payload: {
    currentPin: string;
    newPin: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  appLockResetPinWithRecovery?: (payload: {
    recoveryCode: string;
    newPin: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

function api(): ElectronAppLockApi | undefined {
  return (window as unknown as { electronAPI?: ElectronAppLockApi }).electronAPI;
}

export function isAppLockAvailable(): boolean {
  return Boolean(api()?.appLockStatus);
}

export async function getAppLockStatus(): Promise<AppLockStatus | null> {
  return (await api()?.appLockStatus?.()) ?? null;
}

export async function setupAppLock(pin: string): Promise<AppLockSetupResult> {
  const res = await api()?.appLockSetup?.(pin);
  return res ?? { ok: false, error: "Funzione non disponibile." };
}

export async function verifyAppLockPin(
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api()?.appLockVerifyPin?.(pin);
  return res ?? { ok: false, error: "Funzione non disponibile." };
}

export async function revealRecoveryCode(
  pin: string,
): Promise<{ ok: boolean; recoveryCode?: string; error?: string }> {
  const res = await api()?.appLockRevealRecovery?.(pin);
  return res ?? { ok: false, error: "Funzione non disponibile." };
}

export async function regenerateRecoveryCode(
  pin: string,
): Promise<AppLockSetupResult> {
  const res = await api()?.appLockRegenerateRecovery?.(pin);
  return res ?? { ok: false, error: "Funzione non disponibile." };
}

export async function changeAppLockPin(
  currentPin: string,
  newPin: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api()?.appLockChangePin?.({ currentPin, newPin });
  return res ?? { ok: false, error: "Funzione non disponibile." };
}

export async function resetPinWithRecovery(
  recoveryCode: string,
  newPin: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await api()?.appLockResetPinWithRecovery?.({
    recoveryCode,
    newPin,
  });
  return res ?? { ok: false, error: "Funzione non disponibile." };
}
