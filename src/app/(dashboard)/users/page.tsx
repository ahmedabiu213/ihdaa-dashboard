import { Suspense } from "react";
import { connection } from "next/server";
import { ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SectionsSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { getCurrentUser } from "@/lib/supabase/server";
import { roleOf } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CreateUserForm, DeleteDialog, PasswordDialog, RoleControl } from "./user-forms";

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{children}</div>;
}

async function Content() {
  await connection();
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return <Notice>إدارة المستخدمين متاحة للمسؤولين فقط. اطلب من مسؤول منحك الصلاحية.</Notice>;
  }
  const admin = supabaseAdmin();
  if (!admin) {
    return (
      <Notice>
        أضف المتغير <code dir="ltr">SUPABASE_SERVICE_ROLE_KEY</code> في Vercel (من Supabase ← Project Settings ← API Keys ← secret key) ثم أعد النشر.
      </Notice>
    );
  }
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return <Notice>تعذّر جلب المستخدمين: {error.message}</Notice>;
  const users = [...(data.users ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const adminCount = users.filter((u) => u.app_metadata?.role === "admin").length;

  return (
    <>
      <SectionCard title="إضافة مستخدم" description="ينشئ حسابًا جاهزًا للدخول فورًا بالبريد وكلمة المرور">
        <CreateUserForm />
      </SectionCard>
      <SectionCard title="المستخدمون" description={`${users.length} حساب · ${adminCount} مسؤول · ${users.filter((u) => roleOf(u.app_metadata?.role) === "viewer").length} عارض تبرعات`} contentClassName="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-6">البريد الإلكتروني</TableHead>
              <TableHead>الصلاحية</TableHead>
              <TableHead>آخر دخول</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead className="pe-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const role = roleOf(u.app_metadata?.role);
              const isMe = u.id === me.id;
              const lastAdmin = role === "admin" && adminCount <= 1;
              return (
                <TableRow key={u.id}>
                  <TableCell className="ps-6">
                    <span dir="ltr" className="font-medium">{u.email}</span>
                    {isMe && <Badge variant="secondary" className="ms-2">أنت</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {role === "admin" && <ShieldCheck className="size-4 text-brand-gold" />}
                      <RoleControl id={u.id} role={role} disabled={isMe || lastAdmin} />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "لم يدخل بعد"}</TableCell>
                  <TableCell className="text-muted-foreground tabular">{formatDateTime(u.created_at)}</TableCell>
                  <TableCell className="pe-6">
                    <div className="flex justify-end gap-2">
                      <PasswordDialog id={u.id} email={u.email ?? ""} />
                      <DeleteDialog id={u.id} email={u.email ?? ""} disabled={isMe || lastAdmin} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </>
  );
}

export default function UsersPage() {
  return (
    <>
      <PageHeader title="المستخدمون" description="إنشاء الحسابات وإدارتها وصلاحياتها" />
      <PageBody>
        <Suspense fallback={<SectionsSkeleton />}><Content /></Suspense>
      </PageBody>
    </>
  );
}
