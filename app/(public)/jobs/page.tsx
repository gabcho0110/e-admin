import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, MapPin, UsersRound } from "lucide-react";

import { Badge, ButtonLink, EmptyState } from "@/components/ui/primitives";
import { listRows } from "@/lib/db";
import type { JobPostRow } from "@/lib/types";
import { daysUntil, formatDateShort } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Обяви за работа",
  description: "Актуални свободни позиции в ПИГ „Св. Климент Охридски“.",
};
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await listRows<JobPostRow>("job_posts", { where: { status: "published" }, orderBy: "deadline" });
  const active = jobs.filter((job) => new Date(job.deadline).getTime() >= Date.now() - 86_400_000);
  const expired = jobs.filter((job) => new Date(job.deadline).getTime() < Date.now() - 86_400_000);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="mb-8 max-w-2xl">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
          Кариера
        </div>
        <h1 className="text-[30px] font-semibold tracking-tight">Обяви за работа</h1>
        <p className="mt-2 text-[13.5px] leading-6 text-muted">
          Всички свободни позиции се публикуват тук с описание, изисквания и краен срок. Кандидатстването
          е онлайн, с прикачване на документи и автоматичен регистрационен номер.
        </p>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Няма активни обяви в момента"
          description="Следете тази страница — при откриване на позиция обявата се публикува незабавно. Можете да създадете профил, за да проследявате кандидатурите си."
          action={
            <ButtonLink href="/register" variant="outline" size="sm">
              Създай профил
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {active.map((job) => {
            const left = daysUntil(job.deadline);
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="surface-card group block p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold group-hover:text-navy-600 dark:group-hover:text-gold-300">
                        {job.title}
                      </h2>
                      <Badge tone={left !== null && left <= 3 ? "warning" : "success"}>
                        {left !== null && left >= 0 ? `още ${left} дни` : "изтекъл срок"}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} /> {job.department}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness size={12} /> {job.employment_type}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UsersRound size={12} /> {job.positions_count} позиция(и)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={12} /> до {formatDateShort(job.deadline)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-3xl text-[12.5px] leading-6 text-muted">{job.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-navy-600 dark:text-gold-300">
                    Детайли <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {expired.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
            Приключили процедури
          </h2>
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-panel">
            {expired.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{job.title}</span>
                <span className="text-[11px] text-muted">краен срок {formatDateShort(job.deadline)}</span>
                <Badge tone="neutral">приключила</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
