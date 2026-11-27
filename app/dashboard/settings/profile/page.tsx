import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader } from "@/components/ui/primitives";
import { changeOwnPasswordAction, updateOwnProfileAction } from "@/lib/actions/staff";
import { requireUser } from "@/lib/auth/session";
import { getRow } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { UserRow } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Моят профил" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const user = await getRow<UserRow>("users", session.id);

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Моят профил"
        subtitle="Лични данни, парола и настройки за сигурност."
        actions={
          <Link
            href="/dashboard/settings/security"
            className="rounded-lg border border-hairline bg-panel px-3 py-2 text-[12px] text-muted hover:text-content"
          >
            <ShieldCheck size={13} className="mr-1 inline" /> Сигурност
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Лични данни" icon={UserRound} />
          <CardBody>
            <form action={updateOwnProfileAction} className="space-y-3">
              <Field label="Име и фамилия" required>
                <Input name="full_name" defaultValue={user?.full_name || session.full_name} required minLength={3} />
              </Field>
              <Field label="Служебен имейл" hint="Промяната се извършва от администратор.">
                <Input value={session.email} disabled />
              </Field>
              <Field label="Телефон">
                <Input name="phone" defaultValue={user?.phone || ""} placeholder="+359 88 000 0000" />
              </Field>
              <Field label="Длъжност">
                <Input value={session.position || "—"} disabled />
              </Field>
              <SubmitButton pendingText="Запазване…">Запази профила</SubmitButton>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Роли и достъп" icon={ShieldCheck} />
            <CardBody className="space-y-2 text-[12.5px]">
              <div className="flex flex-wrap gap-1.5">
                {session.roles.length ? (
                  session.roles.map((role) => (
                    <Badge key={role} tone={role === "director" ? "navy" : "neutral"}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted">Няма зададена роля.</span>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-muted">Последен вход</span>
                <span>{user?.last_login_at ? formatDateTime(user.last_login_at) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Двуфакторна автентикация</span>
                <Badge tone={session.totp_enabled ? "success" : "neutral"}>
                  {session.totp_enabled ? "включена" : "изключена"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Права</span>
                <span>{session.permissions.length}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Смяна на парола" icon={KeyRound} />
            <CardBody>
              <form action={changeOwnPasswordAction} className="space-y-3">
                <Field label="Текуща парола" required>
                  <Input name="current_password" type="password" required autoComplete="current-password" />
                </Field>
                <Field label="Нова парола" required hint="Поне 8 знака, буква и цифра.">
                  <Input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
                <Field label="Повторете новата парола" required>
                  <Input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
                <SubmitButton variant="outline" pendingText="Смяна…">
                  Смени паролата
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
