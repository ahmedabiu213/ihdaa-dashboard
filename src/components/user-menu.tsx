import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="truncate px-2 pb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden" dir="ltr">
          {user?.email}
        </div>
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
