import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  History,
  Printer,
  RotateCcw,
  Send,
  Trash2,
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
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui/primitives";
import {
  approveDocumentAction,
  archiveDocumentAction,
  deleteDocumentAction,
  returnDocumentAction,
  submitDocumentAction,
  updateDocumentAction,
} from "@/lib/actions/documents";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import type { DocumentRow, DocumentVersionRow, UserRow } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Документ" };
export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("documents.view");
  const { id } = await params;
  const sp = await searchParams;

  const document = await getRow<DocumentRow>("documents", id);
  if (!document) notFound();

  const [versions, users] = await Promise.all([
    listRows<DocumentVersionRow>("document_versions", { where: { document_id: id }, orderBy: "version", ascending: false }),
    listRows<UserRow>("users"),
  ]);

  const userName = (userId: string | null) => users.find((u) => u.id === userId)?.full_name || "—";
  const canManage = user.permissions.includes("documents.manage");
  const canDecide = user.permissions.includes("director.decide");
  const editable = canManage && (document.status === "draft" || document.status === "returned");

  return (
    <div>
      <Link
        href="/dashboard/documents"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
      >
        <ArrowLeft size={13} /> Към документите
      </Link>

      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title={document.title}
        subtitle={`${DOC_TYPE[document.doc_type].label} · версия ${document.version} · автор ${userName(document.author_id)}`}
        eyebrow={`№ ${document.number}`}
        actions={
          <>
            <Badge tone={DOC_STATUS[document.status].tone}>{DOC_STATUS[document.status].label}</Badge>
            <ButtonLink href={`/print/document/${document.id}`} target="_blank" variant="outline" size="sm">
              <Printer size={14} /> PDF (печат)
            </ButtonLink>
            <ButtonLink href={`/api/documents/${document.id}/export?format=docx`} variant="subtle" size="sm">
              <FileDown size={14} /> DOCX
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Съдържание" description={`Редакция: версия ${document.version}`} icon={Download} />
            <CardBody>
              <div className="doc-body rounded-lg border border-hairline bg-panel2/60 p-4 text-[13.5px]">
                {document.body}
              </div>
            </CardBody>
          </Card>

          {editable ? (
            <Card>
              <CardHeader
                title="Нова версия"
                description="Всяка промяна се запазва като отделна версия с автор и дата."
                icon={History}
              />
              <CardBody>
                <form action={updateDocumentAction} className="space-y-3">
                  <input type="hidden" name="id" value={document.id} />
                  <Field label="Заглавие">
                    <Input name="title" defaultValue={document.title} />
                  </Field>
                  <Field label="Съдържание" required>
                    <Textarea name="body" rows={10} defaultValue={document.body} required minLength={10} />
                  </Field>
                  <Field label="Бележка към версията">
                    <Input name="note" placeholder="Какво е променено?" />
                  </Field>
                  <SubmitButton pendingText="Записване…">
                    Запази като версия {document.version + 1}
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="История на версиите" description={`${versions.length} версии`} icon={History} />
            <CardBody className="p-0">
              <ul className="divide-y divide-hairline">
                {versions.map((version) => (
                  <li key={version.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[12.5px] font-medium">Версия {version.version}</div>
                      <div className="text-[11px] text-muted">
                        {userName(version.changed_by)} · {formatDateTime(version.created_at)}
                      </div>
                    </div>
                    {version.note ? (
                      <div className="mt-0.5 text-[11.5px] text-muted">{version.note}</div>
                    ) : null}
                  </li>
                ))}
                {versions.length === 0 ? (
                  <li className="px-5 py-4 text-[12px] text-muted">Няма записани версии.</li>
                ) : null}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Действия" icon={Send} />
            <CardBody className="space-y-2">
              {document.status === "draft" && canManage ? (
                <form action={submitDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <SubmitButton className="w-full" pendingText="…">
                    <Send size={14} /> Изпрати за одобрение
                  </SubmitButton>
                </form>
              ) : null}

              {document.status === "pending_approval" && canDecide ? (
                <>
                  <form action={approveDocumentAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <SubmitButton className="w-full" pendingText="…">
                      <CheckCircle2 size={14} /> Одобри документа
                    </SubmitButton>
                  </form>
                  <form action={returnDocumentAction} className="space-y-2">
                    <input type="hidden" name="id" value={document.id} />
                    <Field label="Причина за връщане">
                      <Textarea name="note" rows={2} required placeholder="Какво да се коригира?" />
                    </Field>
                    <SubmitButton variant="outline" className="w-full" pendingText="…">
                      <RotateCcw size={14} /> Върни за корекция
                    </SubmitButton>
                  </form>
                </>
              ) : null}

              {document.status === "approved" && canManage ? (
                <form action={archiveDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <SubmitButton variant="outline" className="w-full" pendingText="…">
                    <Archive size={14} /> Архивирай
                  </SubmitButton>
                </form>
              ) : null}

              {document.status === "draft" && canManage ? (
                <form action={deleteDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <SubmitButton
                    variant="ghost"
                    className="w-full"
                    pendingText="…"
                    confirm="Черновата ще бъде изтрита необратимо. Продължавате ли?"
                  >
                    <Trash2 size={14} className="text-danger" /> Изтрий черновата
                  </SubmitButton>
                </form>
              ) : null}

              {document.status === "pending_approval" && !canDecide ? (
                <Alert tone="info">Документът очаква решение на директора.</Alert>
              ) : null}
              {document.status === "approved" ? (
                <Alert tone="success" title="Одобрен">
                  {document.approved_at ? `Одобрен на ${formatDate(document.approved_at)}` : ""} от{" "}
                  {userName(document.approved_by)}.
                </Alert>
              ) : null}
              {document.status === "returned" ? (
                <Alert tone="warning" title="Върнат за корекция">
                  Редактирайте съдържанието и изпратете нова версия за одобрение.
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Данни" icon={Archive} />
            <CardBody className="space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Номер</span>
                <span className="font-mono text-[11.5px]">{document.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Вид</span>
                <span>{DOC_TYPE[document.doc_type].label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Създаден</span>
                <span>{formatDate(document.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Обновен</span>
                <span>{formatDate(document.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Свързана процедура</span>
                <span>{document.related_type || "—"}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
