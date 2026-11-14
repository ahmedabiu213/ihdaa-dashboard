import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getCurrentUser } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

async function Email() {
  const user = await getCurrentUser();
  return <span dir="ltr">{user?.email}</span>;
}

export default function AccountPage() {
  return (
    <>
      <PageHeader title="حسابي" description="تغيير كلمة المرور" />
      <PageBody>
        <SectionCard title="كلمة المرور" description="الحساب الحالي">
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground"><Suspense>{<Email />}</Suspense></p>
            <PasswordForm />
          </div>
        </SectionCard>
      </PageBody>
    </>
  );
}
