import React from "react";
import {ScrollShadow} from "@nextui-org/react";
import Sidebar from "./sidebar/Sidebar";
import {AcmeIcon} from "./sidebar/AcmeIcon";
import {items} from "./sidebar/sidebar-items";

export default function AppSidebar() {
  return (
    <div className="h-full min-h-192">
      <div className="border-r-small border-divider h-full w-72 p-6">
        <div className="flex items-center gap-2 px-2">
          <div className="bg-foreground flex h-8 w-8 items-center justify-center rounded-full">
            <AcmeIcon className="text-background" />
          </div>
          <span className="text-small font-bold uppercase">Acme</span>
        </div>
        <ScrollShadow className="h-full max-h-full py-[10vh]">
          <Sidebar defaultSelectedKey="home" items={items} />
        </ScrollShadow>
      </div>
    </div>
  );
}


