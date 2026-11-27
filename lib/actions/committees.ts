"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, checked, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { countRows, deleteRow, getRow, insertRow, listRows, updateRow } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import type {
  ApplicationRow,
  CommitteeMemberRow,
  CommitteeRow,
  EvaluationCriterionRow,
  EvaluationRow,
  SessionUser,
} from "@/lib/types";
import { committeeSchema, fieldErrors } from "@/lib/validation/schemas";

const BASE = "/dashboard/committees";

export async function createCommitteeAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const parsed = committeeSchema.safeParse({
    name: text(formData, "name"),
    purpose: text(formData, "purpose"),
    protocol_number: text(formData, "protocol_number"),
  });
  if (!parsed.success) backWithError(BASE, Object.values(fieldErrors(parsed.error))[0]);

  const committee = await insertRow<CommitteeRow>("committees", {
    name: parsed.data.name,
    purpose: parsed.data.purpose || null,
    protocol_number: parsed.data.protocol_number || null,
    status: "draft",
    created_by: user.id,
  });

  await audit({
    actor: user,
    action: "committee.created",
    entity: "committees",
    entityId: committee.id,
    meta: { name: committee.name },
  });

  revalidatePath(BASE);
  backWithOk(`${BASE}/${committee.id}`, "Комисията е създадена.");
}

export async function updateCommitteeAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const id = text(formData, "id");
  const parsed = committeeSchema.safeParse({
    name: text(formData, "name"),
    purpose: text(formData, "purpose"),
    protocol_number: text(formData, "protocol_number"),
  });
  if (!parsed.success) backWithError(`${BASE}/${id}`, Object.values(fieldErrors(parsed.error))[0]);

  await updateRow<CommitteeRow>("committees", id, {
    name: parsed.data.name,
    purpose: parsed.data.purpose || null,
    protocol_number: parsed.data.protocol_number || null,
  });

  await audit({ actor: user, action: "committee.updated", entity: "committees", entityId: id });
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Промените са запазени.");
}

export async function setCommitteeStatusAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["draft", "active", "closed"].includes(status)) backWithError(`${BASE}/${id}`, "Невалиден статус.");

  await updateRow<CommitteeRow>("committees", id, { status });
  await audit({
    actor: user,
    action: "committee.status_changed",
    entity: "committees",
    entityId: id,
    meta: { status },
  });
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Статусът е обновен.");
}

export async function addCommitteeMemberAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const committeeId = text(formData, "committee_id");
  const userId = text(formData, "user_id");
  const role = text(formData, "member_role") || "member";

  if (!userId) backWithError(`${BASE}/${committeeId}`, "Изберете служител.");

  const existing = await listRows<CommitteeMemberRow>("committee_members", {
    where: { committee_id: committeeId, user_id: userId },
  });
  if (existing.length) backWithError(`${BASE}/${committeeId}`, "Този служител вече е член на комисията.");

  const member = await insertRow<CommitteeMemberRow>("committee_members", {
    committee_id: committeeId,
    user_id: userId,
    member_role: role,
    conflict_declared: checked(formData, "conflict_declared"),
  });

  await notifyUsers([userId], {
    title: "Включване в комисия",
    body: `Включени сте в комисия с роля „${
      role === "chair" ? "председател" : role === "secretary" ? "секретар" : "член"
    }“.`,
    kind: "info",
    link: `${BASE}/${committeeId}`,
  });

  await audit({
    actor: user,
    action: "committee.member_added",
    entity: "committee_members",
    entityId: member.id,
    meta: { committee_id: committeeId, user_id: userId, role },
  });

  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, "Членът е добавен.");
}

export async function removeCommitteeMemberAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const id = text(formData, "id");
  const committeeId = text(formData, "committee_id");

  await deleteRow("committee_members", id);

  await audit({
    actor: user,
    action: "committee.member_removed",
    entity: "committee_members",
    entityId: id,
    meta: { committee_id: committeeId },
  });

  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, "Членът е премахнат.");
}

export async function declareConflictAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");
  const id = text(formData, "id");
  const committeeId = text(formData, "committee_id");
  const declared = checked(formData, "conflict_declared");

  await updateRow<CommitteeMemberRow>("committee_members", id, { conflict_declared: declared });
  await audit({
    actor: user,
    action: "committee.conflict_declaration",
    entity: "committee_members",
    entityId: id,
    meta: { declared },
  });
  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, declared ? "Декларирахте конфликт на интереси." : "Декларацията е оттеглена.");
}

export async function addEvaluationCriterionAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const committeeId = text(formData, "committee_id");
  const name = text(formData, "name");
  const maxScore = Number(text(formData, "max_score") || 10);
  const weight = Number(text(formData, "weight") || 1);

  if (name.length < 3) backWithError(`${BASE}/${committeeId}`, "Въведете наименование на критерия.");
  if (!Number.isFinite(maxScore) || maxScore <= 0) backWithError(`${BASE}/${committeeId}`, "Максималната оценка е положително число.");

  const existing = await listRows<EvaluationCriterionRow>("evaluation_criteria", { where: { committee_id: committeeId } });

  await insertRow<EvaluationCriterionRow>("evaluation_criteria", {
    committee_id: committeeId,
    name,
    description: optional(formData, "description"),
    max_score: maxScore,
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    position: existing.length,
  });

  await audit({
    actor: user,
    action: "committee.criterion_added",
    entity: "committees",
    entityId: committeeId,
    meta: { name, maxScore },
  });
  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, "Критерият е добавен.");
}

export async function deleteEvaluationCriterionAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const id = text(formData, "id");
  const committeeId = text(formData, "committee_id");
  await deleteRow("evaluation_criteria", id);
  await audit({ actor: user, action: "committee.criterion_deleted", entity: "evaluation_criteria", entityId: id });
  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, "Критерият е премахнат.");
}

/** Записва индивидуалната оценъчна карта на текущия член за дадена кандидатура. */
export async function saveEvaluationAction(formData: FormData): Promise<void> {
  const user = await guard("evaluations.confidential");
  const committeeId = text(formData, "committee_id");
  const applicationId = text(formData, "application_id");
  const path = `${BASE}/${committeeId}`;

  const membership = await listRows<CommitteeMemberRow>("committee_members", {
    where: { committee_id: committeeId, user_id: user.id },
  });
  if (!membership.length) backWithError(path, "Не сте член на тази комисия.");
  if (membership[0].conflict_declared) {
    backWithError(path, "Декларирали сте конфликт на интереси и не можете да оценявате тази кандидатура.");
  }

  const criteria = await listRows<EvaluationCriterionRow>("evaluation_criteria", {
    where: { committee_id: committeeId },
    orderBy: "position",
    ascending: true,
  });

  const existing = await listRows<EvaluationRow>("evaluations", {
    where: { committee_id: committeeId, application_id: applicationId, member_id: user.id },
  });

  let saved = 0;
  for (const criterion of criteria) {
    const raw = text(formData, `score_${criterion.id}`);
    if (raw === "") continue;
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > Number(criterion.max_score)) {
      backWithError(path, `Оценката по „${criterion.name}“ трябва да е между 0 и ${criterion.max_score}.`);
    }
    const comment = optional(formData, `comment_${criterion.id}`);
    const found = existing.find((row) => row.criterion_id === criterion.id);
    if (found) {
      await updateRow<EvaluationRow>("evaluations", found.id, { score, comment });
    } else {
      await insertRow<EvaluationRow>("evaluations", {
        committee_id: committeeId,
        application_id: applicationId,
        member_id: user.id,
        criterion_id: criterion.id,
        score,
        comment,
      });
    }
    saved += 1;
  }

  if (!saved) backWithError(path, "Въведете поне една оценка.");

  await audit({
    actor: user,
    action: "evaluation.saved",
    entity: "evaluations",
    entityId: applicationId,
    meta: { committee_id: committeeId, criteria: saved },
  });

  revalidatePath(path);
  backWithOk(path, "Оценъчната карта е записана.");
}

/** Приключва комисията: изчислява среднопретеглен резултат и генерира протокол. */
export async function closeCommitteeAction(formData: FormData): Promise<void> {
  const user = await guard("committees.manage");
  const committeeId = text(formData, "id");
  const path = `${BASE}/${committeeId}`;

  const committee = await getRow<CommitteeRow>("committees", committeeId);
  if (!committee) backWithError(BASE, "Комисията не е намерена.");

  const criteria = await listRows<EvaluationCriterionRow>("evaluation_criteria", { where: { committee_id: committeeId } });
  const evaluations = await listRows<EvaluationRow>("evaluations", { where: { committee_id: committeeId } });
  const applications = await listRows<ApplicationRow>("applications", { where: { committee_id: committeeId } });

  if (!evaluations.length) backWithError(path, "Няма въведени оценки — комисията не може да бъде приключена.");

  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0) || 1;

  for (const application of applications) {
    const rows = evaluations.filter((e) => e.application_id === application.id);
    if (!rows.length) continue;
    const members = Array.from(new Set(rows.map((r) => r.member_id)));
    const perMember = members.map((memberId) => {
      const memberRows = rows.filter((r) => r.member_id === memberId);
      const weighted = memberRows.reduce((sum, row) => {
        const criterion = criteria.find((c) => c.id === row.criterion_id);
        return sum + (Number(row.score) / Number(criterion?.max_score || 10)) * Number(criterion?.weight || 1);
      }, 0);
      return (weighted / totalWeight) * 100;
    });
    const average = perMember.reduce((a, b) => a + b, 0) / perMember.length;
    await updateRow<ApplicationRow>("applications", application.id, {
      score_total: Math.round(average * 100) / 100,
    });
  }

  const protocolNumber =
    committee.protocol_number ||
    `ПРОТ-${new Date().getFullYear()}-${String(
      (await countRows("committees")).toString().padStart(3, "0"),
    )}`;

  await updateRow<CommitteeRow>("committees", committeeId, { status: "closed", protocol_number: protocolNumber });

  await audit({
    actor: user,
    action: "committee.closed",
    entity: "committees",
    entityId: committeeId,
    meta: { protocol_number: protocolNumber, applications: applications.length },
  });

  revalidatePath(path);
  backWithOk(path, `Комисията е приключена. Протокол № ${protocolNumber}.`);
}

/** Изпраща покана към членовете (използва се от страницата на комисията). */
export async function remindCommitteeAction(formData: FormData): Promise<void> {
  const user: SessionUser | null = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");
  const committeeId = text(formData, "id");
  const members = await listRows<CommitteeMemberRow>("committee_members", { where: { committee_id: committeeId } });

  await notifyUsers(
    members.map((m) => m.user_id),
    {
      title: "Напомняне за комисия",
      body: "Имате предстоящи оценки за кандидатури. Моля, попълнете оценъчните си карти.",
      kind: "warning",
      link: `${BASE}/${committeeId}`,
    },
  );

  await audit({ actor: user, action: "committee.reminder_sent", entity: "committees", entityId: committeeId });
  revalidatePath(`${BASE}/${committeeId}`);
  backWithOk(`${BASE}/${committeeId}`, "Изпратено е напомняне до членовете.");
}
