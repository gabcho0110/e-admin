import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Gavel,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Field,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import {
  archiveApplicationAction,
  assignCommitteeAction,
  updateApplicationStatusAction,
} from "@/lib/actions/applications";
import { saveEvaluationAction } from "@/lib/actions/committees";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import { APPLICATION_STATUS, COMMITTEE_ROLE, DOCUMENT_KIND } from "@/lib/labels";
import type {
  ApplicationEventRow,
  ApplicationRow,
  CandidateDocumentRow,
  CommitteeMemberRow,
  CommitteeRow,
  EvaluationCriterionRow,
  EvaluationRow,
  JobPostRow,
  UserRow,
} from "@/lib/types";
import { formatDate, formatDateTime, formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Кандидатура" };
export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("applications.review");
  const { id } = await params;
  const sp = await searchParams;

  const application = await getRow<ApplicationRow>("applications", id);
  if (!application) notFound();

  const [job, documents, events, committees, users] = await Promise.all([
    getRow<JobPostRow>("job_posts", application.job_post_id),
    listRows<CandidateDocumentRow>("candidate_documents", { where: { application_id: id } }),
    listRows<ApplicationEventRow>("application_events", { where: { application_id: id } }),
    listRows<CommitteeRow>("committees"),
    listRows<UserRow>("users"),
  ]);

  const committee = application.committee_id
    ? committees.find((c) => c.id === application.committee_id) || null
    : null;

  const members = committee
    ? await listRows<CommitteeMemberRow>("committee_members", { where: { committee_id: committee.id } })
    : [];
  const criteria = committee
    ? await listRows<EvaluationCriterionRow>("evaluation_criteria", {
        where: { committee_id: committee.id },
        orderBy: "position",
        ascending: true,
      })
    : [];
  const evaluations = committee
    ? await listRows<EvaluationRow>("evaluations", { where: { committee_id: committee.id, application_id: id } })
    : [];

  const userName = (userId: string | null) => users.find((u) => u.id === userId)?.full_name || "Система";
  const myMembership = members.find((m) => m.user_id === user.id);
  const canSeeConfidential = user.permissions.includes("evaluations.confidential");
  const canDecide = user.permissions.includes("director.decide");
  const isDirector = user.roles.includes("director") || user.roles.includes("superadmin");

  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0) || 1;
  const memberScores = members.map((member) => {
    const rows = evaluations.filter((e) => e.member_id === member.user_id);
    const weighted = rows.reduce((sum, row) => {
      const criterion = criteria.find((c) => c.id === row.criterion_id);
      return sum + (Number(row.score) / Number(criterion?.max_score || 10)) * Number(criterion?.weight || 1);
    }, 0);
    return {
      member,
      count: rows.length,
      percent: rows.length ? Math.round((weighted / totalWeight) * 10000) / 100 : null,
      rows,
    };
  });

  const canEvaluate =
    Boolean(myMembership) && committee?.status !== "closed" && !myMembership?.conflict_declared;

  return (
    <div>
      <Link
        href="/dashboard/selection"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
      >
        <ArrowLeft size={13} /> Към регистъра
      </Link>

      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title={`${application.first_name} ${application.middle_name || ""} ${application.last_name}`.replace(/\s+/g, " ")}
        subtitle={job ? `${job.title} · ${job.department}` : "Позицията е изтрита"}
        eyebrow={`Кандидатура № ${application.registration_number}`}
        actions={
          <>
            <Badge tone={APPLICATION_STATUS[application.status].tone}>
              {APPLICATION_STATUS[application.status].label}
            </Badge>
            {canDecide ? (
              <>
                <form action={updateApplicationStatusAction}>
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="status" value="approved" />
                  <input type="hidden" name="note" value="Одобрена от директора." />
                  <SubmitButton variant="primary" size="sm" pendingText="…">
                    <CheckCircle2 size={14} /> Одобри
                  </SubmitButton>
                </form>
                <form action={updateApplicationStatusAction}>
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <input type="hidden" name="note" value="Отхвърлена от директора." />
                  <SubmitButton variant="outline" size="sm" pendingText="…">
                    <XCircle size={14} /> Отхвърли
                  </SubmitButton>
                </form>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Данни на кандидата" icon={UserRound} />
            <CardBody className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 text-muted" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Имейл</div>
                  <a href={`mailto:${application.email}`} className="hover:underline">
                    {application.email}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 text-muted" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Телефон</div>
                  <a href={`tel:${application.phone}`} className="hover:underline">
                    {application.phone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-muted" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Град</div>
                  <div>{application.city || "—"}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarClock size={14} className="mt-0.5 text-muted" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Подадена</div>
                  <div>{formatDateTime(application.submitted_at)}</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Мотивационно писмо" icon={FileText} />
            <CardBody>
              <div className="doc-body text-[13.5px] text-content/90">{application.motivation}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Прикачени документи"
              description={`${documents.length} файла`}
              icon={Download}
            />
            <CardBody className="p-0">
              {documents.length === 0 ? (
                <p className="px-5 py-6 text-[12.5px] text-muted">Няма прикачени документи.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-3 px-5 py-3">
                      <FileText size={16} className="shrink-0 text-navy-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium">{document.file_name}</div>
                        <div className="text-[11px] text-muted">
                          {DOCUMENT_KIND[document.kind]} · {formatBytes(document.size_bytes)}
                        </div>
                      </div>
                      <a
                        href={`/api/files/${document.storage_path}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2.5 py-1.5 text-[11.5px] text-muted hover:text-content"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={12} /> Свали
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {committee ? (
            <Card>
              <CardHeader
                title="Оценъчна карта"
                description={`${committee.name} · ${criteria.length} критерия`}
                icon={Gavel}
                action={
                  <ButtonLink href={`/dashboard/committees/${committee.id}`} variant="ghost" size="sm">
                    Комисия →
                  </ButtonLink>
                }
              />
              <CardBody>
                {criteria.length === 0 ? (
                  <Alert tone="warning" title="Няма зададени критерии">
                    Комисията няма критерии за оценяване. Добавете ги от страницата на комисията.
                  </Alert>
                ) : canEvaluate ? (
                  <form action={saveEvaluationAction} className="space-y-4">
                    <input type="hidden" name="committee_id" value={committee.id} />
                    <input type="hidden" name="application_id" value={application.id} />
                    {criteria.map((criterion) => {
                      const existing = evaluations.find(
                        (e) => e.member_id === user.id && e.criterion_id === criterion.id,
                      );
                      return (
                        <div key={criterion.id} className="rounded-lg border border-hairline p-3.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <div className="text-[13px] font-medium">{criterion.name}</div>
                              {criterion.description ? (
                                <div className="text-[11.5px] text-muted">{criterion.description}</div>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-muted">
                              макс. {criterion.max_score} · тегло {criterion.weight}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]">
                            <Field label="Оценка">
                              <input
                                type="number"
                                name={`score_${criterion.id}`}
                                min={0}
                                max={Number(criterion.max_score)}
                                step="0.5"
                                defaultValue={existing ? Number(existing.score) : ""}
                                className="field-input"
                              />
                            </Field>
                            <Field label="Коментар">
                              <input
                                name={`comment_${criterion.id}`}
                                defaultValue={existing?.comment || ""}
                                className="field-input"
                                placeholder="Обосновка (по избор)"
                              />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                    <SubmitButton pendingText="Записване…">Запази оценъчната карта</SubmitButton>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {myMembership?.conflict_declared ? (
                      <Alert tone="danger" title="Конфликт на интереси" icon={ShieldCheck}>
                        Декларирали сте конфликт на интереси и не можете да оценявате тази кандидатура.
                      </Alert>
                    ) : (
                      <Alert tone="info" title="Нямате право да оценявате">
                        Оценъчната карта се попълва от членовете на комисията. Вие можете да
                        прегледате обобщения резултат.
                      </Alert>
                    )}
                  </div>
                )}

                {canSeeConfidential && memberScores.length > 0 ? (
                  <div className="mt-5 border-t border-hairline pt-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Обобщение на оценките
                    </div>
                    <ul className="space-y-2">
                      {memberScores.map(({ member, percent: memberPercent, count, rows }) => (
                        <li key={member.id} className="rounded-lg border border-hairline px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[12.5px]">
                              {userName(member.user_id)}{" "}
                              <span className="text-[11px] text-muted">
                                · {COMMITTEE_ROLE[member.member_role]}
                              </span>
                            </span>
                            <span className="text-[12.5px] font-medium">
                              {memberPercent !== null ? `${memberPercent.toFixed(2)} %` : "без оценка"}
                            </span>
                          </div>
                          {isDirector && rows.length > 0 ? (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer text-[11px] text-muted hover:text-content">
                                Индивидуални оценки ({count})
                              </summary>
                              <ul className="mt-1.5 space-y-1 border-l-2 border-gold/30 pl-3 text-[11.5px]">
                                {rows.map((row) => {
                                  const criterion = criteria.find((c) => c.id === row.criterion_id);
                                  return (
                                    <li key={row.id} className="text-muted">
                                      {criterion?.name}: <span className="text-content">{Number(row.score)}</span>
                                      {row.comment ? ` — ${row.comment}` : ""}
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {application.score_total != null ? (
                      <div className="mt-3 rounded-lg bg-panel2 px-3 py-2 text-[12.5px]">
                        Краен резултат след приключване на комисията:{" "}
                        <strong>{application.score_total.toFixed(2)} %</strong>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Статус" description="Промяната се уведомява по имейл" icon={CheckCircle2} />
            <CardBody>
              <form action={updateApplicationStatusAction} className="space-y-3">
                <input type="hidden" name="application_id" value={application.id} />
                <Field label="Нов статус">
                  <Select name="status" defaultValue={application.status}>
                    {Object.entries(APPLICATION_STATUS).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Бележка" hint="Записва се в историята и се изпраща на кандидата.">
                  <Textarea name="note" rows={3} defaultValue={application.decision_note || ""} />
                </Field>
                <SubmitButton pendingText="Обновяване…">Обнови статуса</SubmitButton>
              </form>
              {!canDecide ? (
                <p className="mt-2 text-[11px] text-muted">
                  Статуси „Одобрена“ и „Отхвърлена“ се задават само от директора.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Комисия" description="Възлагане на оценяване" icon={Gavel} />
            <CardBody>
              <form action={assignCommitteeAction} className="space-y-3">
                <input type="hidden" name="application_id" value={application.id} />
                <Field label="Комисия">
                  <Select name="committee_id" defaultValue={application.committee_id || ""}>
                    <option value="">Без комисия</option>
                    {committees.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton variant="outline" pendingText="…">
                  Задай комисия
                </SubmitButton>
              </form>
              {committee ? (
                <div className="mt-3 rounded-lg bg-panel2 px-3 py-2 text-[11.5px] text-muted">
                  {members.length} член(ове) · {criteria.length} критерия · статус „{committee.status}“
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="История" description={`${events.length} записа`} icon={CalendarClock} />
            <CardBody className="p-0">
              {events.length === 0 ? (
                <p className="px-5 py-6 text-[12.5px] text-muted">Няма записи в историята.</p>
              ) : (
                <ol className="relative space-y-0 px-5 py-4">
                  {events.map((event, index) => (
                    <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < events.length - 1 ? (
                        <span className="absolute left-[5px] top-3 h-full w-px bg-hairline" aria-hidden />
                      ) : null}
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-gold bg-panel" />
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium">
                          {APPLICATION_STATUS[event.status].label}
                        </div>
                        <div className="text-[11px] text-muted">
                          {formatDateTime(event.created_at)} · {userName(event.actor_id)}
                        </div>
                        {event.note ? (
                          <div className="mt-0.5 text-[11.5px] leading-5 text-content/80">{event.note}</div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {application.status !== "archived" ? (
            <form action={archiveApplicationAction}>
              <input type="hidden" name="application_id" value={application.id} />
              <SubmitButton variant="ghost" size="sm" pendingText="…" confirm="Да архивира ли кандидатурата?">
                Архивирай кандидатурата
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
