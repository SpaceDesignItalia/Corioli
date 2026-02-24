import React from "react";
import {Link} from "react-router-dom";

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
};

export default function Sidebar({items, defaultSelectedKey}: {items: SidebarItem[]; defaultSelectedKey?: string}) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => (
        <Link key={item.key} to={item.href} className="rounded-md px-3 py-2 text-sm hover:bg-default-100 data-[active=true]:bg-default-100" data-active={item.key===defaultSelectedKey}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}


