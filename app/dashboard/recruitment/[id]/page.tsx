import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Globe2, Pencil, UsersRound } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import {
  closeJobAction,
  deleteJobAction,
  publishJobAction,
  reopenJobAction,
  updateJobAction,
} from "@/lib/actions/recruitment";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import { APPLICATION_STATUS, DEPARTMENTS, EMPLOYMENT_TYPES, JOB_STATUS } from "@/lib/labels";
import type { ApplicationRow, JobPostRow } from "@/lib/types";
import { daysUntil, formatDate, formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Обява" };
export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requirePermission("recruitment.manage");
  const { id } = await params;
  const sp = await searchParams;

  const job = await getRow<JobPostRow>("job_posts", id);
  if (!job) notFound();

  const applications = await listRows<ApplicationRow>("applications", {
    where: { job_post_id: id },
    orderBy: "submitted_at",
  });

  const left = daysUntil(job.deadline);

  return (
    <div>
      <Link
        href="/dashboard/recruitment"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
      >
        <ArrowLeft size={13} /> Към обявите
      </Link>

      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title={job.title}
        subtitle={`${job.department} · ${job.employment_type} · ${job.positions_count} позиция(и)`}
        eyebrow={`Обява · ${JOB_STATUS[job.status].label}`}
        actions={
          <>
            <ButtonLink href={`/jobs/${job.id}`} target="_blank" variant="subtle" size="sm">
              <ExternalLink size={14} /> Преглед в портала
            </ButtonLink>
            {job.status === "draft" ? (
              <form action={publishJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <SubmitButton variant="gold" size="sm" pendingText="Публикуване…">
                  <Globe2 size={14} /> Публикувай
                </SubmitButton>
              </form>
            ) : null}
            {job.status === "published" ? (
              <form action={closeJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <SubmitButton variant="outline" size="sm" pendingText="…" confirm="Да затворя ли обявата? Нови кандидатури няма да се приемат.">
                  Затвори
                </SubmitButton>
              </form>
            ) : null}
            {job.status === "closed" ? (
              <form action={reopenJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <SubmitButton variant="outline" size="sm" pendingText="…">
                  Върни като чернова
                </SubmitButton>
              </form>
            ) : null}
            <form action={deleteJobAction}>
              <input type="hidden" name="id" value={job.id} />
              <SubmitButton
                variant="ghost"
                size="sm"
                pendingText="…"
                confirm="Изтриване на обявата е необратимо. Продължи?"
              >
                Изтрий
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Редакция на обявата" description="Промените се записват в журнала" icon={Pencil} />
          <CardBody>
            <form action={updateJobAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={job.id} />
              <Field label="Длъжност" required className="sm:col-span-2">
                <Input name="title" defaultValue={job.title} required minLength={3} />
              </Field>
              <Field label="Направление" required>
                <Select name="department" defaultValue={job.department} required>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Вид договор" required>
                <Select name="employment_type" defaultValue={job.employment_type} required>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Брой позиции" required>
                <Input name="positions_count" type="number" min={1} max={50} defaultValue={job.positions_count} required />
              </Field>
              <Field label="Краен срок" required>
                <Input name="deadline" type="date" defaultValue={job.deadline} required />
              </Field>
              <Field label="Възнаграждение">
                <Input name="salary_range" defaultValue={job.salary_range || ""} />
              </Field>
              <Field label="Кратко описание" required className="sm:col-span-2">
                <Textarea name="description" defaultValue={job.description} rows={4} required minLength={20} />
              </Field>
              <Field label="Изисквания" required className="sm:col-span-2">
                <Textarea name="requirements" defaultValue={job.requirements} rows={4} required minLength={10} />
              </Field>
              <Field label="Задължения" className="sm:col-span-2">
                <Textarea name="responsibilities" defaultValue={job.responsibilities} rows={4} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Запазване…">Запази промените</SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Информация" icon={CalendarClock} />
            <CardBody className="space-y-3 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Статус</span>
                <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Краен срок</span>
                <span className="font-medium">{formatDate(job.deadline)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Остават</span>
                <span className={left !== null && left < 0 ? "font-medium text-danger" : "font-medium"}>
                  {left === null ? "—" : left < 0 ? "изтекъл" : `${left} дни`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Публикувана</span>
                <span>{job.published_at ? formatDateShort(job.published_at) : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Кандидатури</span>
                <Link
                  href={`/dashboard/selection?job=${job.id}`}
                  className="font-medium text-navy-600 hover:underline dark:text-gold-300"
                >
                  {applications.length}
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Кандидатури по обявата"
              description={`${applications.length} записа`}
              icon={UsersRound}
            />
            <CardBody className="p-0">
              {applications.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={UsersRound}
                    compact
                    title="Още няма кандидатури"
                    description={
                      job.status === "published"
                        ? "Обявата е активна — кандидатурите ще се появят тук."
                        : "Публикувайте обявата, за да започнете да приемате кандидатури."
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {applications.map((application) => (
                    <li key={application.id}>
                      <Link
                        href={`/dashboard/selection/${application.id}`}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-panel2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">
                            {application.first_name} {application.last_name}
                          </span>
                          <span className="block text-[10.5px] text-muted">{application.registration_number}</span>
                        </span>
                        <Badge tone={APPLICATION_STATUS[application.status].tone}>
                          {APPLICATION_STATUS[application.status].label}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
