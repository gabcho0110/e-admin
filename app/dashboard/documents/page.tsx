import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Filter, FolderOpen, Plus, Search } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Badge,
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
import { createDocumentAction, registerIncomingAction } from "@/lib/actions/documents";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import type { DocumentRow, UserRow } from "@/lib/types";
import { formatDateShort, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Документи" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; status?: string; type?: string; q?: string }>;
}) {
  const user = await requirePermission("documents.view");
  const sp = await searchParams;

  const [documents, users] = await Promise.all([
    listRows<DocumentRow>("documents", { orderBy: "created_at" }),
    listRows<UserRow>("users"),
  ]);

  const status = sp.status || "";
  const type = sp.type || "";
  const query = (sp.q || "").trim().toLowerCase();

  const filtered = documents.filter((doc) => {
    if (status && doc.status !== status) return false;
    if (type && doc.doc_type !== type) return false;
    if (query && !`${doc.title} ${doc.number}`.toLowerCase().includes(query)) return false;
    return true;
  });

  const authorName = (id: string | null) => users.find((u) => u.id === id)?.full_name || "—";
  const canManage = user.permissions.includes("documents.manage");

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Електронен документооборот"
        subtitle="Заповеди, протоколи, доклади, справки, планове, входящи и изходящи документи с версии и архив."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Всички документи" value={documents.length} icon={FolderOpen} />
        <StatCard
          label="За одобрение"
          value={documents.filter((d) => d.status === "pending_approval").length}
          icon={FileText}
          accent="gold"
        />
        <StatCard
          label="Одобрени"
          value={documents.filter((d) => d.status === "approved").length}
          icon={FileText}
          accent="success"
        />
      </div>

      {canManage ? (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader title="Нов документ" description="Номерът се генерира автоматично" icon={Plus} />
            <CardBody>
              <Collapsible summary="Създай документ">
                <form action={createDocumentAction} className="space-y-3">
                  <Field label="Заглавие" required>
                    <Input name="title" required minLength={3} placeholder="Заповед за назначаване на комисия" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Вид" required>
                      <Select name="doc_type" defaultValue="order">
                        {Object.entries(DOC_TYPE).map(([key, meta]) => (
                          <option key={key} value={key}>
                            {meta.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Свързана процедура">
                      <Input name="related_type" placeholder="напр. подбор 2026" />
                    </Field>
                  </div>
                  <Field label="Съдържание" required>
                    <Textarea name="body" rows={5} required minLength={10} placeholder="Текст на документа…" />
                  </Field>
                  <SubmitButton pendingText="Създаване…">Създай чернова</SubmitButton>
                </form>
              </Collapsible>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Регистрирай входящ документ" description="Входящата поща се регистрира с номер" icon={FileText} />
            <CardBody>
              <Collapsible summary="Регистрирай входящ">
                <form action={registerIncomingAction} className="space-y-3">
                  <Field label="Заглавие" required>
                    <Input name="title" required minLength={3} placeholder="Писмо от РУО" />
                  </Field>
                  <Field label="Съдържание / резюме" required>
                    <Textarea name="body" rows={4} required minLength={5} />
                  </Field>
                  <SubmitButton variant="outline" pendingText="Регистриране…">
                    Регистрирай
                  </SubmitButton>
                </form>
              </Collapsible>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardBody className="py-4">
          <form className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
            <Field label="Търсене">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input name="q" defaultValue={sp.q || ""} placeholder="Заглавие или номер…" className="pl-8" />
              </div>
            </Field>
            <Field label="Вид">
              <Select name="type" defaultValue={type}>
                <option value="">Всички</option>
                {Object.entries(DOC_TYPE).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue={status}>
                <option value="">Всички</option>
                {Object.entries(DOC_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-navy-700 px-4 text-[13px] font-medium text-white hover:bg-navy-800"
            >
              <Filter size={14} /> Филтър
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={FolderOpen}
                title={documents.length === 0 ? "Регистърът е празен" : "Няма резултати по филтрите"}
                description={
                  documents.length === 0
                    ? "Създайте първия документ — системата ще генерира уникален номер и ще пази всяка версия."
                    : "Променете критериите или изчистете филтрите."
                }
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Заглавие</th>
                    <th>Вид</th>
                    <th>Версия</th>
                    <th>Автор</th>
                    <th>Дата</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr key={doc.id}>
                      <td className="whitespace-nowrap font-mono text-[11.5px] text-muted">{doc.number}</td>
                      <td className="max-w-[320px]">
                        <Link
                          href={`/dashboard/documents/${doc.id}`}
                          className="block truncate font-medium hover:text-navy-600 dark:hover:text-gold-300"
                        >
                          {doc.title}
                        </Link>
                        <div className="truncate text-[11px] text-muted">{truncate(doc.body.replace(/\s+/g, " "), 80)}</div>
                      </td>
                      <td>
                        <Badge tone={DOC_TYPE[doc.doc_type].tone}>{DOC_TYPE[doc.doc_type].label}</Badge>
                      </td>
                      <td className="text-[12px] text-muted">v{doc.version}</td>
                      <td className="text-[12px] text-muted">{authorName(doc.author_id)}</td>
                      <td className="whitespace-nowrap text-[12px] text-muted">{formatDateShort(doc.created_at)}</td>
                      <td>
                        <Badge tone={DOC_STATUS[doc.status].tone}>{DOC_STATUS[doc.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
