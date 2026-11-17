"use client";

import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import type { Role } from "@/lib/roles";

type MenuUser = { email: string; role: Role } | null;
import { logout } from "@/app/login/actions";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function UserMenu({ user }: { user: MenuUser }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="truncate px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden" dir="ltr">
          {user?.email}
        </div>
        <SidebarMenuButton asChild tooltip="حسابي">
          <Link href="/account" onClick={() => { if (isMobile) setOpenMobile(false); }}><KeyRound /><span>حسابي</span></Link>
        </SidebarMenuButton>
        <form action={logout}>
          <SidebarMenuButton type="submit" tooltip="تسجيل الخروج">
            <LogOut />
            <span>تسجيل الخروج</span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
