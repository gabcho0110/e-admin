"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { countRows, deleteRow, getRow, insertRow, updateRow } from "@/lib/db";
import { DOC_TYPE } from "@/lib/labels";
import { nextDocumentNumber } from "@/lib/numbering";
import { notifyRole } from "@/lib/notifications";
import type { DocType, DocumentRow, DocumentVersionRow } from "@/lib/types";
import { documentSchema, fieldErrors } from "@/lib/validation/schemas";

const BASE = "/dashboard/documents";

const DOC_TYPES: DocType[] = [
  "order",
  "protocol",
  "report",
  "reference",
  "plan",
  "program",
  "incoming",
  "outgoing",
  "policy",
];

export async function createDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const parsed = documentSchema.safeParse({
    title: text(formData, "title"),
    doc_type: text(formData, "doc_type"),
    body: text(formData, "body"),
    related_type: text(formData, "related_type"),
  });
  if (!parsed.success) backWithError(BASE, Object.values(fieldErrors(parsed.error))[0]);
  if (!DOC_TYPES.includes(parsed.data.doc_type)) backWithError(BASE, "Невалиден вид документ.");

  const number = await nextDocumentNumber(parsed.data.doc_type);

  const document = await insertRow<DocumentRow>("documents", {
    number,
    title: parsed.data.title,
    doc_type: parsed.data.doc_type,
    status: "draft",
    version: 1,
    author_id: user.id,
    related_type: parsed.data.related_type || null,
    related_id: null,
    body: parsed.data.body,
  });

  await insertRow<DocumentVersionRow>("document_versions", {
    document_id: document.id,
    version: 1,
    body: parsed.data.body,
    note: "Първоначална версия",
    changed_by: user.id,
  });

  await audit({
    actor: user,
    action: "document.created",
    entity: "documents",
    entityId: document.id,
    meta: { number, type: DOC_TYPE[document.doc_type].label },
  });

  revalidatePath(BASE);
  backWithOk(`${BASE}/${document.id}`, `Документ № ${number} е създаден.`);
}

export async function updateDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const id = text(formData, "id");
  const body = text(formData, "body");
  const note = optional(formData, "note");
  const title = text(formData, "title");

  if (body.length < 10) backWithError(`${BASE}/${id}`, "Съдържанието е твърде кратко.");

  const document = await getRow<DocumentRow>("documents", id);
  if (!document) backWithError(BASE, "Документът не е намерен.");
  if (document.status === "approved" || document.status === "archived") {
    backWithError(`${BASE}/${id}`, "Одобрен или архивиран документ не може да се редактира. Създайте нова версия чрез връщане за корекция.");
  }

  const version = Number(document.version) + 1;

  await updateRow<DocumentRow>("documents", id, {
    body,
    title: title || document.title,
    version,
    status: document.status === "returned" ? "draft" : document.status,
  });

  await insertRow<DocumentVersionRow>("document_versions", {
    document_id: id,
    version,
    body,
    note: note || `Версия ${version}`,
    changed_by: user.id,
  });

  await audit({
    actor: user,
    action: "document.version_created",
    entity: "documents",
    entityId: id,
    meta: { version },
  });

  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, `Записана е версия ${version}.`);
}

export async function submitDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const id = text(formData, "id");
  const document = await getRow<DocumentRow>("documents", id);
  if (!document) backWithError(BASE, "Документът не е намерен.");

  await updateRow<DocumentRow>("documents", id, { status: "pending_approval" });

  await notifyRole("director", {
    title: "Документ за одобрение",
    body: `${DOC_TYPE[document.doc_type].label} № ${document.number} — ${document.title}`,
    kind: "warning",
    link: `${BASE}/${id}`,
  });

  await audit({ actor: user, action: "document.submitted", entity: "documents", entityId: id });
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Документът е изпратен за одобрение.");
}

export async function approveDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("director.decide");
  const id = text(formData, "id");

  await updateRow<DocumentRow>("documents", id, {
    status: "approved",
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  });

  await audit({ actor: user, action: "document.approved", entity: "documents", entityId: id });
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  backWithOk(`${BASE}/${id}`, "Документът е одобрен.");
}

export async function returnDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("director.decide");
  const id = text(formData, "id");
  const note = optional(formData, "note");
  if (!note) backWithError(`${BASE}/${id}`, "Опишете причината за връщане.");

  const document = await getRow<DocumentRow>("documents", id);
  await updateRow<DocumentRow>("documents", id, { status: "returned" });

  if (document?.author_id) {
    await notifyRole("hr_expert", {
      title: "Документ за корекция",
      body: `Документ № ${document.number} е върнат за корекция: ${note}`,
      kind: "warning",
      link: `${BASE}/${id}`,
    });
  }

  await audit({
    actor: user,
    action: "document.returned",
    entity: "documents",
    entityId: id,
    meta: { note },
  });

  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Документът е върнат за корекция.");
}

export async function archiveDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const id = text(formData, "id");
  await updateRow<DocumentRow>("documents", id, { status: "archived" });
  await audit({ actor: user, action: "document.archived", entity: "documents", entityId: id });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Документът е архивиран.");
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const id = text(formData, "id");
  const document = await getRow<DocumentRow>("documents", id);
  if (!document) backWithError(BASE, "Документът не е намерен.");
  if (document.status !== "draft") {
    backWithError(`${BASE}/${id}`, "Само чернова може да бъде изтрита. Архивирайте документа вместо това.");
  }

  await deleteRow("documents", id);
  await audit({ actor: user, action: "document.deleted", entity: "documents", entityId: id });
  revalidatePath(BASE);
  backWithOk(BASE, "Черновата е изтрита.");
}

export async function registerIncomingAction(formData: FormData): Promise<void> {
  const user = await guard("documents.manage");
  const title = text(formData, "title");
  const body = text(formData, "body");
  if (title.length < 3 || body.length < 5) {
    backWithError(BASE, "Попълнете заглавие и съдържание на входящия документ.");
  }

  const number = await nextDocumentNumber("incoming");
  const document = await insertRow<DocumentRow>("documents", {
    number,
    title,
    doc_type: "incoming",
    status: "draft",
    version: 1,
    author_id: user.id,
    related_type: null,
    related_id: null,
    body,
  });

  await insertRow<DocumentVersionRow>("document_versions", {
    document_id: document.id,
    version: 1,
    body,
    note: "Регистриран входящ документ",
    changed_by: user.id,
  });

  await audit({
    actor: user,
    action: "document.incoming_registered",
    entity: "documents",
    entityId: document.id,
    meta: { number },
  });

  revalidatePath(BASE);
  backWithOk(BASE, `Входящ документ № ${number} е регистриран.`);
}

export async function documentStatsAction(): Promise<{ total: number; pending: number }> {
  const total = await countRows("documents");
  const pending = await countRows("documents", { status: "pending_approval" });
  return { total, pending };
}
