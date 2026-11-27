import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileSearch,
  Info,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { getCurrentUser, isCandidate } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { APPLICATION_FLOW, APPLICATION_STATUS } from "@/lib/labels";
import type { ApplicationEventRow, ApplicationRow, JobPostRow } from "@/lib/types";
import { formatDate, formatDateTime, fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Проследяване на кандидатура" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ number?: string; email?: string; err?: string }>;

export default async function TrackPage({ searchParams }: { searchParams: SearchParams }) {
  const { number, email } = await searchParams;
  const user = await getCurrentUser();
  const candidateView = isCandidate(user) && !user?.permissions.includes("applications.review");

  const wanted = (number || "").trim().toUpperCase();
  const mail = (email || "").trim().toLowerCase();

  let application: ApplicationRow | null = null;
  let job: JobPostRow | null = null;
  let events: ApplicationEventRow[] = [];
  let notFound = false;

  if (wanted && mail) {
    const rows = await listRows<ApplicationRow>("applications", {
      where: { registration_number: wanted },
      limit: 1,
    });
    const found = rows[0] ?? null;
    if (found && found.email.toLowerCase() === mail) {
      application = found;
      const jobs = await listRows<JobPostRow>("job_posts", { where: { id: found.job_post_id }, limit: 1 });
      job = jobs[0] ?? null;
      events = await listRows<ApplicationEventRow>("application_events", {
        where: { application_id: found.id },
        orderBy: "created_at",
        ascending: true,
      });
    } else {
      notFound = true;
    }
  }

  const ownApplications = candidateView
    ? await listRows<ApplicationRow>("applications", {
        where: { email: user!.email.toLowerCase() },
        orderBy: "submitted_at",
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
          Публичен портал
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Проследяване на кандидатура</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-7 text-muted">
          Въведете регистрационния номер от потвърждението и имейла, с който сте кандидатствали. Двете
          стойности трябва да съвпадат — така защитаваме данните Ви от неоторизиран достъп.
        </p>
      </div>

      <Card>
        <CardHeader
          icon={Search}
          title="Проверка на статус"
          description="Достъп до собствената кандидатура по номер и имейл"
        />
        <CardBody>
          <form method="get" action="/track" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="number" className="field-label">
                Регистрационен номер
              </label>
              <input
                id="number"
                name="number"
                defaultValue={wanted}
                placeholder="PIG-2026-000123"
                className="field-input font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="field-label">
                Имейл
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={mail}
                placeholder="ime@example.com"
                className="field-input"
                required
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy-700 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
            >
              <Search size={15} /> Провери
            </button>
          </form>

          {notFound ? (
            <Alert tone="warning" icon={Info} className="mt-4">
              Не намерихме кандидатура с този номер и имейл. Проверете дали номерът е въведен изцяло
              (например <span className="font-mono">PIG-2026-000123</span>) и дали имейлът съвпада с
              посочения при кандидатстването.
            </Alert>
          ) : null}
        </CardBody>
      </Card>

      {application ? (
        <div className="mt-6 animate-fade-up space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted">
                  Кандидатура <span className="font-mono">{application.registration_number}</span>
                </div>
                <h2 className="mt-1 text-[17px] font-semibold">{job?.title ?? "Позиция"}</h2>
                <div className="mt-1 text-[12px] text-muted">
                  {job?.department ? `${job.department} · ` : ""}подадена {formatDateTime(application.submitted_at)}
                </div>
              </div>
              <Badge tone={APPLICATION_STATUS[application.status].tone}>
                {APPLICATION_STATUS[application.status].label}
              </Badge>
            </div>

            <CardBody className="space-y-5">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Етапи на процедурата
                </div>
                <ol className="space-y-0">
                  {APPLICATION_FLOW.map((step, index) => {
                    const reachedIndex = APPLICATION_FLOW.indexOf(application!.status);
                    const reached = reachedIndex >= index || application!.status === "approved";
                    const current = application!.status === step;
                    return (
                      <li key={step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 " +
                              (reached
                                ? "bg-navy-700 text-white ring-navy-700"
                                : "bg-panel text-muted ring-hairline")
                            }
                          >
                            {reached ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                          </span>
                          {index < APPLICATION_FLOW.length - 1 ? (
                            <span
                              className={
                                "my-0.5 w-px flex-1 " + (reached ? "bg-navy-300 dark:bg-navy-600" : "bg-hairline")
                              }
                            />
                          ) : null}
                        </div>
                        <div className={"pb-4 " + (current ? "" : "opacity-80")}>
                          <div className="text-[13px] font-medium">{APPLICATION_STATUS[step].label}</div>
                          {current ? (
                            <div className="text-[11.5px] text-muted">Текущ етап на кандидатурата</div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {application.status === "rejected" || application.status === "not_admitted" ? (
                  <Alert tone="danger" className="mt-1">
                    Кандидатурата не е одобрена на този етап.{" "}
                    {application.decision_note ? application.decision_note : "За повече информация се свържете с институцията."}
                  </Alert>
                ) : null}
                {application.status === "archived" ? (
                  <Alert tone="info" className="mt-1">
                    Процедурата е приключена и кандидатурата е преместена в архив.
                  </Alert>
                ) : null}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  История на кандидатурата
                </div>
                {events.length === 0 ? (
                  <p className="text-[12.5px] text-muted">Няма регистрирани събития.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {events.map((event) => (
                      <li key={event.id} className="flex gap-3 text-[12.5px]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        <div>
                          <div className="font-medium">{APPLICATION_STATUS[event.status].label}</div>
                          {event.note ? <div className="text-muted">{event.note}</div> : null}
                          <div className="text-[11px] text-muted">{formatDateTime(event.created_at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card p-4 text-[12px] leading-6 text-muted">
              <CalendarClock size={15} className="mb-1 text-navy-600 dark:text-gold-300" />
              Срокът за разглеждане е до 14 календарни дни от крайния срок на обявата
              {job ? ` (${formatDate(job.deadline)})` : ""}.
            </div>
            <div className="surface-card p-4 text-[12px] leading-6 text-muted">
              <ShieldCheck size={15} className="mb-1 text-navy-600 dark:text-gold-300" />
              Индивидуалните оценки на комисията не се публикуват — те са служебна информация по
              смисъла на чл. 2, ал. 1 от ЗЗЛД.
            </div>
          </div>
        </div>
      ) : null}

      {candidateView ? (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">
              Моите кандидатури
            </h2>
            <span className="text-[12px] text-muted">{user?.email}</span>
          </div>
          {ownApplications.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="Няма подадени кандидатури"
              description="Кандидатствайте по активна обява — регистрационният номер ще се появи тук автоматично."
              action={
                <ButtonLink href="/jobs" size="sm">
                  Разгледай обявите <ArrowRight size={14} />
                </ButtonLink>
              }
              compact
            />
          ) : (
            <div className="surface-card divide-y divide-hairline">
              {ownApplications.map((row) => (
                <Link
                  key={row.id}
                  href={`/track?number=${encodeURIComponent(row.registration_number)}&email=${encodeURIComponent(row.email)}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-panel2"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[12.5px] font-medium">{row.registration_number}</div>
                    <div className="text-[11.5px] text-muted">
                      подадена {fromNow(row.submitted_at)}
                    </div>
                  </div>
                  <Badge tone={APPLICATION_STATUS[row.status].tone}>
                    {APPLICATION_STATUS[row.status].label}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!candidateView ? (
        <p className="mt-8 text-center text-[12px] text-muted">
          Загубихте регистрационния си номер?{" "}
          <Link href="/login/help" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
            Вижте как да го възстановите
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
