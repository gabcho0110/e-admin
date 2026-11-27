import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, Lock, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui/primitives";
import {
  deleteStaffAction,
  resetStaffPasswordAction,
  setStaffRolesAction,
  toggleStaffActiveAction,
} from "@/lib/actions/staff";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { RoleKey, UserRoleRow, UserRow } from "@/lib/types";
import { formatDate, formatDateTime, fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Служебен профил" };
export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES: RoleKey[] = [
  "superadmin",
  "director",
  "deputy_director",
  "accreditation_expert",
  "hr_expert",
  "committee_chair",
  "committee_member",
  "ict_officer",
  "teacher",
];

export default async function StaffMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("staff.manage");
  const { id } = await params;
  const sp = await searchParams;

  const person = await getRow<UserRow>("users", id);
  if (!person) notFound();

  const roles = await listRows<UserRoleRow>("user_roles", { where: { user_id: id } });
  const roleKeys = roles.map((row) => row.role_key);
  const isSelf = person.id === user.id;
  const locked = person.is_protected || isSelf;
  const canAssignSuperadmin = user.roles.includes("superadmin");

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <Link
        href="/dashboard/staff"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-content"
      >
        <ArrowLeft size={13} /> Към регистъра на персонала
      </Link>

      <PageHeader
        eyebrow="СЛУЖЕБЕН ПРОФИЛ"
        title={person.full_name}
        subtitle={person.position || "Без посочена длъжност"}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {roleKeys.length === 0 ? (
              <Badge tone="neutral">без роля</Badge>
            ) : (
              roleKeys.map((key) => (
                <Badge key={key} tone={key === "superadmin" ? "gold" : key === "director" ? "navy" : "neutral"}>
                  {ROLE_LABELS[key]}
                </Badge>
              ))
            )}
            <Badge tone={person.is_active ? "success" : "danger"}>
              {person.is_active ? "активен" : "деактивиран"}
            </Badge>
            {person.is_protected ? (
              <Badge tone="neutral">
                <Lock size={10} /> защитен
              </Badge>
            ) : null}
          </div>
        }
      />

      {locked ? (
        <Alert
          tone="info"
          className="mb-5"
          title={isSelf ? "Това е вашият профил" : "Защитен профил"}
        >
          {isSelf
            ? "Собственият профил не се изтрива и не се деактивира оттук — паролата и данните се сменят от „Моят профил“."
            : "Профилът на собственика на системата не може да бъде изтрит, деактивиран или понижен. Това е защитено и в интерфейса, и на ниво база данни."}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Данни" description="Служебна информация за профила" icon={UserRound} />
          <CardBody className="space-y-2.5 text-[13px]">
            <div className="flex items-center gap-2 text-muted">
              <Mail size={14} /> {person.email}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-hairline pt-2.5 text-[12.5px]">
              <span className="text-muted">Длъжност</span>
              <span>{person.position || "—"}</span>
              <span className="text-muted">Телефон</span>
              <span>{person.phone || "—"}</span>
              <span className="text-muted">Създаден</span>
              <span>{formatDate(person.created_at)}</span>
              <span className="text-muted">Последен вход</span>
              <span>{person.last_login_at ? formatDateTime(person.last_login_at) : "никога"}</span>
              <span className="text-muted">Преди</span>
              <span>{person.last_login_at ? fromNow(person.last_login_at) : "—"}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Роли и достъп"
            description="Може да са няколко — правата се обединяват"
            icon={ShieldCheck}
          />
          <CardBody>
            {locked ? (
              <p className="text-[13px] text-muted">
                Ролите на този профил не се променят оттук.
              </p>
            ) : (
              <form action={setStaffRolesAction} className="space-y-2.5">
                <input type="hidden" name="user_id" value={person.id} />
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ASSIGNABLE_ROLES.filter((key) => key !== "superadmin" || canAssignSuperadmin).map(
                    (key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-panel2/60 px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-navy-300"
                      >
                        <input
                          type="checkbox"
                          name="role_key"
                          value={key}
                          defaultChecked={roleKeys.includes(key)}
                          className="h-3.5 w-3.5 accent-navy-700"
                        />
                        {ROLE_LABELS[key]}
                      </label>
                    ),
                  )}
                </div>
                <SubmitButton variant="subtle" size="sm" className="w-full" pendingText="Записване…">
                  Запази ролите
                </SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Временна парола" description="Задава се при забравен достъп" icon={KeyRound} />
          <CardBody>
            {isSelf ? (
              <p className="text-[13px] text-muted">
                Собствената парола се сменя от{" "}
                <Link href="/dashboard/settings/profile" className="text-navy-600 underline-offset-4 hover:underline dark:text-gold-300">
                  Моят профил
                </Link>
                .
              </p>
            ) : (
              <form action={resetStaffPasswordAction} className="space-y-2">
                <input type="hidden" name="user_id" value={person.id} />
                <Field label="Нова временна парола" hint="Поне 8 знака. Сменя се при първи вход.">
                  <Input name="password" type="text" minLength={8} required placeholder="напр. Pig2026!demo" />
                </Field>
                <SubmitButton variant="outline" size="sm" className="w-full" pendingText="Записване…">
                  Смени паролата
                </SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Статус на профила"
            description="Деактивираният профил не може да влиза"
            icon={ShieldCheck}
          />
          <CardBody>
            {locked ? (
              <p className="text-[13px] text-muted">Статусът на този профил е заключен.</p>
            ) : (
              <form action={toggleStaffActiveAction}>
                <input type="hidden" name="user_id" value={person.id} />
                <SubmitButton
                  variant={person.is_active ? "ghost" : "subtle"}
                  size="sm"
                  className="w-full"
                  pendingText="Записване…"
                  confirm={
                    person.is_active
                      ? "Профилът ще загуби достъп до системата. Продължавате ли?"
                      : "Да активира ли отново профила?"
                  }
                >
                  {person.is_active ? "Деактивирай профила" : "Активирай профила"}
                </SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>
      </div>

      {!locked ? (
        <Card className="mt-4 border-red-200 dark:border-red-900/60">
          <CardHeader
            title="Изтриване на профила"
            description="Окончателно и необратимо"
            icon={Trash2}
          />
          <CardBody className="space-y-3">
            <p className="text-[13px] leading-6 text-muted">
              Заедно с профила се премахват ролята, членството в комисии, личните данни и
              известията. Записите в одиторския журнал остават като история. Ако служителят има
              вписани оценки в комисия, изтриването се блокира, за да не се наруши протоколът.
            </p>
            <form action={deleteStaffAction}>
              <input type="hidden" name="user_id" value={person.id} />
              <SubmitButton
                variant="danger"
                size="sm"
                pendingText="Изтриване…"
                confirm={`Профилът на ${person.full_name} ще бъде изтрит окончателно. Това не може да бъде отменено. Продължавате ли?`}
              >
                <Trash2 size={14} /> Изтрий профила
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
