import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Mail,
  MapPin,
  UsersRound,
} from "lucide-react";

import { Alert, Badge, ButtonLink } from "@/components/ui/primitives";
import { getRow, getSettings } from "@/lib/db";
import type { JobPostRow } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Позиция" };
export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getRow<JobPostRow>("job_posts", id);

  if (!job || job.status !== "published") notFound();

  const settings = await getSettings();
  const left = daysUntil(job.deadline);
  const expired = left !== null && left < 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-content">
        <ArrowLeft size={14} /> Всички обяви
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={expired ? "neutral" : "success"}>{expired ? "изтекъл срок" : "активна обява"}</Badge>
            <span className="text-[11.5px] text-muted">{job.department}</span>
          </div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{job.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-hairline py-3 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusiness size={14} /> {job.employment_type}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound size={14} /> {job.positions_count} позиция(и)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={14} /> краен срок {formatDate(job.deadline)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} /> {settings.institution_name}
            </span>
          </div>

          <section className="mt-7">
            <h2 className="mb-2 text-[15px] font-semibold">Описание на позицията</h2>
            <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-content/85">{job.description}</div>
          </section>

          <section className="mt-7">
            <h2 className="mb-2 text-[15px] font-semibold">Изисквания към кандидатите</h2>
            <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-content/85">{job.requirements}</div>
          </section>

          {job.responsibilities ? (
            <section className="mt-7">
              <h2 className="mb-2 text-[15px] font-semibold">Основни задължения</h2>
              <div className="whitespace-pre-wrap text-[13.5px] leading-7 text-content/85">{job.responsibilities}</div>
            </section>
          ) : null}

          <section className="mt-7">
            <h2 className="mb-2 text-[15px] font-semibold">Необходими документи</h2>
            <ul className="space-y-1.5 text-[13px] leading-6 text-content/85">
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                Автобиография (CV) — задължително, PDF или изображение.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                Мотивационно писмо — по желание.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                Диплома за завършено образование и сертификати — ако са приложими.
              </li>
            </ul>
          </section>
        </article>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <div className="text-[11px] uppercase tracking-[0.1em] text-muted">Кандидатстване</div>
            <div className="mt-1 text-[15px] font-semibold">
              {expired ? "Срокът е изтекъл" : left !== null ? `Остават ${left} дни` : "Отворена процедура"}
            </div>
            <p className="mt-1 text-[12px] leading-6 text-muted">
              Подаването е онлайн. След изпращане получавате регистрационен номер и потвърждение по
              имейл.
            </p>
            {expired ? (
              <Alert tone="warning" className="mt-4">
                Крайният срок за тази позиция е изтекъл. Разгледайте другите активни обяви.
              </Alert>
            ) : (
              <ButtonLink href={`/apply/${job.id}`} className="mt-4 w-full">
                Кандидатствай сега <ArrowRight size={15} />
              </ButtonLink>
            )}
            <ButtonLink href="/track" variant="outline" className="mt-2 w-full">
              Проследи кандидатура
            </ButtonLink>

            <div className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-[11.5px] text-muted">
              <div className="flex justify-between">
                <span>Позиции</span>
                <span className="font-medium text-content">{job.positions_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Вид договор</span>
                <span className="text-right text-content">{job.employment_type}</span>
              </div>
              {job.salary_range ? (
                <div className="flex justify-between">
                  <span>Възнаграждение</span>
                  <span className="text-content">{job.salary_range}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted">За контакт</div>
            <p className="text-[12.5px] leading-6 text-muted">
              {settings.institution_name}
              <br />
              <span className="inline-flex items-center gap-1.5 text-content">
                <Mail size={13} /> {settings.institution_email}
              </span>
              <br />
              {settings.institution_director} — {settings.institution_director_role}
            </p>
          </div>

          <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-4 text-[11.5px] leading-5 text-content/80">
            Институцията обработва личните данни на кандидатите единствено за целите на подбора и
            съгласно Регламент (ЕС) 2016/679.{" "}
            <Link href="/privacy" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
              Политика за поверителност
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
