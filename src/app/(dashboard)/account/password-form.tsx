"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { changePassword, type PwState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid max-w-sm gap-3">
      <div className="grid gap-1.5"><Label htmlFor="password">كلمة المرور الجديدة</Label><PasswordInput id="password" name="password" autoComplete="new-password" required /></div>
      <div className="grid gap-1.5"><Label htmlFor="confirm">تأكيد كلمة المرور</Label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" required /></div>
      <div><Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}</Button></div>
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
