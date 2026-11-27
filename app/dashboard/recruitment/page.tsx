import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Copy,
  FileText,
  Globe2,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
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
  Select,
  StatCard,
  Textarea,
} from "@/components/ui/primitives";
import { createJobAction, deleteJobAction, duplicateJobAction, publishJobAction } from "@/lib/actions/recruitment";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { DEPARTMENTS, EMPLOYMENT_TYPES, JOB_STATUS } from "@/lib/labels";
import type { ApplicationRow, JobPostRow } from "@/lib/types";
import { daysUntil, formatDateShort, todayIso } from "@/lib/utils";

export const metadata: Metadata = { title: "Кандидатстване" };
export const dynamic = "force-dynamic";

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requirePermission("recruitment.manage");
  const sp = await searchParams;

  const [jobs, applications] = await Promise.all([
    listRows<JobPostRow>("job_posts", { orderBy: "created_at" }),
    listRows<ApplicationRow>("applications"),
  ]);

  const published = jobs.filter((job) => job.status === "published");
  const drafts = jobs.filter((job) => job.status === "draft");
  const openApplications = applications.filter(
    (application) => application.status === "submitted" || application.status === "under_review",
  );

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Кандидатстване"
        subtitle="Обяви за свободни позиции, публичен портал и входящи кандидатури."
        actions={
          <>
            <ButtonLink href="/dashboard/selection" variant="outline" size="sm">
              <UsersRound size={14} /> Кандидатури
            </ButtonLink>
            <ButtonLink href="/jobs" target="_blank" variant="subtle" size="sm">
              <Globe2 size={14} /> Публичен портал
            </ButtonLink>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Публикувани обяви" value={published.length} icon={Globe2} hint="Видими в публичния портал" />
        <StatCard label="Чернови" value={drafts.length} icon={FileText} hint="Очакват публикуване" accent="gold" />
        <StatCard
          label="Входящи кандидатури"
          value={openApplications.length}
          icon={UsersRound}
          hint={`${applications.length} общо в регистъра`}
          accent={openApplications.length ? "gold" : "navy"}
          href="/dashboard/selection"
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Нова обява"
          description="Създава се като чернова — публикувате я, когато е готова."
          icon={Plus}
        />
        <CardBody>
          <Collapsible summary="Създай обява">
            <form action={createJobAction} className="grid gap-4 sm:grid-cols-2">
              <Field label="Длъжност" required className="sm:col-span-2">
                <Input name="title" required minLength={3} placeholder="напр. Учител по математика" />
              </Field>
              <Field label="Направление" required>
                <Select name="department" required defaultValue="">
                  <option value="" disabled>
                    Изберете…
                  </option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Вид договор" required>
                <Select name="employment_type" required defaultValue="">
                  <option value="" disabled>
                    Изберете…
                  </option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Брой позиции" required>
                <Input name="positions_count" type="number" min={1} max={50} defaultValue={1} required />
              </Field>
              <Field label="Краен срок" required>
                <Input name="deadline" type="date" min={todayIso()} required />
              </Field>
              <Field label="Възнаграждение" hint="По избор — може да остане празно.">
                <Input name="salary_range" placeholder="напр. 1 200 – 1 600 лв." />
              </Field>
              <Field label="Кратко описание" required className="sm:col-span-2">
                <Textarea name="description" required minLength={20} rows={3} placeholder="Основна информация за позицията…" />
              </Field>
              <Field label="Изисквания" required className="sm:col-span-2">
                <Textarea name="requirements" required minLength={10} rows={3} placeholder="Образование, квалификация, опит…" />
              </Field>
              <Field label="Задължения" className="sm:col-span-2">
                <Textarea name="responsibilities" rows={3} placeholder="Основни задължения по длъжностна характеристика…" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Създаване…">
                  <Plus size={15} /> Създай чернова
                </SubmitButton>
              </div>
            </form>
          </Collapsible>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Обяви"
          description={`${jobs.length} записа — чернови, публикувани и затворени`}
          icon={BriefcaseBusiness}
        />
        <CardBody className="p-0">
          {jobs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={BriefcaseBusiness}
                title="Няма създадени обяви"
                description="Създайте първата обява чрез формата по-горе. Тя ще се появи в публичния портал след публикуване."
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Позиция</th>
                    <th>Направление</th>
                    <th>Статус</th>
                    <th>Краен срок</th>
                    <th>Кандидатури</th>
                    <th className="text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const count = applications.filter((a) => a.job_post_id === job.id).length;
                    const left = daysUntil(job.deadline);
                    return (
                      <tr key={job.id}>
                        <td>
                          <Link
                            href={`/dashboard/recruitment/${job.id}`}
                            className="font-medium hover:text-navy-600 dark:hover:text-gold-300"
                          >
                            {job.title}
                          </Link>
                          <div className="text-[11px] text-muted">{job.employment_type}</div>
                        </td>
                        <td className="text-[12.5px] text-muted">{job.department}</td>
                        <td>
                          <Badge tone={JOB_STATUS[job.status].tone}>{JOB_STATUS[job.status].label}</Badge>
                        </td>
                        <td className="text-[12.5px]">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock size={13} className="text-muted" />
                            {formatDateShort(job.deadline)}
                            {left !== null && left >= 0 && left <= 7 && job.status === "published" ? (
                              <span className="text-[10.5px] font-medium text-amber-600">({left} дни)</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-[12.5px]">
                          {count > 0 ? (
                            <Link
                              href={`/dashboard/selection?job=${job.id}`}
                              className="font-medium text-navy-600 hover:underline dark:text-gold-300"
                            >
                              {count}
                            </Link>
                          ) : (
                            <span className="text-muted">0</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {job.status === "draft" ? (
                              <form action={publishJobAction}>
                                <input type="hidden" name="id" value={job.id} />
                                <SubmitButton variant="gold" size="sm" pendingText="…">
                                  Публикувай
                                </SubmitButton>
                              </form>
                            ) : null}
                            <ButtonLink href={`/dashboard/recruitment/${job.id}`} variant="ghost" size="icon" title="Редакция">
                              <Pencil size={14} />
                            </ButtonLink>
                            <form action={duplicateJobAction}>
                              <input type="hidden" name="id" value={job.id} />
                              <SubmitButton variant="ghost" size="icon" pendingText="">
                                <Copy size={14} />
                              </SubmitButton>
                            </form>
                            <form action={deleteJobAction}>
                              <input type="hidden" name="id" value={job.id} />
                              <SubmitButton
                                variant="ghost"
                                size="icon"
                                pendingText=""
                                confirm="Да изтрия ли обявата? Действието е необратимо."
                              >
                                <Trash2 size={14} className="text-danger" />
                              </SubmitButton>
                            </form>
                          </div>
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

      <div className="mt-4 flex justify-end">
        <Link
          href="/dashboard/selection"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
        >
          Към регистъра на кандидатурите <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
