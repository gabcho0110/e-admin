import type { Metadata } from "next";
import Link from "next/link";
import { Gavel, Plus, UsersRound } from "lucide-react";

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
  Textarea,
} from "@/components/ui/primitives";
import { createCommitteeAction } from "@/lib/actions/committees";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { COMMITTEE_STATUS } from "@/lib/labels";
import type { CommitteeMemberRow, CommitteeRow, EvaluationCriterionRow } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Комисии" };
export const dynamic = "force-dynamic";

export default async function CommitteesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requirePermission("committees.manage");
  const sp = await searchParams;

  const [committees, members, criteria] = await Promise.all([
    listRows<CommitteeRow>("committees"),
    listRows<CommitteeMemberRow>("committee_members"),
    listRows<EvaluationCriterionRow>("evaluation_criteria"),
  ]);

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Комисии"
        subtitle="Състави, критерии за оценяване, конфликт на интереси и протоколи."
        actions={
          <Link href="/dashboard/selection" className="text-[12px] text-muted hover:text-content">
            Кандидатури →
          </Link>
        }
      />

      <Card className="mb-5">
        <CardHeader title="Нова комисия" description="Създава се като чернова" icon={Plus} />
        <CardBody>
          <Collapsible summary="Създай комисия">
            <form action={createCommitteeAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Наименование" required className="sm:col-span-2">
                <Input name="name" required minLength={3} placeholder="Комисия за подбор на учители" />
              </Field>
              <Field label="Предназначение" className="sm:col-span-2">
                <Textarea name="purpose" rows={2} placeholder="Основание и обхват на работата на комисията…" />
              </Field>
              <Field label="Номер на протокол" hint="Може да се зададе при приключване.">
                <Input name="protocol_number" placeholder="ПРОТ-2026-001" />
              </Field>
              <div className="flex items-end">
                <SubmitButton pendingText="Създаване…">
                  <Plus size={15} /> Създай
                </SubmitButton>
              </div>
            </form>
          </Collapsible>
        </CardBody>
      </Card>

      {committees.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Няма създадени комисии"
          description="Комисиите се използват за оценяване на кандидатури по предварително зададени критерии. Създайте първата от формата по-горе."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {committees.map((committee) => {
            const memberCount = members.filter((m) => m.committee_id === committee.id).length;
            const criterionCount = criteria.filter((c) => c.committee_id === committee.id).length;
            return (
              <Link
                key={committee.id}
                href={`/dashboard/committees/${committee.id}`}
                className="surface-card group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold group-hover:text-navy-600 dark:group-hover:text-gold-300">
                      {committee.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-muted">
                      {committee.purpose || "Без описано предназначение"}
                    </p>
                  </div>
                  <Badge tone={COMMITTEE_STATUS[committee.status].tone}>
                    {COMMITTEE_STATUS[committee.status].label}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[11.5px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <UsersRound size={12} /> {memberCount} член(ове)
                  </span>
                  <span>{criterionCount} критерия</span>
                  <span>{committee.protocol_number || "без протокол"}</span>
                  <span className="ml-auto">{formatDateShort(committee.created_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
