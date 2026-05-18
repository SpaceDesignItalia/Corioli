import React, { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "default",
  actions,
  children,
}: PageHeaderProps) {
  const getIconStyles = (color: string) => {
    switch (color) {
      case "primary":
        return "bg-slate-800 text-white";
      case "success":
        return "bg-success-100 text-success-700";
      case "warning":
        return "bg-warning-100 text-warning-700";
      case "danger":
        return "bg-danger-100 text-danger-700";
      default:
        return "bg-default-100 text-default-600";
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${getIconStyles(iconColor)}`}>
            <Icon className="hidden md:block w-8 h-8" />
            <Icon className="md:hidden w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            <p className="text-default-500 mt-1">{subtitle}</p>
          </div>
        </div>
        {actions && (
          <div className="flex gap-3 w-full md:w-auto">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
