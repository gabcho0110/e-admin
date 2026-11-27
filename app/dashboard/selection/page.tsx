import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, Download, Filter, Search, UsersRound } from "lucide-react";

import { Flash } from "@/components/ui/flash";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { APPLICATION_STATUS } from "@/lib/labels";
import type { ApplicationRow, CommitteeRow, JobPostRow } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Подбор на персонал" };
export const dynamic = "force-dynamic";

export default async function SelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; status?: string; job?: string; q?: string }>;
}) {
  const user = await requirePermission("applications.review");
  const sp = await searchParams;

  const [applications, jobs, committees] = await Promise.all([
    listRows<ApplicationRow>("applications", { orderBy: "submitted_at" }),
    listRows<JobPostRow>("job_posts"),
    listRows<CommitteeRow>("committees"),
  ]);

  const status = sp.status || "";
  const jobId = sp.job || "";
  const query = (sp.q || "").trim().toLowerCase();

  const filtered = applications.filter((application) => {
    if (status && application.status !== status) return false;
    if (jobId && application.job_post_id !== jobId) return false;
    if (query) {
      const haystack = `${application.first_name} ${application.middle_name || ""} ${application.last_name} ${application.registration_number} ${application.email}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const committeeById = new Map(committees.map((c) => [c.id, c]));

  const counts = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === "submitted").length,
    interview: applications.filter((a) => a.status === "interview").length,
    approved: applications.filter((a) => a.status === "approved").length,
  };

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Подбор на персонал"
        subtitle="Регистър на кандидатурите, допускане, интервюта, комисии и окончателни решения."
        actions={
          user.permissions.includes("committees.manage") ? (
            <ButtonLink href="/dashboard/committees" variant="outline" size="sm">
              <UsersRound size={14} /> Комисии
            </ButtonLink>
          ) : null
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всички кандидатури" value={counts.total} icon={BriefcaseBusiness} />
        <StatCard label="Нови (подадени)" value={counts.submitted} icon={Download} accent="gold" />
        <StatCard label="На интервю" value={counts.interview} icon={UsersRound} accent="gold" />
        <StatCard label="Одобрени" value={counts.approved} icon={UsersRound} accent="success" />
      </div>

      <Card className="mb-4">
        <CardBody className="py-4">
          <form className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
            <Field label="Търсене">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input name="q" defaultValue={sp.q || ""} placeholder="Име, номер или имейл…" className="pl-8" />
              </div>
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue={status}>
                <option value="">Всички</option>
                {Object.entries(APPLICATION_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Обява">
              <Select name="job" defaultValue={jobId}>
                <option value="">Всички</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-navy-700 px-4 text-[13px] font-medium text-white hover:bg-navy-800"
            >
              <Filter size={14} /> Филтър
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={BriefcaseBusiness}
                title={applications.length === 0 ? "Няма подадени кандидатури" : "Няма резултати по зададените филтри"}
                description={
                  applications.length === 0
                    ? "Щом кандидат подаде документи през публичния портал, кандидатурата ще се появи тук с уникален регистрационен номер."
                    : "Променете критериите за търсене или изчистете филтрите."
                }
                action={
                  applications.length > 0 ? (
                    <ButtonLink href="/dashboard/selection" variant="outline" size="sm">
                      Изчисти филтрите
                    </ButtonLink>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Кандидат</th>
                    <th>Рег. номер</th>
                    <th>Позиция</th>
                    <th>Подадена</th>
                    <th>Комисия</th>
                    <th>Резултат</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((application) => {
                    const job = jobById.get(application.job_post_id);
                    const committee = application.committee_id ? committeeById.get(application.committee_id) : null;
                    return (
                      <tr key={application.id}>
                        <td>
                          <Link
                            href={`/dashboard/selection/${application.id}`}
                            className="font-medium hover:text-navy-600 dark:hover:text-gold-300"
                          >
                            {application.first_name} {application.last_name}
                          </Link>
                          <div className="text-[11px] text-muted">{application.email}</div>
                        </td>
                        <td className="font-mono text-[11.5px] text-muted">{application.registration_number}</td>
                        <td className="max-w-[220px] truncate text-[12.5px]">{job?.title || "—"}</td>
                        <td className="text-[12px] text-muted">{formatDateShort(application.submitted_at)}</td>
                        <td className="text-[12px]">
                          {committee ? (
                            <Link
                              href={`/dashboard/committees/${committee.id}`}
                              className="hover:text-navy-600 dark:hover:text-gold-300"
                            >
                              {committee.name}
                            </Link>
                          ) : (
                            <span className="text-muted">не е зададена</span>
                          )}
                        </td>
                        <td className="text-[12.5px]">
                          {application.score_total != null ? (
                            <span className="font-medium">{application.score_total.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={APPLICATION_STATUS[application.status].tone}>
                            {APPLICATION_STATUS[application.status].label}
                          </Badge>
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
        Показани {filtered.length} от {applications.length} кандидатури. Индивидуалните оценки са
        поверителни и се виждат само от членовете на съответната комисия и директора.
      </p>
    </div>
  );
}
