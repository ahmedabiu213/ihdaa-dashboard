"use client";

import { useActionState, useRef, useTransition } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createUser, deleteUser, setPassword, setRole, type UserFormState } from "./actions";

function Result({ state }: { state: UserFormState }) {
  if (state.ok) return <p className="text-sm text-success">{state.ok}</p>;
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  return null;
}

function RoleSelect({ name = "role", defaultValue = "member", onChange }: { name?: string; defaultValue?: string; onChange?: (v: string) => void }) {
  return (
    <Select name={name} defaultValue={defaultValue} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="member">عضو: يرى اللوحة ويستخدمها</SelectItem>
        <SelectItem value="admin">مسؤول: يدير المستخدمين أيضًا</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function CreateUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  // Clear the fields after a successful create, inside the action (no effect needed).
  const [state, action, pending] = useActionState<UserFormState, FormData>(async (prev, fd) => {
    const r = await createUser(prev, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5"><Label htmlFor="new-email">البريد الإلكتروني</Label><Input id="new-email" name="email" type="email" dir="ltr" autoComplete="off" required /></div>
        <div className="grid gap-1.5"><Label htmlFor="new-password">كلمة المرور (10 أحرف على الأقل)</Label><Input id="new-password" name="password" type="password" dir="ltr" autoComplete="new-password" minLength={10} required /></div>
        <div className="grid gap-1.5"><Label>الصلاحية</Label><RoleSelect /></div>
      </div>
      <div><Button type="submit" disabled={pending}><UserPlus />{pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</Button></div>
      <Result state={state} />
    </form>
  );
}

export function RoleControl({ id, role, disabled }: { id: string; role: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  if (disabled) return <span className="text-sm">{role === "admin" ? "مسؤول" : "عضو"}</span>;
  return (
    <div className="min-w-44" data-pending={pending || undefined}>
      <RoleSelect
        name="role"
        defaultValue={role}
        onChange={(v) => start(async () => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("role", v);
          await setRole(fd);
        })}
      />
    </div>
  );
}

export function PasswordDialog({ id, email }: { id: string; email: string }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(setPassword, {});
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><KeyRound />كلمة المرور</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعيين كلمة مرور جديدة</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">{email}</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-1.5"><Label htmlFor={`pw-${id}`}>كلمة المرور الجديدة</Label><Input id={`pw-${id}`} name="password" type="password" dir="ltr" minLength={10} autoComplete="new-password" required /></div>
          <Result state={state} />
          <DialogFooter><Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({ id, email, disabled }: { id: string; email: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(deleteUser, {});
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled} aria-label="حذف"><Trash2 className="text-destructive" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف الحساب؟</DialogTitle>
          <DialogDescription>لن يتمكن <span dir="ltr">{email}</span> من الدخول بعد الآن. لا يمكن التراجع عن الحذف.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="id" value={id} />
          <Result state={state} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">إلغاء</Button></DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || !!state.ok}>{pending ? "جارٍ الحذف…" : "حذف"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
