"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { deleteRow, getRow, insertRow, listRows, updateRow } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import { saveUpload } from "@/lib/storage";
import type {
  AccreditationCycleRow,
  CriterionRow,
  CriterionStatus,
  EvidenceRow,
  InstitutionalReportRow,
  ReportStatus,
} from "@/lib/types";
import { criterionSchema, cycleSchema, fieldErrors, reportSchema } from "@/lib/validation/schemas";
import { validateUpload } from "@/lib/validation/files";

const BASE = "/dashboard/accreditation";

const CRITERION_STATUSES: CriterionStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "needs_revision",
];

export async function createCycleAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const parsed = cycleSchema.safeParse({
    title: text(formData, "title"),
    kind: text(formData, "kind"),
    period_start: text(formData, "period_start"),
    period_end: text(formData, "period_end"),
    lead_id: text(formData, "lead_id"),
    description: text(formData, "description"),
  });
  if (!parsed.success) backWithError(BASE, Object.values(fieldErrors(parsed.error))[0]);

  const cycle = await insertRow<AccreditationCycleRow>("accreditation_cycles", {
    title: parsed.data.title,
    kind: parsed.data.kind,
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
    lead_id: parsed.data.lead_id,
    description: parsed.data.description || null,
    status: "draft",
  });

  await audit({
    actor: user,
    action: "accreditation.cycle_created",
    entity: "accreditation_cycles",
    entityId: cycle.id,
    meta: { title: cycle.title },
  });

  revalidatePath(BASE);
  backWithOk(`${BASE}/${cycle.id}`, "Процедурата е създадена.");
}

export async function setCycleStatusAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["draft", "active", "completed", "archived"].includes(status)) {
    backWithError(`${BASE}/${id}`, "Невалиден статус.");
  }

  await updateRow<AccreditationCycleRow>("accreditation_cycles", id, { status });
  await audit({
    actor: user,
    action: "accreditation.cycle_status",
    entity: "accreditation_cycles",
    entityId: id,
    meta: { status },
  });
  revalidatePath(`${BASE}/${id}`);
  revalidatePath(BASE);
  backWithOk(`${BASE}/${id}`, "Статусът на процедурата е обновен.");
}

export async function addQualityCriterionAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const parsed = criterionSchema.safeParse({
    cycle_id: text(formData, "cycle_id"),
    code: text(formData, "code"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    responsible_id: text(formData, "responsible_id"),
    due_date: text(formData, "due_date"),
    target_score: text(formData, "target_score"),
  });
  const cycleId = text(formData, "cycle_id");
  if (!parsed.success) backWithError(`${BASE}/${cycleId}`, Object.values(fieldErrors(parsed.error))[0]);

  const existing = await listRows<CriterionRow>("criteria", { where: { cycle_id: cycleId } });
  if (existing.some((row) => row.code === parsed.data.code)) {
    backWithError(`${BASE}/${cycleId}`, `Критерий с код „${parsed.data.code}“ вече съществува.`);
  }

  const criterion = await insertRow<CriterionRow>("criteria", {
    cycle_id: cycleId,
    code: parsed.data.code,
    title: parsed.data.title,
    description: parsed.data.description || null,
    responsible_id: parsed.data.responsible_id,
    due_date: parsed.data.due_date || null,
    target_score: parsed.data.target_score,
    self_score: null,
    status: "not_started",
  });

  if (parsed.data.responsible_id) {
    await notifyUsers([parsed.data.responsible_id], {
      title: "Възложен критерий по акредитация",
      body: `Отговорни сте за критерий ${criterion.code} — ${criterion.title}.`,
      kind: "info",
      link: `${BASE}/${cycleId}`,
    });
  }

  await audit({
    actor: user,
    action: "accreditation.criterion_created",
    entity: "criteria",
    entityId: criterion.id,
    meta: { code: criterion.code },
  });

  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Критерият е добавен.");
}

export async function updateCriterionAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const id = text(formData, "id");
  const cycleId = text(formData, "cycle_id");
  const status = text(formData, "status") as CriterionStatus;
  const selfScoreRaw = text(formData, "self_score");

  if (!CRITERION_STATUSES.includes(status)) backWithError(`${BASE}/${cycleId}`, "Невалиден статус.");

  const selfScore = selfScoreRaw === "" ? null : Number(selfScoreRaw);
  if (selfScore !== null && (!Number.isFinite(selfScore) || selfScore < 0 || selfScore > 100)) {
    backWithError(`${BASE}/${cycleId}`, "Самооценката е между 0 и 100.");
  }

  await updateRow<CriterionRow>("criteria", id, {
    status,
    self_score: selfScore,
    responsible_id: optional(formData, "responsible_id"),
    due_date: optional(formData, "due_date"),
  });

  await audit({
    actor: user,
    action: "accreditation.criterion_updated",
    entity: "criteria",
    entityId: id,
    meta: { status, self_score: selfScore },
  });

  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Критерият е обновен.");
}

export async function addEvidenceAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const criterionId = text(formData, "criterion_id");
  const cycleId = text(formData, "cycle_id");
  const title = text(formData, "title");

  if (title.length < 3) backWithError(`${BASE}/${cycleId}`, "Въведете наименование на доказателството.");

  const file = formData.get("file");
  const upload = file instanceof File ? file : null;
  const check = validateUpload(upload, { required: false });
  if (!check.ok) backWithError(`${BASE}/${cycleId}`, check.error || "Невалиден файл.");

  let stored: { path: string; name: string; mime: string; size: number } | null = null;
  if (upload && upload.size > 0) {
    try {
      stored = await saveUpload(upload, `evidence/${criterionId}`);
    } catch {
      backWithError(`${BASE}/${cycleId}`, "Файлът не можа да бъде качен.");
    }
  }

  const evidence = await insertRow<EvidenceRow>("evidence", {
    criterion_id: criterionId,
    title,
    description: optional(formData, "description"),
    file_name: stored?.name ?? null,
    storage_path: stored?.path ?? null,
    mime_type: stored?.mime ?? null,
    size_bytes: stored?.size ?? null,
    uploaded_by: user.id,
  });

  await audit({
    actor: user,
    action: "accreditation.evidence_added",
    entity: "evidence",
    entityId: evidence.id,
    meta: { criterion_id: criterionId, title },
  });

  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Доказателството е добавено.");
}

export async function deleteEvidenceAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const id = text(formData, "id");
  const cycleId = text(formData, "cycle_id");
  await deleteRow("evidence", id);
  await audit({ actor: user, action: "accreditation.evidence_deleted", entity: "evidence", entityId: id });
  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Доказателството е премахнато.");
}

export async function createReportAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const parsed = reportSchema.safeParse({
    cycle_id: text(formData, "cycle_id"),
    title: text(formData, "title"),
    kind: text(formData, "kind"),
    summary: text(formData, "summary"),
  });
  const cycleId = text(formData, "cycle_id");
  if (!parsed.success) backWithError(`${BASE}/${cycleId}`, Object.values(fieldErrors(parsed.error))[0]);

  const report = await insertRow<InstitutionalReportRow>("institutional_reports", {
    cycle_id: cycleId,
    title: parsed.data.title,
    kind: parsed.data.kind,
    summary: parsed.data.summary,
    status: "draft",
    author_id: user.id,
  });

  await audit({
    actor: user,
    action: "accreditation.report_created",
    entity: "institutional_reports",
    entityId: report.id,
  });

  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Докладът е създаден.");
}

export async function submitReportAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const id = text(formData, "id");
  const cycleId = text(formData, "cycle_id");

  await updateRow<InstitutionalReportRow>("institutional_reports", id, { status: "submitted" });

  const directors = await listRows<{ user_id: string }>("user_roles", { where: { role_key: "director" } });
  await notifyUsers(
    directors.map((d) => d.user_id),
    {
      title: "Доклад за одобрение",
      body: "Подаден е институционален доклад по процедура за акредитация.",
      kind: "warning",
      link: `${BASE}/${cycleId}`,
    },
  );

  await audit({ actor: user, action: "accreditation.report_submitted", entity: "institutional_reports", entityId: id });
  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Докладът е подаден за одобрение.");
}

export async function reviewReportAction(formData: FormData): Promise<void> {
  const user = await guard("director.decide");
  const id = text(formData, "id");
  const cycleId = text(formData, "cycle_id");
  const decision = text(formData, "decision") as ReportStatus;
  const note = optional(formData, "note");

  if (!["approved", "returned"].includes(decision)) backWithError(`${BASE}/${cycleId}`, "Невалидно решение.");

  const report = await updateRow<InstitutionalReportRow>("institutional_reports", id, {
    status: decision,
    approved_by: decision === "approved" ? user.id : null,
    approved_at: decision === "approved" ? new Date().toISOString() : null,
  });

  if (report.author_id) {
    await notifyUsers([report.author_id], {
      title: decision === "approved" ? "Докладът е одобрен" : "Докладът е върнат за корекция",
      body: note || (decision === "approved" ? "Докладът е одобрен от директора." : "Необходима е корекция."),
      kind: decision === "approved" ? "success" : "warning",
      link: `${BASE}/${cycleId}`,
    });
  }

  await audit({
    actor: user,
    action: decision === "approved" ? "accreditation.report_approved" : "accreditation.report_returned",
    entity: "institutional_reports",
    entityId: id,
    meta: { note },
  });

  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, decision === "approved" ? "Докладът е одобрен." : "Докладът е върнат за корекция.");
}

export async function addRecommendationAction(formData: FormData): Promise<void> {
  const user = await guard("accreditation.manage");
  const cycleId = text(formData, "cycle_id");
  const title = text(formData, "title");
  const summary = text(formData, "summary");
  if (title.length < 3 || summary.length < 10) {
    backWithError(`${BASE}/${cycleId}`, "Попълнете препоръката и коригиращото действие.");
  }

  const report = await insertRow<InstitutionalReportRow>("institutional_reports", {
    cycle_id: cycleId,
    title,
    kind: "recommendation",
    summary,
    status: "draft",
    author_id: user.id,
  });

  await audit({
    actor: user,
    action: "accreditation.recommendation_added",
    entity: "institutional_reports",
    entityId: report.id,
  });
  revalidatePath(`${BASE}/${cycleId}`);
  backWithOk(`${BASE}/${cycleId}`, "Препоръката е добавена.");
}
