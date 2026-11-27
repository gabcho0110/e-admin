import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, FileText, Search, UsersRound } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader } from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { APPLICATION_STATUS, DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import type { ApplicationRow, DocumentRow, JobPostRow, UserRow } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Търсене" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const query = (sp.q || "").trim();
  const needle = query.toLowerCase();

  const canReview = user.permissions.includes("applications.review");
  const canDocs = user.permissions.includes("documents.view");
  const canStaff = user.permissions.includes("staff.view");
  const canJobs = user.permissions.includes("recruitment.manage");

  const [applications, documents, users, jobs] = await Promise.all([
    canReview && query ? listRows<ApplicationRow>("applications") : Promise.resolve([]),
    canDocs && query ? listRows<DocumentRow>("documents") : Promise.resolve([]),
    canStaff && query ? listRows<UserRow>("users") : Promise.resolve([]),
    canJobs && query ? listRows<JobPostRow>("job_posts") : Promise.resolve([]),
  ]);

  const foundApplications = query
    ? applications.filter((a) =>
        `${a.first_name} ${a.last_name} ${a.registration_number} ${a.email}`.toLowerCase().includes(needle),
      )
    : [];
  const foundDocuments = query
    ? documents.filter((d) => `${d.title} ${d.number}`.toLowerCase().includes(needle))
    : [];
  const foundUsers = query
    ? users.filter((u) => `${u.full_name} ${u.email} ${u.position || ""}`.toLowerCase().includes(needle))
    : [];
  const foundJobs = query ? jobs.filter((j) => `${j.title} ${j.department}`.toLowerCase().includes(needle)) : [];

  const total = foundApplications.length + foundDocuments.length + foundUsers.length + foundJobs.length;

  return (
    <div>
      <PageHeader title="Търсене" subtitle="Кандидатури, документи, служители и обяви в едно поле." />

      <Card className="mb-5">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3">
            <Field label="Търсена дума" className="min-w-[240px] flex-1">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input name="q" defaultValue={query} placeholder="Име, номер, заглавие…" className="pl-9" autoFocus />
              </div>
            </Field>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy-700 px-4 text-[13px] font-medium text-white hover:bg-navy-800"
            >
              <Search size={14} /> Търси
            </button>
          </form>
        </CardBody>
      </Card>

      {!query ? (
        <EmptyState
          icon={Search}
          title="Въведете дума за търсене"
          description="Търсенето обхваща само модулите, до които имате достъп."
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title={`Няма резултати за „${query}“`}
          description="Проверете изписването или опитайте с номер, имейл или част от заглавие."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-muted">{total} резултата за „{query}“</p>

          {foundApplications.length > 0 ? (
            <Card>
              <CardHeader title="Кандидатури" description={`${foundApplications.length} резултата`} icon={BriefcaseBusiness} />
              <CardBody className="p-0">
                <ul className="divide-y divide-hairline">
                  {foundApplications.map((application) => (
                    <li key={application.id}>
                      <Link href={`/dashboard/selection/${application.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">
                            {application.first_name} {application.last_name}
                          </span>
                          <span className="block text-[11px] text-muted">
                            № {application.registration_number} · {application.email}
                          </span>
                        </span>
                        <Badge tone={APPLICATION_STATUS[application.status].tone}>
                          {APPLICATION_STATUS[application.status].label}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {foundDocuments.length > 0 ? (
            <Card>
              <CardHeader title="Документи" description={`${foundDocuments.length} резултата`} icon={FileText} />
              <CardBody className="p-0">
                <ul className="divide-y divide-hairline">
                  {foundDocuments.map((doc) => (
                    <li key={doc.id}>
                      <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{doc.title}</span>
                          <span className="block text-[11px] text-muted">
                            {doc.number} · {DOC_TYPE[doc.doc_type].label} · {formatDateShort(doc.created_at)}
                          </span>
                        </span>
                        <Badge tone={DOC_STATUS[doc.status].tone}>{DOC_STATUS[doc.status].label}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {foundUsers.length > 0 ? (
            <Card>
              <CardHeader title="Служители" description={`${foundUsers.length} резултата`} icon={UsersRound} />
              <CardBody className="p-0">
                <ul className="divide-y divide-hairline">
                  {foundUsers.map((person) => (
                    <li key={person.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium">{person.full_name}</span>
                        <span className="block text-[11px] text-muted">
                          {person.position || "—"} · {person.email}
                        </span>
                      </span>
                      <Badge tone={person.is_active ? "success" : "danger"}>
                        {person.is_active ? "активен" : "деактивиран"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {foundJobs.length > 0 ? (
            <Card>
              <CardHeader title="Обяви" description={`${foundJobs.length} резултата`} icon={BriefcaseBusiness} />
              <CardBody className="p-0">
                <ul className="divide-y divide-hairline">
                  {foundJobs.map((job) => (
                    <li key={job.id}>
                      <Link href={`/dashboard/recruitment/${job.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{job.title}</span>
                          <span className="block text-[11px] text-muted">{job.department}</span>
                        </span>
                        <Badge tone={job.status === "published" ? "success" : "neutral"}>
                          {job.status === "published" ? "публикувана" : job.status === "draft" ? "чернова" : "затворена"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
