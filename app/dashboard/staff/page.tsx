import type { Metadata } from "next";
import { KeyRound, Lock, Plus, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Collapsible,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatCard,
} from "@/components/ui/primitives";
import { createStaffAction } from "@/lib/actions/staff";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { RoleKey, UserRoleRow, UserRow } from "@/lib/types";
import { formatDateShort, fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Персонал" };
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

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("staff.view");
  const sp = await searchParams;

  const [users, roles] = await Promise.all([
    listRows<UserRow>("users", { orderBy: "created_at" }),
    listRows<UserRoleRow>("user_roles"),
  ]);

  const rolesOf = (userId: string) =>
    roles.filter((r) => r.user_id === userId).map((r) => r.role_key);
  const staff = users.filter((u) => !rolesOf(u.id).includes("candidate"));
  const canManage = user.permissions.includes("staff.manage");
  const activeCount = staff.filter((u) => u.is_active).length;

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Регистър на персонала"
        subtitle="Служебни профили, роли и достъп. Ролите определят видимите модули и действия — на човек може да се зададат няколко."
        actions={
          canManage ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 py-2 text-[11.5px] text-muted">
              <ShieldCheck size={13} /> Промените се записват в журнала
            </span>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Активни профили" value={activeCount} icon={UsersRound} />
        <StatCard label="Общо профили" value={staff.length} icon={UsersRound} accent="navy" />
        <StatCard
          label="Деактивирани"
          value={staff.length - activeCount}
          icon={ShieldCheck}
          accent={staff.length - activeCount > 0 ? "danger" : "success"}
        />
      </div>

      {canManage ? (
        <Card className="mb-5">
          <CardHeader title="Нов служебен профил" description="Създава се с временна парола" icon={UserPlus} />
          <CardBody>
            <Collapsible summary="Добави служител">
              <form action={createStaffAction} className="grid gap-3 sm:grid-cols-2">
                <Field label="Име и фамилия" required>
                  <Input name="full_name" required minLength={3} placeholder="Иван Петров" />
                </Field>
                <Field label="Служебен имейл" required>
                  <Input name="email" type="email" required placeholder="ivan@pig-ohridski.bg" />
                </Field>
                <Field label="Длъжност" required>
                  <Input name="position" required placeholder="Учител по математика" />
                </Field>
                <Field label="Телефон">
                  <Input name="phone" placeholder="+359 88 000 0000" />
                </Field>
                <Field label="Роли" required hint="Може да изберете повече от една — правата се обединяват.">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {ASSIGNABLE_ROLES.filter(
                      (role) => role !== "superadmin" || user.roles.includes("superadmin"),
                    ).map((role) => (
                      <label
                        key={role}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-panel2/60 px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-navy-300"
                      >
                        <input
                          type="checkbox"
                          name="role_key"
                          value={role}
                          defaultChecked={role === "teacher"}
                          className="h-3.5 w-3.5 accent-navy-700"
                        />
                        {ROLE_LABELS[role]}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Временна парола" required hint="Поне 8 знака. Сменя се при първи вход.">
                  <Input name="password" type="text" required minLength={8} placeholder="напр. Pig2026!demo" />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton pendingText="Създаване…">
                    <Plus size={15} /> Създай профил
                  </SubmitButton>
                </div>
              </form>
            </Collapsible>
          </CardBody>
        </Card>
      ) : (
        <Alert tone="info" className="mb-5" title="Режим на преглед">
          Можете да преглеждате регистъра, но не и да променяте роли или статуси.
        </Alert>
      )}

      <Card>
        <CardHeader title="Служители" description={`${staff.length} профила`} icon={UsersRound} />
        <CardBody className="p-0">
          {staff.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={UsersRound}
                title="Няма създадени служебни профили"
                description="Добавете първия служител и задайте роля — достъпът се определя автоматично."
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Служител</th>
                    <th>Длъжност</th>
                    <th>Роли</th>
                    <th>Последен вход</th>
                    <th>Статус</th>
                    <th className="text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((person) => {
                    const personRoles = rolesOf(person.id);
                    const isSelf = person.id === user.id;
                    return (
                      <tr key={person.id}>
                        <td>
                          <div className="font-medium">{person.full_name}</div>
                          <div className="text-[11px] text-muted">{person.email}</div>
                        </td>
                        <td className="text-[12.5px] text-muted">{person.position || "—"}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {personRoles.length === 0 ? (
                              <Badge tone="neutral">без роля</Badge>
                            ) : (
                              personRoles.map((key) => (
                                <Badge
                                  key={key}
                                  tone={
                                    key === "superadmin"
                                      ? "gold"
                                      : key === "director"
                                        ? "navy"
                                        : "neutral"
                                  }
                                >
                                  {ROLE_LABELS[key]}
                                </Badge>
                              ))
                            )}
                            {person.is_protected ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-hairline px-1.5 py-0.5 text-[10.5px] text-muted"
                                title="Защитен профил — не може да бъде изтрит, деактивиран или понижен"
                              >
                                <Lock size={10} /> защитен
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-[12px] text-muted">
                          {person.last_login_at ? fromNow(person.last_login_at) : "никога"}
                        </td>
                        <td>
                          <Badge tone={person.is_active ? "success" : "danger"}>
                            {person.is_active ? "активен" : "деактивиран"}
                          </Badge>
                        </td>
                        <td>
                          {canManage && !isSelf && !person.is_protected ? (
                            <ButtonLink
                              href={`/dashboard/staff/${person.id}`}
                              variant="outline"
                              size="sm"
                              className="ml-auto"
                            >
                              <KeyRound size={12} /> Управление
                            </ButtonLink>
                          ) : (
                            <span className="block text-right text-[11px] text-muted">
                              {isSelf ? "текущ профил" : person.is_protected ? "заключен профил" : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-[11.5px] text-muted">
        Създадени: {formatDateShort(new Date())} · Потребителят не може да променя собствените си
        роли или статус. Един човек може да има няколко роли — правата се обединяват. Изтриването
        е окончателно и се записва в одиторския журнал; защитените профили и профил с вписани
        оценки в комисия не могат да бъдат изтрити.
      </p>
    </div>
  );
}
