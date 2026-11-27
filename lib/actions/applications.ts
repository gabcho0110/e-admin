"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import type { ActionState } from "@/lib/actions/types";
import { deleteRow, getRow, insertRow, listRows, updateRow } from "@/lib/db";
import { APPLICATION_STATUS } from "@/lib/labels";
import { emailLayout, sendEmail } from "@/lib/notifications/email";
import { notifyRole, notifyUsers } from "@/lib/notifications";
import { nextApplicationNumber } from "@/lib/numbering";
import { saveUpload } from "@/lib/storage";
import type {
  ApplicationEventRow,
  ApplicationRow,
  ApplicationStatus,
  CandidateDocumentRow,
  DocumentKind,
  JobPostRow,
  SessionUser,
} from "@/lib/types";
import { applicationSchema, fieldErrors } from "@/lib/validation/schemas";
import { validateUpload } from "@/lib/validation/files";

const ALLOWED_STATUS: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "admitted",
  "not_admitted",
  "interview",
  "approved",
  "rejected",
  "archived",
];

/* ───────────────────────── Публично подаване ───────────────────────── */

export async function submitApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = applicationSchema.safeParse({
    job_post_id: text(formData, "job_post_id"),
    first_name: text(formData, "first_name"),
    middle_name: text(formData, "middle_name"),
    last_name: text(formData, "last_name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    city: text(formData, "city"),
    motivation: text(formData, "motivation"),
    consent: text(formData, "consent"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Проверете отбелязаните полета.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const job = await getRow<JobPostRow>("job_posts", data.job_post_id);
  if (!job || job.status !== "published") {
    return { status: "error", message: "Обявата не е активна. Изберете друга позиция." };
  }
  if (new Date(job.deadline).getTime() < Date.now() - 86_400_000) {
    return { status: "error", message: "Крайният срок за тази позиция е изтекъл." };
  }

  const cv = formData.get("cv");
  const motivationFile = formData.get("motivation_file");
  const diploma = formData.get("diploma");
  const certificate = formData.get("certificate");

  const checks: Array<[string, File | null, boolean]> = [
    ["cv", cv instanceof File ? cv : null, true],
    ["motivation_file", motivationFile instanceof File ? motivationFile : null, false],
    ["diploma", diploma instanceof File ? diploma : null, false],
    ["certificate", certificate instanceof File ? certificate : null, false],
  ];

  for (const [field, file, required] of checks) {
    const result = validateUpload(file, { required });
    if (!result.ok) {
      return {
        status: "error",
        message: result.error || "Невалиден файл.",
        fieldErrors: { [field]: result.error || "Невалиден файл" },
      };
    }
  }

  const existing = await listRows<ApplicationRow>("applications");
  const duplicate = existing.find(
    (row) => row.job_post_id === job.id && row.email.toLowerCase() === data.email.toLowerCase(),
  );
  if (duplicate) {
    return {
      status: "error",
      message: `Вече имате подадена кандидатура по тази позиция (№ ${duplicate.registration_number}).`,
    };
  }

  const registrationNumber = await nextApplicationNumber("PIG");

  const application = await insertRow<ApplicationRow>("applications", {
    registration_number: registrationNumber,
    job_post_id: job.id,
    first_name: data.first_name,
    middle_name: data.middle_name || null,
    last_name: data.last_name,
    email: data.email,
    phone: data.phone,
    city: data.city || null,
    motivation: data.motivation,
    status: "submitted",
    committee_id: null,
    score_total: null,
    decision_note: null,
    submitted_at: new Date().toISOString(),
  });

  const kinds: Array<[DocumentKind, File | null]> = [
    ["cv", cv instanceof File ? cv : null],
    ["motivation", motivationFile instanceof File ? motivationFile : null],
    ["diploma", diploma instanceof File ? diploma : null],
    ["certificate", certificate instanceof File ? certificate : null],
  ];

  try {
    for (const [kind, file] of kinds) {
      if (!file || file.size === 0) continue;
      const stored = await saveUpload(file, `applications/${application.id}`);
      await insertRow<CandidateDocumentRow>("candidate_documents", {
        application_id: application.id,
        kind,
        file_name: stored.name,
        storage_path: stored.path,
        mime_type: stored.mime,
        size_bytes: stored.size,
        uploaded_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    await deleteRow("applications", application.id);
    console.error("[application] качване", error);
    return {
      status: "error",
      message: "Документите не можаха да бъдат качени. Опитайте отново или се свържете с администратора.",
    };
  }

  await insertRow<ApplicationEventRow>("application_events", {
    application_id: application.id,
    status: "submitted",
    note: "Кандидатурата е подадена онлайн чрез публичния портал.",
    actor_id: null,
  });

  const fullName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ");
  await sendEmail({
    to: data.email,
    subject: `Потвърждение на кандидатура № ${registrationNumber}`,
    html: emailLayout(
      "Кандидатурата е получена",
      `<p>Уважаеми/а ${fullName},</p>
       <p>Вашата кандидатура за позицията <strong>${job.title}</strong> е регистрирана успешно.</p>
       <p style="font-size:15px;padding:12px 16px;background:#F3F5F8;border-left:3px solid #C5A253">
         Регистрационен номер: <strong>${registrationNumber}</strong>
       </p>
       <p>Запазете този номер. С него и с имейла си можете да проследявате статуса на кандидатурата
       по всяко време на адрес: <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/track">Проследяване</a>.</p>
       <p>При промяна на статуса ще получите допълнително уведомление.</p>`,
    ),
  });

  await notifyRole("hr_expert", {
    title: `Нова кандидатура: ${job.title}`,
    body: `${fullName} подаде кандидатура № ${registrationNumber} за позиция „${job.title}“.`,
    kind: "info",
    link: `/dashboard/selection/${application.id}`,
  });
  await notifyRole("director", {
    title: `Нова кандидатура: ${job.title}`,
    body: `Регистрирана е кандидатура № ${registrationNumber} (${fullName}).`,
    kind: "info",
    link: `/dashboard/selection/${application.id}`,
  });

  await audit({
    action: "application.submitted",
    entity: "applications",
    entityId: application.id,
    meta: { registration_number: registrationNumber, job: job.title },
  });

  revalidatePath("/dashboard/selection");
  revalidatePath("/dashboard");

  return { status: "success", redirectTo: `/apply/success/${registrationNumber}` };
}

/* ───────────────────────── Служебни действия ───────────────────────── */

export async function updateApplicationStatusAction(formData: FormData): Promise<void> {
  const user = await guard("applications.review");
  const id = text(formData, "application_id");
  const status = text(formData, "status") as ApplicationStatus;
  const note = optional(formData, "note");
  const path = `/dashboard/selection/${id}`;

  if (!ALLOWED_STATUS.includes(status)) backWithError(path, "Невалиден статус.");

  const application = await getRow<ApplicationRow>("applications", id);
  if (!application) backWithError("/dashboard/selection", "Кандидатурата не е намерена.");

  if ((status === "approved" || status === "rejected") && !user.permissions.includes("director.decide")) {
    backWithError(path, "Окончателно решение може да вземе само директорът.");
  }

  await updateRow<ApplicationRow>("applications", id, {
    status,
    decision_note: note ?? application.decision_note,
    updated_at: new Date().toISOString(),
  });

  await insertRow<ApplicationEventRow>("application_events", {
    application_id: id,
    status,
    note,
    actor_id: user.id,
  });

  const job = await getRow<JobPostRow>("job_posts", application.job_post_id);
  await sendEmail({
    to: application.email,
    subject: `Промяна на статуса на кандидатура № ${application.registration_number}`,
    html: emailLayout(
      "Нов статус на вашата кандидатура",
      `<p>Статусът на кандидатура № <strong>${application.registration_number}</strong>${job ? ` за позиция „${job.title}“` : ""} е променен на
       <strong>${APPLICATION_STATUS[status].label}</strong>.</p>
       ${note ? `<p>Бележка: ${note}</p>` : ""}
       <p>Можете да проверите подробностите в публичния портал.</p>`,
    ),
  });

  await audit({
    actor: user,
    action: "application.status_changed",
    entity: "applications",
    entityId: id,
    meta: { from: application.status, to: status, note },
  });

  revalidatePath(path);
  revalidatePath("/dashboard/selection");
  backWithOk(path, "Статусът е обновен.");
}

export async function assignCommitteeAction(formData: FormData): Promise<void> {
  const user = await guard("applications.review");
  const id = text(formData, "application_id");
  const committeeId = optional(formData, "committee_id");
  const path = `/dashboard/selection/${id}`;

  const application = await getRow<ApplicationRow>("applications", id);
  if (!application) backWithError("/dashboard/selection", "Кандидатурата не е намерена.");

  await updateRow<ApplicationRow>("applications", id, { committee_id: committeeId });

  await audit({
    actor: user,
    action: "application.committee_assigned",
    entity: "applications",
    entityId: id,
    meta: { committee_id: committeeId },
  });

  revalidatePath(path);
  backWithOk(path, "Комисията е зададена.");
}

export async function archiveApplicationAction(formData: FormData): Promise<void> {
  const user = await guard("applications.review");
  const id = text(formData, "application_id");

  await updateRow<ApplicationRow>("applications", id, { status: "archived" });
  await insertRow<ApplicationEventRow>("application_events", {
    application_id: id,
    status: "archived",
    note: "Кандидатурата е архивирана.",
    actor_id: user.id,
  });
  await audit({ actor: user, action: "application.archived", entity: "applications", entityId: id });

  revalidatePath("/dashboard/selection");
  backWithOk("/dashboard/selection", "Кандидатурата е архивирана.");
}

/** Известие до комисията при възлагане (използва се от UI). */
export async function notifyCommitteeAction(
  committeeId: string,
  title: string,
  body: string,
  actor: SessionUser,
): Promise<void> {
  const members = await listRows<{ user_id: string }>("committee_members", {
    where: { committee_id: committeeId },
  });
  await notifyUsers(
    members.map((m) => m.user_id),
    { title, body, kind: "info", link: `/dashboard/committees/${committeeId}` },
  );
  await audit({ actor, action: "committee.notified", entity: "committees", entityId: committeeId });
}
