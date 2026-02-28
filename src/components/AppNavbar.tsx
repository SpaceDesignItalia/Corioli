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
  Avatar,
  Button,
} from "@nextui-org/react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { AcmeIcon } from "./sidebar/AcmeIcon";
import { DoctorService } from "../services/OfflineServices";
import { Download, MapPin, RefreshCw } from "lucide-react";
import { useOrbyt } from "@orbytapp/orbyt-sdk/react";
import { storageService } from "../services/StorageServiceFallback";

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Pazienti", href: "/pazienti" },
  { label: "Visite", href: "/visite" },
  { label: "Documenti", href: "/documents" },
  { label: "Impostazioni", href: "/settings" },
  { label: "Guida", href: "/help" },
];

export default function AppNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getFeatureFlag } = useOrbyt();
  const [primaryAmbulatorio, setPrimaryAmbulatorio] = useState<string | null>(
    null,
  );
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  const loadDoctor = async () => {
    try {
      const doctor = await DoctorService.getDoctor();
      const primary = doctor?.ambulatori?.find(
        (a: { isPrimario?: boolean }) => a.isPrimario,
      );
      setPrimaryAmbulatorio(primary?.nome ?? null);
      setProfileImage(doctor?.profileImage ?? null);
    } catch {
      setPrimaryAmbulatorio(null);
      setProfileImage(null);
    }
  };

  const BLOCKED_STORAGE_KEY = "blocked_users";
  const ONE_HOUR_MS = 60 * 60 * 1000;

  useEffect(() => {
    loadDoctor();

    const checkFeature = async () => {
      try {
        const doctor = await DoctorService.getDoctor();
        const email = doctor?.email?.trim();
        if (!email) return;

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

        const result = await getFeatureFlag("blocked_users", { email });
        const isBlocked = result?.value === true;
        const payload = {
          blocked: isBlocked,
          checkedAt: new Date().toISOString(),
        };
        await storageService.setPreference(
          BLOCKED_STORAGE_KEY,
          JSON.stringify(payload),
        );

        if (isBlocked) navigate("/blocked");
      } catch (e) {
        console.error("checkFeature blocked_users:", e);
      }
    };
    void checkFeature();
  }, [getFeatureFlag, navigate]);

  useEffect(() => {
    const onDoctorUpdated = () => loadDoctor();
    window.addEventListener("appdottori-doctor-updated", onDoctorUpdated);
    return () =>
      window.removeEventListener("appdottori-doctor-updated", onDoctorUpdated);
  }, []);

  useEffect(() => {
    const api = (window as unknown as {
      electronAPI?: {
        updaterCheck?: () => Promise<{
          version?: string;
          noUpdate?: boolean;
          error?: string;
        }>;
        updaterQuitAndInstall?: () => void;
        onUpdaterChecking?: (cb: () => void) => void;
        onUpdaterAvailable?: (cb: (info: { version?: string }) => void) => void;
        onUpdaterNotAvailable?: (cb: () => void) => void;
        onUpdaterDownloaded?: (cb: () => void) => void;
      };
    }).electronAPI;

    if (!api) return;

    api.onUpdaterChecking?.(() => {
      setUpdateAvailable(null);
      setUpdateDownloaded(false);
    });
    api.onUpdaterAvailable?.((info) => {
      setUpdateAvailable(info?.version || "Nuova versione");
      setUpdateDownloaded(false);
    });
    api.onUpdaterNotAvailable?.(() => {
      setUpdateAvailable(null);
      setUpdateDownloaded(false);
    });
    api.onUpdaterDownloaded?.(() => {
      setUpdateDownloaded(true);
      setUpdateAvailable(null);
    });

    // Controllo automatico all'apertura dell'app.
    api
      .updaterCheck?.()
      .then((result) => {
        if (result?.version) setUpdateAvailable(result.version);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const handleReloadApp = () => {
    window.location.reload();
  };

  const handleInstallUpdate = () => {
    const api = (window as unknown as {
      electronAPI?: { updaterQuitAndInstall?: () => void };
    }).electronAPI;
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
        className="border-small border-default-200/20 bg-background/60 shadow-medium gap-4 rounded-full px-4 backdrop-blur-md backdrop-saturate-150"
        justify="center"
      >
        {/* Toggle */}
        <NavbarMenuToggle className="text-default-400 ml-2 md:hidden" />

        {/* Logo / Foto profilo */}
        <NavbarBrand className="mr-4 w-[40vw] md:w-auto md:max-w-fit">
          {profileImage ? (
            <Avatar
              src={profileImage}
              className="w-10 h-10 flex-shrink-0"
              size="md"
            />
          ) : (
            <div className="bg-emerald-500 text-white rounded-full p-2">
              <AcmeIcon className="text-white" />
            </div>
          )}
          <span className="ml-3 font-bold text-lg md:block">Corioli</span>
        </NavbarBrand>

        {/* Navigation Items */}
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavbarItem key={item.href} className="hidden md:flex">
              <Link
                to={item.href}
                className={`text-sm ${isActive ? "text-emerald-600 font-medium" : "text-default-500"} hover:text-emerald-600 transition-colors`}
              >
                {item.label}
              </Link>
            </NavbarItem>
          );
        })}

        {/* Ambulatorio attuale - clic per andare a Impostazioni */}
        <NavbarItem className="hidden sm:flex ml-2 pl-2 border-l border-default-200">
          <Tooltip content="Clicca per aprire Impostazioni e cambiare la sede in uso">
            <Chip
              size="sm"
              variant="flat"
              color="success"
              startContent={<MapPin size={14} className="text-success" />}
              className="cursor-pointer font-medium hover:opacity-90 transition-opacity"
              onClick={() => navigate("/settings")}
              role="button"
            >
              {primaryAmbulatorio || "Nessun ambulatorio"}
            </Chip>
          </Tooltip>
        </NavbarItem>

        {(updateAvailable || updateDownloaded) && (
          <NavbarItem className="hidden md:flex">
            {updateDownloaded ? (
              <Tooltip content="Installa l'aggiornamento e riavvia">
                <Button
                  size="sm"
                  color="success"
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
        className="rounded-large border-small border-default-200/20 bg-background/60 shadow-medium top-[calc(var(--navbar-height)/2)] mx-auto mt-16 max-h-[40vh] max-w-[80vw] py-6 backdrop-blur-md backdrop-saturate-150"
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
          <button
            type="button"
            className="flex items-center gap-2 text-default-500 text-sm w-full text-left hover:text-foreground"
            onClick={() => navigate("/settings")}
          >
            <MapPin size={16} className="text-success flex-shrink-0" />
            <span>
              Ambulatorio:{" "}
              <strong className="text-foreground">
                {primaryAmbulatorio || "—"}
              </strong>
            </span>
          </button>
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
        {(updateAvailable || updateDownloaded) && (
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
              className="text-default-500 w-full text-md hover:text-emerald-600 transition-colors"
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}
