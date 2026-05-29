import { useState, useEffect } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Tooltip,
  Button,
  Spinner,
  Badge,
} from "@nextui-org/react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { DoctorService } from "../services/OfflineServices";
import { RefreshCw } from "lucide-react";
import { storageService } from "../services/StorageServiceFallback";
import { sendHeartbeat } from "../services/HeartbeatService";
import { fetchClientUnreadCount } from "../services/SupportChatService";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";

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
  const { requestNavigation } = useUnsavedChanges();

  const goTo = (href: string) => {
    if (requestNavigation(href)) navigate(href);
  };

  const onGuardedNavClick = (
    event: React.MouseEvent,
    href: string,
  ) => {
    if (location.pathname === href) return;
    if (!requestNavigation(href)) event.preventDefault();
  };
  const [primaryAmbulatorio, setPrimaryAmbulatorio] = useState<string | null>(
    null,
  );
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
            onClick={(e) => onGuardedNavClick(e, "/")}
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
              onClick={(e) => onGuardedNavClick(e, item.href)}
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
                onClick={() => goTo("/settings")}
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
                onClick={() => goTo("/settings")}
              >
                <i className="ti ti-alert-triangle" aria-hidden />
                Imposta ambulatorio
              </button>
            </Tooltip>
          )}
        </NavbarItem>

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
              onClick={() => goTo("/settings")}
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
              onClick={() => goTo("/settings")}
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
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.label}-${index}`}>
            <Link
              to={item.href}
              onClick={(e) => onGuardedNavClick(e, item.href)}
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
