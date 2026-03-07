import { SidebarItem } from "./Sidebar";

export const items: SidebarItem[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "pazienti", label: "Pazienti", href: "/pazienti" },
  { key: "visite", label: "Visite", href: "/visite" },
  { key: "add-patient", label: "Nuovo Paziente", href: "/add-patient" },
  { key: "check-patient", label: "Cerca Paziente", href: "/check-patient" },
  { key: "documents", label: "Documenti", href: "/documents" },
  { key: "settings", label: "Impostazioni", href: "/settings" },
  { key: "help", label: "Help", href: "/help" },
];
