import type { Metadata } from "next";
import { BarChart3, BriefcaseBusiness, FileText, ListChecks, UsersRound } from "lucide-react";

import { Bars, Donut } from "@/components/charts/bars";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { countRows, listRows } from "@/lib/db";
import { APPLICATION_STATUS, DOC_TYPE, TASK_STATUS } from "@/lib/labels";
import type {
  ApplicationRow,
  CriterionRow,
  DocumentRow,
  JobPostRow,
  TaskRow,
  UserRoleRow,
} from "@/lib/types";
import { percent } from "@/lib/utils";

export const metadata: Metadata = { title: "Анализи" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePermission("reports.view");

  const [applications, jobs, documents, tasks, roles, criteria, staffCount] = await Promise.all([
    listRows<ApplicationRow>("applications"),
    listRows<JobPostRow>("job_posts"),
    listRows<DocumentRow>("documents"),
    listRows<TaskRow>("tasks"),
    listRows<UserRoleRow>("user_roles"),
    listRows<CriterionRow>("criteria"),
    countRows("users", { is_active: true }),
  ]);


  const statusData = Object.entries(APPLICATION_STATUS).map(([key, meta]) => ({
    label: meta.label,
    value: applications.filter((a) => a.status === key).length,
    tone:
      key === "approved"
        ? ("success" as const)
        : key === "rejected" || key === "not_admitted"
          ? ("danger" as const)
          : key === "interview"
            ? ("gold" as const)
            : ("navy" as const),
  }));

  const perJob = jobs
    .map((job) => ({
      label: job.title,
      value: applications.filter((a) => a.job_post_id === job.id).length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const perDocType = Object.entries(DOC_TYPE).map(([key, meta]) => ({
    label: meta.label,
    value: documents.filter((d) => d.doc_type === key).length,
  }));

  const taskData = Object.entries(TASK_STATUS).map(([key, meta]) => ({
    label: meta.label,
    value: tasks.filter((t) => t.status === key).length,
    tone:
      key === "done" ? ("success" as const) : key === "cancelled" ? ("danger" as const) : ("navy" as const),
  }));

  const approvedApps = applications.filter((a) => a.status === "approved").length;
  const decided = applications.filter((a) => ["approved", "rejected", "not_admitted"].includes(a.status)).length;

  return (
    <div>
      <PageHeader
        title="Анализи и статистика"
        subtitle="Реални обобщения от институционалната база — без демонстрационни данни."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Кандидатури" value={applications.length} icon={BriefcaseBusiness} hint={`${jobs.length} обяви`} />
        <StatCard
          label="Успеваемост"
          value={decided ? `${percent(approvedApps, decided)}%` : "—"}
          icon={BarChart3}
          hint={`${approvedApps} одобрени от ${decided} решени`}
          accent="success"
        />
        <StatCard label="Активни служители" value={staffCount} icon={UsersRound} />
        <StatCard label="Документи" value={documents.length} icon={FileText} hint={`${tasks.length} задачи`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Кандидатури по статус" description="Целият жизнен цикъл" icon={BriefcaseBusiness} />
          <CardBody>
            <Bars data={statusData} emptyLabel="Няма подадени кандидатури." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Кандидатури по обяви" description="Топ 6 позиции" icon={BriefcaseBusiness} />
          <CardBody>
            {perJob.length === 0 ? (
              <EmptyState icon={BriefcaseBusiness} compact title="Няма обяви" description="Публикувайте обява, за да започнете да събирате кандидатури." />
            ) : (
              <Bars data={perJob} emptyLabel="Няма кандидатури по обявите." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Документи по вид" description="Регистър на документооборота" icon={FileText} />
          <CardBody>
            <Bars data={perDocType} emptyLabel="Регистърът е празен." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Задачи" description="Разпределение по статус" icon={ListChecks} />
          <CardBody>
            <Bars data={taskData} emptyLabel="Няма възложени задачи." />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Персонал по роли" description="Активни назначения" icon={UsersRound} />
          <CardBody>
            <Donut
              total={roles.length}
              segments={[
                { label: "Ръководство", value: roles.filter((r) => ["director", "deputy_director"].includes(r.role_key)).length, color: "#17365D" },
                { label: "Експерти", value: roles.filter((r) => ["accreditation_expert", "hr_expert"].includes(r.role_key)).length, color: "#244A73" },
                { label: "Комисии", value: roles.filter((r) => ["committee_chair", "committee_member"].includes(r.role_key)).length, color: "#C5A253" },
                { label: "Преподаватели", value: roles.filter((r) => r.role_key === "teacher").length, color: "#8299BE" },
                { label: "ИКТ", value: roles.filter((r) => r.role_key === "ict_officer").length, color: "#1B7A55" },
              ]}
              caption="Разпределението включва всички активни профили с административна роля."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Качество" description="Критерии по статус" icon={BarChart3} />
          <CardBody>
            <Bars
              data={[
                { label: "Не е започнат", value: criteria.filter((c) => c.status === "not_started").length, tone: "muted" },
                { label: "В изпълнение", value: criteria.filter((c) => c.status === "in_progress").length, tone: "navy" },
                { label: "Подаден", value: criteria.filter((c) => c.status === "submitted").length, tone: "gold" },
                { label: "Одобрен", value: criteria.filter((c) => c.status === "approved").length, tone: "success" },
                { label: "За корекция", value: criteria.filter((c) => c.status === "needs_revision").length, tone: "danger" },
              ]}
              emptyLabel="Няма критерии по акредитация."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
