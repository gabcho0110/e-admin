import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileText, Mail, Search } from "lucide-react";

import { Badge, ButtonLink } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/client";
import { getSettings, listRows } from "@/lib/db";
import { APPLICATION_STATUS } from "@/lib/labels";
import type { ApplicationRow, JobPostRow } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Кандидатурата е подадена" };
export const dynamic = "force-dynamic";

export default async function ApplySuccessPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const decoded = decodeURIComponent(number);

  const rows = await listRows<ApplicationRow>("applications", {
    where: { registration_number: decoded },
    limit: 1,
  });
  const application = rows[0] ?? null;
  const job = application
    ? await listRows<JobPostRow>("job_posts", { where: { id: application.job_post_id }, limit: 1 })
    : [];
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800">
          <CheckCircle2 size={28} />
        </span>
        <h1 className="mt-5 text-[26px] font-semibold tracking-tight">Кандидатурата е получена</h1>
        <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-7 text-muted">
          Благодарим Ви. Заявлението е регистрирано в системата на {settings.institution_name} и ще
          бъде разгледано от комисията по подбор.
        </p>
      </div>

      <div className="surface-card mt-8 overflow-hidden">
        <div className="border-b border-hairline bg-panel2/70 px-6 py-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Регистрационен номер
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="font-mono text-[24px] font-semibold tracking-wide">{decoded}</span>
            <CopyButton value={decoded} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted">
            Запазете номера. Той е необходим за проследяване на статуса.
          </p>
        </div>

        {application ? (
          <dl className="divide-y divide-hairline text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
              <dt className="text-muted">Позиция</dt>
              <dd className="text-right font-medium">{job[0]?.title ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
              <dt className="text-muted">Кандидат</dt>
              <dd className="text-right font-medium">
                {[application.first_name, application.middle_name, application.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
              <dt className="text-muted">Имейл за връзка</dt>
              <dd className="text-right">{application.email}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
              <dt className="text-muted">Дата на подаване</dt>
              <dd className="text-right">{formatDateTime(application.submitted_at)}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5">
              <dt className="text-muted">Текущ статус</dt>
              <dd className="text-right">
                <Badge tone={APPLICATION_STATUS[application.status].tone}>
                  {APPLICATION_STATUS[application.status].label}
                </Badge>
              </dd>
            </div>
          </dl>
        ) : (
          <div className="px-6 py-6 text-center text-[13px] text-muted">
            Данните за кандидатурата не са налични в публичния изглед. Запазете номера{" "}
            <span className="font-mono font-medium text-content">{decoded}</span> и го използвайте за
            проследяване.
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Mail,
            title: "Потвърждение по имейл",
            text: "Изпратихме копие от номера на посочения от Вас адрес.",
          },
          {
            icon: FileText,
            title: "Преглед на документите",
            text: "Комисията преглежда прикачените файлове в срок до 7 работни дни.",
          },
          {
            icon: Search,
            title: "Проследяване",
            text: "Статусът се обновява при всяко действие по кандидатурата.",
          },
        ].map((item) => (
          <div key={item.title} className="surface-card p-4">
            <item.icon size={17} className="text-navy-600 dark:text-gold-300" />
            <div className="mt-2 text-[13px] font-semibold">{item.title}</div>
            <p className="mt-1 text-[11.5px] leading-5 text-muted">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/track" size="lg">
          <Search size={15} /> Проследи кандидатурата
        </ButtonLink>
        <ButtonLink href="/jobs" variant="outline" size="lg">
          Други активни обяви
        </ButtonLink>
      </div>

      <p className="mt-8 text-center text-[11.5px] leading-6 text-muted">
        Ако не получите потвърждение в рамките на 24 часа, проверете папка „Спам“ или се свържете с
        нас на{" "}
        <a href={`mailto:${settings.institution_email}`} className="font-medium text-navy-600 hover:underline dark:text-gold-300">
          {settings.institution_email}
        </a>
        .{" "}
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Политика за поверителност
        </Link>
        .
      </p>
    </div>
  );
}
