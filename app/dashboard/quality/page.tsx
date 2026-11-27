import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileText, ScrollText, ShieldCheck, Target } from "lucide-react";

import { Bars } from "@/components/charts/bars";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
} from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { CRITERION_STATUS, DOC_STATUS, DOC_TYPE, REPORT_STATUS } from "@/lib/labels";
import type {
  AccreditationCycleRow,
  CriterionRow,
  DocumentRow,
  InstitutionalReportRow,
} from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Качество" };
export const dynamic = "force-dynamic";

export default async function QualityPage() {
  await requirePermission("accreditation.manage");

  const [cycles, criteria, reports, documents] = await Promise.all([
    listRows<AccreditationCycleRow>("accreditation_cycles"),
    listRows<CriterionRow>("criteria"),
    listRows<InstitutionalReportRow>("institutional_reports"),
    listRows<DocumentRow>("documents"),
  ]);

  const policies = documents.filter((doc) => doc.doc_type === "policy");
  const approvedPolicies = policies.filter((doc) => doc.status === "approved");
  const approvedCriteria = criteria.filter((c) => c.status === "approved");
  const progress = criteria.length ? Math.round((approvedCriteria.length / criteria.length) * 100) : 0;

  const byStatus = CRITERION_STATUS;
  const criteriaByStatus = Object.entries(byStatus).map(([key, meta]) => ({
    label: meta.label,
    value: criteria.filter((c) => c.status === key).length,
    tone:
      key === "approved"
        ? ("success" as const)
        : key === "needs_revision"
          ? ("danger" as const)
          : key === "submitted"
            ? ("gold" as const)
            : ("navy" as const),
  }));

  return (
    <div>
      <PageHeader
        title="Качество и вътрешни правила"
        subtitle="Политики, критерии за качество, доклади и коригиращи действия."
        actions={
          <ButtonLink href="/dashboard/accreditation" variant="outline" size="sm">
            <BadgeCheck size={14} /> Акредитация
          </ButtonLink>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Критерии" value={criteria.length} icon={Target} hint={`${approvedCriteria.length} одобрени`} />
        <StatCard label="Готовност" value={`${progress}%`} icon={ShieldCheck} accent={progress === 100 ? "success" : "gold"} />
        <StatCard label="Вътрешни правила" value={policies.length} icon={ScrollText} hint={`${approvedPolicies.length} одобрени`} />
        <StatCard label="Доклади" value={reports.length} icon={FileText} hint={`${reports.filter((r) => r.status === "submitted").length} за одобрение`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Критерии по статус" description="Всички активни процедури" icon={Target} />
          <CardBody>
            <Bars data={criteriaByStatus} emptyLabel="Няма добавени критерии по процедурите." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Готовност по процедури" description="Дял на одобрените критерии" icon={BadgeCheck} />
          <CardBody className="space-y-4">
            {cycles.length === 0 ? (
              <EmptyState icon={BadgeCheck} compact title="Няма процедури" description="Създайте процедура по акредитация." />
            ) : (
              cycles.map((cycle) => {
                const list = criteria.filter((c) => c.cycle_id === cycle.id);
                const approved = list.filter((c) => c.status === "approved").length;
                const percent = list.length ? Math.round((approved / list.length) * 100) : 0;
                return (
                  <div key={cycle.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <Link
                        href={`/dashboard/accreditation/${cycle.id}`}
                        className="truncate text-[12.5px] font-medium hover:text-navy-600 dark:hover:text-gold-300"
                      >
                        {cycle.title}
                      </Link>
                      <span className="shrink-0 text-[11px] text-muted">{percent}%</span>
                    </div>
                    <ProgressBar value={percent} tone={percent === 100 ? "success" : "navy"} />
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Вътрешни правила и политики" description={`${policies.length} документа`} icon={ScrollText} />
          <CardBody className="p-0">
            {policies.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={ScrollText}
                  compact
                  title="Няма регистрирани политики"
                  description="Създайте документ от вид „Вътрешно правило“ в модул Документи."
                  action={
                    <ButtonLink href="/dashboard/documents" size="sm" variant="outline">
                      Към документите
                    </ButtonLink>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {policies.map((policy) => (
                  <li key={policy.id}>
                    <Link href={`/dashboard/documents/${policy.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium">{policy.title}</div>
                        <div className="text-[11px] text-muted">
                          № {policy.number} · v{policy.version} · {formatDateShort(policy.updated_at)}
                        </div>
                      </div>
                      <Badge tone={DOC_STATUS[policy.status].tone}>{DOC_STATUS[policy.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Доклади и препоръки" description={`${reports.length} записа`} icon={FileText} />
          <CardBody className="p-0">
            {reports.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={FileText} compact title="Няма доклади" description="Докладите се създават в процедурата по акредитация." />
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {reports.slice(0, 8).map((report) => (
                  <li key={report.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{report.title}</div>
                      <div className="text-[11px] text-muted">
                        {formatDateShort(report.created_at)}
                      </div>
                    </div>
                    <Badge tone={REPORT_STATUS[report.status].tone}>{REPORT_STATUS[report.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Alert tone="warning" className="mt-5" title="Институционален характер">
        Оценките по критериите са вътрешни за институцията и служат за планиране на подобрения. Те
        не представляват официална държавна акредитация.
      </Alert>
    </div>
  );
}
