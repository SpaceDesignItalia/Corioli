import { useState, useEffect } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Chip,
  Tooltip,
  Button,
  Spinner,
  Badge,
} from "@nextui-org/react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { DoctorService } from "../services/OfflineServices";
import { Download, RefreshCw } from "lucide-react";
import { storageService } from "../services/StorageServiceFallback";
import { sendHeartbeat } from "../services/HeartbeatService";
import { fetchClientUnreadCount } from "../services/SupportChatService";
import axios from "axios";

const SUPPORT_UNREAD_POLL_MS = 45_000;

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Pazienti", href: "/pazienti" },
  { label: "Visite", href: "/visite" },
  { label: "Documenti", href: "/documents" },
  { label: "Impostazioni", href: "/settings" },
  { label: "Aiuto", href: "/help" },
];

export default function AppNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [primaryAmbulatorio, setPrimaryAmbulatorio] = useState<string | null>(
    null,
  );
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);

  const loadDoctor = async () => {
    try {
      const doctor = await DoctorService.getDoctor();
      const primary = doctor?.ambulatori?.find(
        (a: { isPrimario?: boolean }) => a.isPrimario,
      );
      setPrimaryAmbulatorio(primary?.nome ?? null);
    } catch {
      setPrimaryAmbulatorio(null);
    }
  };

  const BLOCKED_STORAGE_KEY = "blocked_users";
  const ONE_HOUR_MS = 60 * 1000; // 1 minute

  useEffect(() => {
    loadDoctor();

    const checkFeature = async () => {
      try {
        const doctor = await DoctorService.getDoctor();
        const id = doctor?.id?.trim();
        if (!id) return;

        const raw = await storageService.getPreference(BLOCKED_STORAGE_KEY);
        let lastCheckedAt: number | null = null;
        if (raw) {
          try {
            const data = JSON.parse(raw) as {
              blocked?: boolean;
              checkedAt?: string;
            };
            if (data.checkedAt) {
              lastCheckedAt = new Date(data.checkedAt).getTime();
              if (Date.now() - lastCheckedAt < ONE_HOUR_MS) return;
            }
          } catch {
            // ignore invalid stored data
          }
        }

        if (doctor) {
          const { blocked, reason } = await sendHeartbeat(doctor, "corioli");
          if (blocked === null) return;
          const payload = {
            blocked: blocked,
            reason: reason,
            checkedAt: new Date().toISOString(),
          };
          await storageService.setPreference(
            BLOCKED_STORAGE_KEY,
            JSON.stringify(payload),
          );

          if (blocked === true) navigate("/blocked");
        }
      } catch (e) {
        console.error("checkFeature blocked_users:", e);
      }
    };
    void checkFeature();
  }, [navigate]);

  useEffect(() => {
    const onDoctorUpdated = () => loadDoctor();
    window.addEventListener("appdottori-doctor-updated", onDoctorUpdated);
    return () =>
      window.removeEventListener("appdottori-doctor-updated", onDoctorUpdated);
  }, []);

  useEffect(() => {
    const api = (
      window as unknown as {
        electronAPI?: {
          updaterCheck?: () => Promise<{
            version?: string;
            noUpdate?: boolean;
            error?: string;
          }>;
          updaterQuitAndInstall?: () => void;
          onUpdaterChecking?: (cb: () => void) => void;
          onUpdaterAvailable?: (
            cb: (info: { version?: string }) => void,
          ) => void;
          onUpdaterNotAvailable?: (cb: () => void) => void;
          onUpdaterProgress?: (cb: (p: { percent?: number }) => void) => void;
          onUpdaterDownloaded?: (cb: () => void) => void;
        };
      }
    ).electronAPI;

    if (!api) return;

    api.onUpdaterChecking?.(() => {
      setUpdateChecking(true);
      setUpdateAvailable(null);
      setUpdateDownloaded(false);
      setUpdateDownloading(false);
    });
    api.onUpdaterAvailable?.((info) => {
      setUpdateChecking(false);
      setUpdateAvailable(info?.version || "Nuova versione");
      setUpdateDownloaded(false);
      setUpdateDownloading(true);
    });
    api.onUpdaterNotAvailable?.(() => {
      setUpdateChecking(false);
      setUpdateAvailable(null);
      setUpdateDownloaded(false);
      setUpdateDownloading(false);
    });
    api.onUpdaterProgress?.(() => {
      setUpdateDownloading(true);
    });
    api.onUpdaterDownloaded?.(() => {
      setUpdateDownloading(false);
      setUpdateDownloaded(true);
      setUpdateAvailable(null);
    });

    const checkUpdateIfAllowed = async () => {
      try {
        setUpdateChecking(true);
        const doctor = await DoctorService.getDoctor();
        const clientId = doctor?.id?.trim();
        if (!clientId) {
          setUpdateChecking(false);
          return;
        }

        const appVersion = await (
          (window as unknown as { electronAPI?: { getAppVersion?: () => Promise<string> } })
            .electronAPI?.getAppVersion?.() ?? Promise.resolve("0.0.0")
        );

        const access = await axios.get<{ shouldUpdate: boolean; allowed: boolean }>(
          `${import.meta.env.VITE_API_URL}/updates/check-access`,
          {
            params: {
              app: "corioli",
              clientId,
              currentVersion: appVersion,
            },
          },
        );

        if (!access.data.allowed || !access.data.shouldUpdate) {
          setUpdateAvailable(null);
          setUpdateDownloaded(false);
          setUpdateChecking(false);
          return;
        }

        const result = await api.updaterCheck?.();
        if (result?.version) {
          setUpdateAvailable(result.version);
        }
        setUpdateChecking(false);
      } catch {
        setUpdateChecking(false);
      }
    };

    void checkUpdateIfAllowed();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const pollUnread = async () => {
      try {
        const doctor = await DoctorService.getDoctor();
        if (!doctor?.id || cancelled) return;
        const count = await fetchClientUnreadCount(doctor.id);
        if (!cancelled) setSupportUnread(count);
      } catch {
        // silenzioso
      }
    };

    pollUnread();
    const interval = setInterval(pollUnread, SUPPORT_UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [location.pathname]);

  const handleReloadApp = () => {
    window.location.reload();
  };

  const handleInstallUpdate = () => {
    const api = (
      window as unknown as {
        electronAPI?: { updaterQuitAndInstall?: () => void };
      }
    ).electronAPI;
    api?.updaterQuitAndInstall?.();
  };

  return (
    <Navbar
      classNames={{
        base: "py-4 backdrop-filter-none bg-transparent",
        wrapper: "px-0 w-full justify-center bg-transparent",
        item: "hidden md:flex",
      }}
      height="64px"
    >
      <NavbarContent
        className="border-small border-default-200 bg-white/90 shadow-medium gap-4 rounded-full px-4 backdrop-blur-md backdrop-saturate-150"
        justify="center"
      >
        {/* Toggle */}
        <NavbarMenuToggle className="text-default-400 ml-2 md:hidden" />

        {/* Logo brand */}
        <NavbarBrand className="mr-4 min-w-0 max-w-[min(56vw,260px)] shrink md:max-w-[220px] lg:max-w-[260px]">
          <Link
            to="/"
            className="flex min-w-0 items-center outline-none ring-offset-2 ring-offset-background rounded-md focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Corioli — vai alla dashboard"
          >
            <img
              src={`${import.meta.env.BASE_URL}corioli-logo-navbar.png`}
              alt="Corioli"
              width={220}
              height={40}
              className="h-7 w-auto max-h-8 object-contain object-left md:h-8 md:max-h-9"
              decoding="async"
            />
          </Link>
        </NavbarBrand>

        {/* Navigation Items */}
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          const link = (
            <Link
              to={item.href}
              className={`text-sm ${isActive ? "text-foreground font-semibold" : "text-default-500"} hover:text-foreground transition-colors`}
            >
              {item.label}
            </Link>
          );
          return (
            <NavbarItem key={item.href} className="hidden md:flex">
              {item.href === "/help" && supportUnread > 0 ? (
                <Badge content={supportUnread > 99 ? "99+" : supportUnread} color="danger" size="sm">
                  {link}
                </Badge>
              ) : (
                link
              )}
            </NavbarItem>
          );
        })}

        {/* Ambulatorio attuale - clic per andare a Impostazioni */}
        <NavbarItem className="hidden sm:flex ml-2 pl-2 border-l border-default-200">
          {primaryAmbulatorio ? (
            <Tooltip content="Clicca per aprire Impostazioni e cambiare la sede in uso">
              <button
                type="button"
                className="navbar-ambulatorio-set"
                onClick={() => navigate("/settings")}
              >
                <i className="ti ti-map-pin" aria-hidden />
                {primaryAmbulatorio}
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Configura l'ambulatorio primario nelle Impostazioni">
              <button
                type="button"
                className="navbar-ambulatorio-cta"
                onClick={() => navigate("/settings")}
              >
                <i className="ti ti-alert-triangle" aria-hidden />
                Imposta ambulatorio
              </button>
            </Tooltip>
          )}
        </NavbarItem>

        {updateChecking && (
          <NavbarItem className="hidden md:flex">
            <Tooltip content="Controllo aggiornamenti in corso">
              <span className="flex items-center gap-1.5 text-default-500 text-sm">
                <Spinner size="sm" color="primary" />
                Controllo aggiornamenti...
              </span>
            </Tooltip>
          </NavbarItem>
        )}
        {updateDownloading && (
          <NavbarItem className="hidden md:flex">
            <Tooltip content="Download aggiornamento in corso">
              <span className="flex items-center gap-1.5 text-primary text-sm">
                <Spinner size="sm" color="primary" />
                Download in corso...
              </span>
            </Tooltip>
          </NavbarItem>
        )}
        {(updateAvailable || updateDownloaded) && !updateDownloading && (
          <NavbarItem className="hidden md:flex">
            {updateDownloaded ? (
              <Tooltip content="Installa l'aggiornamento e riavvia">
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleInstallUpdate}
                  startContent={<Download size={14} />}
                >
                  Installa update
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content="Aggiornamento disponibile: apri Impostazioni">
                <Chip
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="cursor-pointer font-medium hover:opacity-90 transition-opacity"
                  onClick={() => navigate("/settings")}
                  role="button"
                >
                  Aggiornamento disponibile
                </Chip>
              </Tooltip>
            )}
          </NavbarItem>
        )}

        <NavbarItem className="hidden md:flex">
          <Tooltip content="Ricarica l'app (utile dopo import/backup)">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color="default"
              aria-label="Ricarica app"
              onPress={handleReloadApp}
            >
              <RefreshCw size={14} />
            </Button>
          </Tooltip>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu
        className="rounded-large border-small border-default-200 bg-white/95 shadow-medium top-[calc(var(--navbar-height)/2)] mx-auto mt-16 max-h-[40vh] max-w-[80vw] py-6 backdrop-blur-md backdrop-saturate-150"
        motionProps={{
          initial: { opacity: 0, y: -20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -20 },
          transition: {
            ease: "easeInOut",
            duration: 0.2,
          },
        }}
      >
        <NavbarMenuItem className="pt-2 pb-3 border-b border-default-100">
          {primaryAmbulatorio ? (
            <button
              type="button"
              className="navbar-ambulatorio-set w-full text-left"
              onClick={() => navigate("/settings")}
            >
              <i className="ti ti-map-pin" aria-hidden />
              <span>
                Ambulatorio: <strong>{primaryAmbulatorio}</strong>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="navbar-ambulatorio-cta"
              onClick={() => navigate("/settings")}
            >
              <i className="ti ti-alert-triangle" aria-hidden />
              Imposta ambulatorio
            </button>
          )}
        </NavbarMenuItem>
        <NavbarMenuItem className="pb-3 border-b border-default-100">
          <button
            type="button"
            className="flex items-center gap-2 text-default-500 text-sm w-full text-left hover:text-foreground"
            onClick={handleReloadApp}
          >
            <RefreshCw size={16} className="flex-shrink-0" />
            <span>Ricarica app</span>
          </button>
        </NavbarMenuItem>
        {updateChecking && (
          <NavbarMenuItem className="pb-3 border-b border-default-100">
            <span className="flex items-center gap-2 text-default-500 text-sm">
              <Spinner size="sm" color="primary" />
              Controllo aggiornamenti...
            </span>
          </NavbarMenuItem>
        )}
        {updateDownloading && (
          <NavbarMenuItem className="pb-3 border-b border-default-100">
            <span className="flex items-center gap-2 text-primary text-sm">
              <Spinner size="sm" color="primary" />
              Download in corso...
            </span>
          </NavbarMenuItem>
        )}
        {(updateAvailable || updateDownloaded) && !updateDownloading && (
          <NavbarMenuItem className="pb-3 border-b border-default-100">
            {updateDownloaded ? (
              <button
                type="button"
                className="flex items-center gap-2 text-success text-sm w-full text-left hover:opacity-80"
                onClick={handleInstallUpdate}
              >
                <Download size={16} className="flex-shrink-0" />
                <span>Installa aggiornamento</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 text-primary text-sm w-full text-left hover:opacity-80"
                onClick={() => navigate("/settings")}
              >
                <Download size={16} className="flex-shrink-0" />
                <span>Aggiornamento disponibile</span>
              </button>
            )}
          </NavbarMenuItem>
        )}
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.label}-${index}`}>
            <Link
              to={item.href}
              className="text-default-500 w-full text-md hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}
