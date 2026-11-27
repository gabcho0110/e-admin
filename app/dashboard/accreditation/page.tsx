import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarClock, Plus, Target, UsersRound } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Collapsible,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui/primitives";
import { createCycleAction } from "@/lib/actions/accreditation";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { ACCREDITATION_STATUS } from "@/lib/labels";
import type { AccreditationCycleRow, CriterionRow, UserRoleRow, UserRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Акредитация" };
export const dynamic = "force-dynamic";

export default async function AccreditationPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requirePermission("accreditation.manage");
  const sp = await searchParams;

  const [cycles, criteria, users, roles] = await Promise.all([
    listRows<AccreditationCycleRow>("accreditation_cycles", { orderBy: "period_start" }),
    listRows<CriterionRow>("criteria"),
    listRows<UserRow>("users"),
    listRows<UserRoleRow>("user_roles"),
  ]);

  const candidateIds = new Set(roles.filter((r) => r.role_key === "candidate").map((r) => r.user_id));
  const staff = users.filter((u) => u.is_active && !candidateIds.has(u.id));
  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name || "—";

  const active = cycles.filter((c) => c.status === "active").length;
  const totalCriteria = criteria.length;
  const approvedCriteria = criteria.filter((c) => c.status === "approved").length;

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Акредитация и институционално развитие"
        subtitle="Процедури, критерии за качество, доказателства, самооценка и доклади."
        actions={
          <Link href="/dashboard/quality" className="text-[12px] text-muted hover:text-content">
            Качество →
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Активни процедури" value={active} icon={BadgeCheck} accent="gold" />
        <StatCard label="Критерии" value={totalCriteria} icon={Target} hint={`${approvedCriteria} одобрени`} />
        <StatCard
          label="Готовност"
          value={totalCriteria ? `${Math.round((approvedCriteria / totalCriteria) * 100)}%` : "0%"}
          icon={CalendarClock}
          hint="Дял на одобрените критерии"
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Нова процедура"
          description="Вътрешна самооценка или институционална оценка — без да се представя за официална държавна акредитация."
          icon={Plus}
        />
        <CardBody>
          <Collapsible summary="Създай процедура">
            <form action={createCycleAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Наименование" required className="sm:col-span-2">
                <Input name="title" required minLength={3} placeholder="Самооценка 2026/2027" />
              </Field>
              <Field label="Вид" required>
                <Select name="kind" defaultValue="internal">
                  <option value="internal">Вътрешна самооценка</option>
                  <option value="external">Институционална оценка</option>
                </Select>
              </Field>
              <Field label="Отговорник">
                <Select name="lead_id" defaultValue="">
                  <option value="">Без отговорник</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Начало" required>
                <Input name="period_start" type="date" required />
              </Field>
              <Field label="Край" required>
                <Input name="period_end" type="date" required />
              </Field>
              <Field label="Описание" className="sm:col-span-2">
                <Textarea name="description" rows={3} placeholder="Обхват и цели на процедурата…" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Създаване…">
                  <Plus size={15} /> Създай процедура
                </SubmitButton>
              </div>
            </form>
          </Collapsible>
        </CardBody>
      </Card>

      {cycles.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="Няма създадени процедури"
          description="Създайте първата процедура по самооценка, добавете критерии и разпределете отговорници. Всяко доказателство се съхранява в електронно досие."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {cycles.map((cycle) => {
            const cycleCriteria = criteria.filter((c) => c.cycle_id === cycle.id);
            const approved = cycleCriteria.filter((c) => c.status === "approved").length;
            const percent = cycleCriteria.length ? Math.round((approved / cycleCriteria.length) * 100) : 0;
            return (
              <Link
                key={cycle.id}
                href={`/dashboard/accreditation/${cycle.id}`}
                className="surface-card group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted">
                      {cycle.kind === "internal" ? "Вътрешна самооценка" : "Институционална оценка"}
                    </div>
                    <h3 className="mt-0.5 truncate text-[15.5px] font-semibold group-hover:text-navy-600 dark:group-hover:text-gold-300">
                      {cycle.title}
                    </h3>
                  </div>
                  <Badge tone={ACCREDITATION_STATUS[cycle.status].tone}>
                    {ACCREDITATION_STATUS[cycle.status].label}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={12} /> {formatDate(cycle.period_start)} – {formatDate(cycle.period_end)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UsersRound size={12} /> {userName(cycle.lead_id)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {approved} от {cycleCriteria.length} критерия одобрени
                    </span>
                    <span className="font-medium text-content">{percent}%</span>
                  </div>
                  <ProgressBar value={percent} tone={percent === 100 ? "success" : "navy"} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-6 rounded-lg border border-hairline bg-panel2 px-4 py-3 text-[11.5px] leading-5 text-muted">
        Вътрешната оценка по критериите има институционален характер и служи за подготовка и
        самоусъвършенстване. Тя не представлява официална държавна акредитация и не следва да бъде
        представяна като такава.
      </p>
    </div>
  );
}
