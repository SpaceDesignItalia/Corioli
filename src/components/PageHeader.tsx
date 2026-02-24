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
    iconColor = "primary",
    actions,
    children
}: PageHeaderProps) {

    const getGradient = (color: string) => {
        switch (color) {
            case "primary": return "from-blue-500 to-indigo-600";
            case "secondary": return "from-purple-500 to-pink-600";
            case "success": return "from-emerald-500 to-teal-600";
            case "warning": return "from-amber-500 to-orange-600";
            case "danger": return "from-rose-500 to-red-600";
            default: return "from-gray-500 to-slate-600";
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getGradient(iconColor)} shadow-lg shadow-${iconColor}/20`}>
                        <Icon className="hidden md:block w-8 h-8 text-white" />
                        <Icon className="md:hidden w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                            {title}
                        </h1>
                        <p className="text-gray-500 mt-1 font-medium">
                            {subtitle}
                        </p>
                    </div>
                </div>
                {actions && (
                    <div className="flex gap-3 w-full md:w-auto">
                        {actions}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
