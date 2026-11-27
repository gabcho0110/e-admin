import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  FolderPlus,
  Paperclip,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
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
  Textarea,
} from "@/components/ui/primitives";
import {
  addEvidenceAction,
  addQualityCriterionAction,
  addRecommendationAction,
  createReportAction,
  deleteEvidenceAction,
  reviewReportAction,
  setCycleStatusAction,
  submitReportAction,
  updateCriterionAction,
} from "@/lib/actions/accreditation";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import {
  ACCREDITATION_STATUS,
  CRITERION_STATUS,
  REPORT_KIND,
  REPORT_STATUS,
} from "@/lib/labels";
import type {
  AccreditationCycleRow,
  CriterionRow,
  EvidenceRow,
  InstitutionalReportRow,
  UserRoleRow,
  UserRow,
} from "@/lib/types";
import { formatDate, formatDateShort, formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Процедура по акредитация" };
export const dynamic = "force-dynamic";

export default async function CycleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("accreditation.manage");
  const { id } = await params;
  const sp = await searchParams;

  const cycle = await getRow<AccreditationCycleRow>("accreditation_cycles", id);
  if (!cycle) notFound();

  const [criteria, reports, users, roles] = await Promise.all([
    listRows<CriterionRow>("criteria", { where: { cycle_id: id }, orderBy: "code", ascending: true }),
    listRows<InstitutionalReportRow>("institutional_reports", { where: { cycle_id: id } }),
    listRows<UserRow>("users"),
    listRows<UserRoleRow>("user_roles"),
  ]);

  const evidence = await listRows<EvidenceRow>("evidence");
  const cycleEvidence = evidence.filter((item) => criteria.some((criterion) => criterion.id === item.criterion_id));

  const candidateIds = new Set(roles.filter((r) => r.role_key === "candidate").map((r) => r.user_id));
  const staff = users.filter((u) => u.is_active && !candidateIds.has(u.id));
  const userName = (userId: string | null) => users.find((u) => u.id === userId)?.full_name || "—";

  const approved = criteria.filter((c) => c.status === "approved").length;
  const percent = criteria.length ? Math.round((approved / criteria.length) * 100) : 0;
  const canDecide = user.permissions.includes("director.decide");

  return (
    <div>
      <Link
        href="/dashboard/accreditation"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
      >
        <ArrowLeft size={13} /> Към процедурите
      </Link>

      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title={cycle.title}
        subtitle={`${formatDate(cycle.period_start)} – ${formatDate(cycle.period_end)} · отговорник: ${userName(cycle.lead_id)}`}
        eyebrow={cycle.kind === "internal" ? "Вътрешна самооценка" : "Институционална оценка"}
        actions={
          <>
            <Badge tone={ACCREDITATION_STATUS[cycle.status].tone}>
              {ACCREDITATION_STATUS[cycle.status].label}
            </Badge>
            <form action={setCycleStatusAction}>
              <input type="hidden" name="id" value={cycle.id} />
              <input type="hidden" name="status" value={cycle.status === "active" ? "completed" : "active"} />
              <SubmitButton variant={cycle.status === "active" ? "outline" : "gold"} size="sm" pendingText="…">
                {cycle.status === "active" ? "Приключи процедурата" : "Активирай"}
              </SubmitButton>
            </form>
            {cycle.status !== "archived" ? (
              <form action={setCycleStatusAction}>
                <input type="hidden" name="id" value={cycle.id} />
                <input type="hidden" name="status" value="archived" />
                <SubmitButton variant="ghost" size="sm" pendingText="…" confirm="Да архивира ли процедурата?">
                  Архивирай
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Напредък</div>
          <div className="mt-1 font-display text-[24px] font-semibold">{percent}%</div>
          <ProgressBar value={percent} tone={percent === 100 ? "success" : "navy"} />
          <div className="mt-2 text-[11px] text-muted">
            {approved} от {criteria.length} критерия одобрени
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Доказателства</div>
          <div className="mt-1 font-display text-[24px] font-semibold">{cycleEvidence.length}</div>
          <div className="mt-2 text-[11px] text-muted">Прикачени файлове и описания</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Доклади</div>
          <div className="mt-1 font-display text-[24px] font-semibold">{reports.length}</div>
          <div className="mt-2 text-[11px] text-muted">
            {reports.filter((r) => r.status === "submitted").length} чакат одобрение
          </div>
        </Card>
      </div>

      {cycle.description ? (
        <Alert tone="info" title="Обхват на процедурата" className="mb-5">
          {cycle.description}
        </Alert>
      ) : null}

      <Card className="mb-5">
        <CardHeader title="Критерии и електронни досиета" description={`${criteria.length} критерия`} icon={Target} />
        <CardBody className="space-y-4">
          <Collapsible summary="Добави критерий">
            <form action={addQualityCriterionAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="cycle_id" value={cycle.id} />
              <Field label="Код" required>
                <Input name="code" required maxLength={20} placeholder="1.1" />
              </Field>
              <Field label="Отговорник">
                <Select name="responsible_id" defaultValue="">
                  <option value="">Без отговорник</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Критерий" required className="sm:col-span-2">
                <Input name="title" required minLength={3} placeholder="Управление на качеството" />
              </Field>
              <Field label="Описание" className="sm:col-span-2">
                <Textarea name="description" rows={2} />
              </Field>
              <Field label="Целева оценка (0–100)">
                <Input name="target_score" type="number" min={0} max={100} step="1" />
              </Field>
              <Field label="Краен срок">
                <Input name="due_date" type="date" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Добавяне…">
                  <Plus size={15} /> Добави критерий
                </SubmitButton>
              </div>
            </form>
          </Collapsible>

          {criteria.length === 0 ? (
            <EmptyState
              icon={Target}
              compact
              title="Няма добавени критерии"
              description="Добавете критериите по модела за оценка — всеки получава собствено електронно досие с доказателства и отговорник."
            />
          ) : (
            <div className="space-y-3">
              {criteria.map((criterion) => {
                const items = evidence.filter((item) => item.criterion_id === criterion.id);
                return (
                  <details key={criterion.id} className="group rounded-xl border border-hairline bg-panel">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy-50 font-mono text-[11px] font-semibold text-navy-700 dark:bg-navy-800/60 dark:text-gold-300">
                        {criterion.code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{criterion.title}</span>
                        <span className="block text-[11px] text-muted">
                          {userName(criterion.responsible_id)}
                          {criterion.due_date ? ` · срок ${formatDateShort(criterion.due_date)}` : ""}
                          {` · ${items.length} доказателства`}
                        </span>
                      </span>
                      {criterion.self_score != null ? (
                        <span className="text-[11.5px] text-muted">самооценка {Number(criterion.self_score)}</span>
                      ) : null}
                      <Badge tone={CRITERION_STATUS[criterion.status].tone}>
                        {CRITERION_STATUS[criterion.status].label}
                      </Badge>
                    </summary>

                    <div className="border-t border-hairline px-4 py-4">
                      {criterion.description ? (
                        <p className="mb-3 text-[12.5px] leading-6 text-muted">{criterion.description}</p>
                      ) : null}

                      <form action={updateCriterionAction} className="grid gap-2 sm:grid-cols-[1fr_0.8fr_0.8fr_auto]">
                        <input type="hidden" name="id" value={criterion.id} />
                        <input type="hidden" name="cycle_id" value={cycle.id} />
                        <Field label="Статус">
                          <Select name="status" defaultValue={criterion.status}>
                            {Object.entries(CRITERION_STATUS).map(([key, meta]) => (
                              <option key={key} value={key}>
                                {meta.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Самооценка">
                          <Input
                            name="self_score"
                            type="number"
                            min={0}
                            max={100}
                            step="1"
                            defaultValue={criterion.self_score ?? ""}
                          />
                        </Field>
                        <Field label="Отговорник">
                          <Select name="responsible_id" defaultValue={criterion.responsible_id || ""}>
                            <option value="">—</option>
                            {staff.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.full_name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <div className="flex items-end">
                          <SubmitButton variant="outline" size="sm" pendingText="…">
                            Запази
                          </SubmitButton>
                        </div>
                      </form>

                      <div className="mt-4 border-t border-hairline pt-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                          Доказателства
                        </div>
                        {items.length === 0 ? (
                          <p className="mb-2 text-[11.5px] text-muted">Няма прикачени доказателства.</p>
                        ) : (
                          <ul className="mb-3 space-y-1.5">
                            {items.map((item) => (
                              <li key={item.id} className="flex items-center gap-2 rounded-lg bg-panel2 px-3 py-2">
                                <Paperclip size={13} className="shrink-0 text-muted" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[12px]">{item.title}</div>
                                  <div className="text-[10.5px] text-muted">
                                    {item.file_name ? `${item.file_name} · ${formatBytes(item.size_bytes)}` : "описание без файл"}
                                  </div>
                                </div>
                                {item.storage_path ? (
                                  <a
                                    href={`/api/files/${item.storage_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted hover:text-content"
                                    title="Свали"
                                  >
                                    <Download size={13} />
                                  </a>
                                ) : null}
                                <form action={deleteEvidenceAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <input type="hidden" name="cycle_id" value={cycle.id} />
                                  <SubmitButton variant="ghost" size="icon" pendingText="" confirm="Да премахна ли доказателството?">
                                    <Trash2 size={13} className="text-danger" />
                                  </SubmitButton>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}

                        <form action={addEvidenceAction} className="grid gap-2 sm:grid-cols-[1.2fr_1.2fr_auto]">
                          <input type="hidden" name="criterion_id" value={criterion.id} />
                          <input type="hidden" name="cycle_id" value={cycle.id} />
                          <Field label="Наименование">
                            <Input name="title" required minLength={3} placeholder="Годишен план" />
                          </Field>
                          <Field label="Файл (PDF/JPG/PNG)">
                            <input
                              type="file"
                              name="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="field-input py-1.5 text-[11.5px] file:mr-2 file:rounded file:border-0 file:bg-panel2 file:px-2 file:py-1 file:text-[11px]"
                            />
                          </Field>
                          <div className="flex items-end">
                            <SubmitButton variant="subtle" size="sm" pendingText="…">
                              <FolderPlus size={14} /> Добави
                            </SubmitButton>
                          </div>
                        </form>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Доклади и анализи" description={`${reports.length} записа`} icon={FileText} />
          <CardBody className="space-y-4">
            <Collapsible summary="Нов доклад">
              <form action={createReportAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="cycle_id" value={cycle.id} />
                <Field label="Заглавие" required className="sm:col-span-2">
                  <Input name="title" required minLength={3} placeholder="Доклад от самооценката" />
                </Field>
                <Field label="Вид">
                  <Select name="kind" defaultValue="report">
                    {Object.entries(REPORT_KIND).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Резюме" required className="sm:col-span-2">
                  <Textarea name="summary" rows={3} required minLength={20} />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton pendingText="Създаване…">Създай доклад</SubmitButton>
                </div>
              </form>
            </Collapsible>

            {reports.length === 0 ? (
              <p className="text-[12.5px] text-muted">Няма създадени доклади по тази процедура.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((report) => (
                  <li key={report.id} className="rounded-xl border border-hairline p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{report.title}</div>
                        <div className="text-[11px] text-muted">
                          {REPORT_KIND[report.kind]} · {userName(report.author_id)} · {formatDateShort(report.created_at)}
                        </div>
                      </div>
                      <Badge tone={REPORT_STATUS[report.status].tone}>{REPORT_STATUS[report.status].label}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-[12px] leading-6 text-muted">{report.summary}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {report.status === "draft" || report.status === "returned" ? (
                        <form action={submitReportAction}>
                          <input type="hidden" name="id" value={report.id} />
                          <input type="hidden" name="cycle_id" value={cycle.id} />
                          <SubmitButton variant="outline" size="sm" pendingText="…">
                            <CheckCircle2 size={13} /> Подай за одобрение
                          </SubmitButton>
                        </form>
                      ) : null}
                      {canDecide && report.status === "submitted" ? (
                        <>
                          <form action={reviewReportAction}>
                            <input type="hidden" name="id" value={report.id} />
                            <input type="hidden" name="cycle_id" value={cycle.id} />
                            <input type="hidden" name="decision" value="approved" />
                            <SubmitButton variant="gold" size="sm" pendingText="…">
                              Одобри
                            </SubmitButton>
                          </form>
                          <form action={reviewReportAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={report.id} />
                            <input type="hidden" name="cycle_id" value={cycle.id} />
                            <input type="hidden" name="decision" value="returned" />
                            <input
                              name="note"
                              placeholder="Причина за връщане"
                              className="h-8 rounded-md border border-hairline bg-panel px-2 text-[11.5px]"
                            />
                            <SubmitButton variant="ghost" size="sm" pendingText="…">
                              <RotateCcw size={13} /> Върни
                            </SubmitButton>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Препоръки и коригиращи действия" icon={BadgeCheck} />
            <CardBody>
              <form action={addRecommendationAction} className="space-y-3">
                <input type="hidden" name="cycle_id" value={cycle.id} />
                <Field label="Препоръка">
                  <Input name="title" required minLength={3} placeholder="Да се актуализира планът…" />
                </Field>
                <Field label="Коригиращо действие">
                  <Textarea name="summary" rows={3} required minLength={10} />
                </Field>
                <SubmitButton variant="outline" pendingText="…">
                  <Plus size={14} /> Добави препоръка
                </SubmitButton>
              </form>
              <ul className="mt-4 space-y-2">
                {reports
                  .filter((report) => report.kind === "recommendation" || report.kind === "improvement_plan")
                  .map((report) => (
                    <li key={report.id} className="rounded-lg bg-panel2 px-3 py-2 text-[12px]">
                      <div className="font-medium">{report.title}</div>
                      <div className="text-[11px] text-muted">{report.summary}</div>
                    </li>
                  ))}
                {reports.filter((r) => r.kind === "recommendation" || r.kind === "improvement_plan").length === 0 ? (
                  <li className="text-[11.5px] text-muted">Няма добавени препоръки.</li>
                ) : null}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Информация" icon={CalendarClock} />
            <CardBody className="space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Вид</span>
                <span>{cycle.kind === "internal" ? "Вътрешна" : "Институционална"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Период</span>
                <span>
                  {formatDateShort(cycle.period_start)} – {formatDateShort(cycle.period_end)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Отговорник</span>
                <span>{userName(cycle.lead_id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Създадена</span>
                <span>{formatDateShort(cycle.created_at)}</span>
              </div>
            </CardBody>
          </Card>

          <Alert tone="warning" title="Важно">
            Вътрешната оценка не представлява официална държавна акредитация. Резултатите служат за
            подготовка и планиране на подобрения.
          </Alert>
        </div>
      </div>
    </div>
  );
}
