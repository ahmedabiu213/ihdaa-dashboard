"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/brand-mark";
import { NAV } from "@/components/nav";
import { canOpen, type Role } from "@/lib/roles";

/** `role` null while the user is loading: no links yet, so a viewer never sees staff pages flash by. */
export function AppSidebar({ footer, role }: { footer: React.ReactNode; role: Role | null }) {
  const pathname = usePathname();
  const groups = role == null ? [] : NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => canOpen(role, i.href)) }))
    .filter((g) => g.items.length > 0);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <BrandMark />
                <div className="grid leading-tight">
                  <span className="font-semibold text-brand-navy">جمعية إهداء</span>
                  <span className="text-xs text-brand-steel">{role === "viewer" ? "لوحة التبرعات" : "لوحة التسويق"}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label} className="data-[active=true]:shadow-[inset_-3px_0_0_var(--brand-gold)]">
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
