import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, ShieldCheck } from "lucide-react";

import { Alert } from "@/components/ui/primitives";
import { ApplyForm } from "@/components/portal/apply-form";
import { getRow, getSettings } from "@/lib/db";
import type { JobPostRow } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Кандидатстване" };
export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getRow<JobPostRow>("job_posts", jobId);

  if (!job || job.status !== "published") notFound();

  const left = daysUntil(job.deadline);
  if (left !== null && left < 0) {
    redirect(`/jobs/${job.id}`);
  }

  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link
        href={`/jobs/${job.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-content"
      >
        <ArrowLeft size={14} /> Назад към обявата
      </Link>

      <div className="mb-7">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
          Електронно кандидатстване
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span>{job.department}</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={13} /> краен срок {formatDate(job.deadline)}
          </span>
          {left !== null ? <span>остават {left} дни</span> : null}
        </div>
      </div>

      <Alert tone="info" icon={ShieldCheck} className="mb-6">
        Всички полета с <span className="font-semibold text-danger">*</span> са задължителни. Данните
        се изпращат по защитена връзка и се обработват само за целите на подбора от{" "}
        {settings.institution_name}.
      </Alert>

      <ApplyForm jobId={job.id} jobTitle={job.title} />
    </div>
  );
}
