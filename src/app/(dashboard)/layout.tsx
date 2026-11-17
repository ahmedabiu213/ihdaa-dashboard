import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/supabase/server";

/** The sidebar depends on the signed-in user's role (viewers see donation pages only). */
async function SidebarForUser() {
  const user = await getCurrentUser();
  return <AppSidebar role={user?.role ?? null} footer={<UserMenu user={user} />} />;
}

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebar role={null} footer={null} />}>
        <SidebarForUser />
      </Suspense>
      <SidebarInset className="bg-background">{children}</SidebarInset>
    </SidebarProvider>
  );
}
