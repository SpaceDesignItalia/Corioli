import { Card, CardBody } from "@nextui-org/react";
import { KeyRound, Lock, Mail, User } from "lucide-react";
import type { ReactNode } from "react";

export type AppLockShellIcon = "lock" | "user" | "key" | "mail";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: AppLockShellIcon;
  /** Schermata a tutto schermo (setup) o overlay sopra lo sblocco PIN */
  overlay?: boolean;
};

function ShellIcon({ icon }: { icon: AppLockShellIcon }) {
  const className = "text-primary h-7 w-7";
  if (icon === "user") return <User className={className} />;
  if (icon === "key") return <KeyRound className={className} />;
  if (icon === "mail") return <Mail className={className} />;
  return <Lock className={className} />;
}

export default function AppLockShell({
  title,
  subtitle,
  children,
  icon = "lock",
  overlay = false,
}: Props) {
  const card = (
    <Card className="w-full max-w-md shadow-lg corioli-card">
      <CardBody className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center">
            <ShellIcon icon={icon} />
          </div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-default-500">{subtitle}</p> : null}
        </div>
        {children}
      </CardBody>
    </Card>
  );

  const centered = (
    <div
      className={
        overlay
          ? "min-h-full flex items-center justify-center p-6"
          : "min-h-screen corioli-auth-bg flex items-center justify-center p-6"
      }
    >
      {card}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto corioli-auth-bg">{centered}</div>
    );
  }

  return centered;
}
