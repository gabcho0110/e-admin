"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { countRows, deleteRow, getRow, insertRow, updateRow } from "@/lib/db";
import { notifyRole } from "@/lib/notifications";
import type { JobPostRow } from "@/lib/types";
import { fieldErrors, jobSchema } from "@/lib/validation/schemas";
import { z } from "zod";

const BASE = "/dashboard/recruitment";

function parseJob(formData: FormData) {
  return jobSchema.safeParse({
    title: text(formData, "title"),
    department: text(formData, "department"),
    employment_type: text(formData, "employment_type"),
    positions_count: text(formData, "positions_count"),
    deadline: text(formData, "deadline"),
    description: text(formData, "description"),
    requirements: text(formData, "requirements"),
    responsibilities: text(formData, "responsibilities"),
    salary_range: text(formData, "salary_range"),
  });
}

function firstMessage(error: z.ZodError): string {
  return Object.values(fieldErrors(error))[0] || "Проверете въведените данни.";
}

export async function createJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const parsed = parseJob(formData);
  if (!parsed.success) backWithError(BASE, firstMessage(parsed.error));

  const data = parsed.data;
  const job = await insertRow<JobPostRow>("job_posts", {
    ...data,
    responsibilities: data.responsibilities || "",
    salary_range: data.salary_range || null,
    status: "draft",
    published_at: null,
    created_by: user.id,
  });

  await audit({
    actor: user,
    action: "job.created",
    entity: "job_posts",
    entityId: job.id,
    meta: { title: job.title },
  });

  revalidatePath(BASE);
  backWithOk(`${BASE}/${job.id}`, "Черновата е създадена.");
}

export async function updateJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  const parsed = parseJob(formData);
  if (!parsed.success) backWithError(`${BASE}/${id}`, firstMessage(parsed.error));

  await updateRow<JobPostRow>("job_posts", id, {
    ...parsed.data,
    responsibilities: parsed.data.responsibilities || "",
    salary_range: parsed.data.salary_range || null,
  });

  await audit({ actor: user, action: "job.updated", entity: "job_posts", entityId: id });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, "Промените са запазени.");
}

export async function publishJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  const job = await getRow<JobPostRow>("job_posts", id);
  if (!job) backWithError(BASE, "Обявата не е намерена.");
  if (new Date(job.deadline).getTime() < Date.now()) {
    backWithError(`${BASE}/${id}`, "Крайният срок е в миналото — коригирайте го преди публикуване.");
  }

  await updateRow<JobPostRow>("job_posts", id, {
    status: "published",
    published_at: new Date().toISOString(),
  });

  await notifyRole("hr_expert", {
    title: `Публикувана обява: ${job.title}`,
    body: `Обявата е активна в публичния портал. Краен срок: ${job.deadline}.`,
    kind: "success",
    link: `${BASE}/${id}`,
  });

  await audit({ actor: user, action: "job.published", entity: "job_posts", entityId: id });
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  revalidatePath("/jobs");
  backWithOk(`${BASE}/${id}`, "Обявата е публикувана.");
}

export async function closeJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");

  await updateRow<JobPostRow>("job_posts", id, { status: "closed" });
  await audit({ actor: user, action: "job.closed", entity: "job_posts", entityId: id });
  revalidatePath(BASE);
  revalidatePath("/jobs");
  backWithOk(`${BASE}/${id}`, "Обявата е затворена.");
}

export async function reopenJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  await updateRow<JobPostRow>("job_posts", id, { status: "draft" });
  await audit({ actor: user, action: "job.reopened", entity: "job_posts", entityId: id });
  revalidatePath(BASE);
  backWithOk(`${BASE}/${id}`, "Обявата е върната като чернова.");
}

export async function deleteJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  const applications = await countRows("applications", { job_post_id: id });
  if (applications > 0) {
    backWithError(`${BASE}/${id}`, "Обявата има подадени кандидатури и не може да бъде изтрита. Затворете я вместо това.");
  }

  await deleteRow("job_posts", id);
  await audit({ actor: user, action: "job.deleted", entity: "job_posts", entityId: id });
  revalidatePath(BASE);
  backWithOk(BASE, "Обявата е изтрита.");
}

export async function duplicateJobAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  const job = await getRow<JobPostRow>("job_posts", id);
  if (!job) backWithError(BASE, "Обявата не е намерена.");

  const copy = await insertRow<JobPostRow>("job_posts", {
    title: `${job.title} (копие)`,
    department: job.department,
    employment_type: job.employment_type,
    positions_count: job.positions_count,
    description: job.description,
    requirements: job.requirements,
    responsibilities: job.responsibilities,
    salary_range: job.salary_range,
    deadline: job.deadline,
    status: "draft",
    published_at: null,
    created_by: user.id,
  });

  await audit({ actor: user, action: "job.duplicated", entity: "job_posts", entityId: copy.id });
  revalidatePath(BASE);
  backWithOk(`${BASE}/${copy.id}`, "Създадено е копие като чернова.");
}

export async function saveJobNotesAction(formData: FormData): Promise<void> {
  const user = await guard("recruitment.manage");
  const id = text(formData, "id");
  const note = optional(formData, "note");
  await audit({
    actor: user,
    action: "job.note",
    entity: "job_posts",
    entityId: id,
    meta: { note },
  });
  backWithOk(`${BASE}/${id}`, "Бележката е записана в журнала.");
}
