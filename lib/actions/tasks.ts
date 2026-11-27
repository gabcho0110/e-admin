"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteRow, getRow, insertRow, updateRow } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import type { TaskRow, TaskStatus } from "@/lib/types";
import { fieldErrors, taskSchema } from "@/lib/validation/schemas";

const BASE = "/dashboard/tasks";
const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

export async function createTaskAction(formData: FormData): Promise<void> {
  const user = await guard("tasks.manage");
  const parsed = taskSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    assignee_id: text(formData, "assignee_id"),
    due_date: text(formData, "due_date"),
    priority: text(formData, "priority") || "normal",
    related_type: text(formData, "related_type"),
  });
  if (!parsed.success) backWithError(BASE, Object.values(fieldErrors(parsed.error))[0]);

  const task = await insertRow<TaskRow>("tasks", {
    title: parsed.data.title,
    description: parsed.data.description || null,
    assignee_id: parsed.data.assignee_id,
    due_date: parsed.data.due_date || null,
    priority: parsed.data.priority,
    status: "todo",
    related_type: parsed.data.related_type || null,
    related_id: null,
    created_by: user.id,
  });

  if (task.assignee_id && task.assignee_id !== user.id) {
    await notifyUsers([task.assignee_id], {
      title: "Нова задача",
      body: `${task.title}${task.due_date ? ` · срок ${task.due_date}` : ""}`,
      kind: "info",
      link: BASE,
    });
  }

  await audit({
    actor: user,
    action: "task.created",
    entity: "tasks",
    entityId: task.id,
    meta: { title: task.title, assignee_id: task.assignee_id },
  });

  revalidatePath(BASE);
  backWithOk(BASE, "Задачата е създадена.");
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const id = text(formData, "id");
  const status = text(formData, "status") as TaskStatus;
  if (!STATUSES.includes(status)) backWithError(BASE, "Невалиден статус.");

  const task = await getRow<TaskRow>("tasks", id);
  if (!task) backWithError(BASE, "Задачата не е намерена.");

  const canManage = user.permissions.includes("tasks.manage");
  if (!canManage && task.assignee_id !== user.id && task.created_by !== user.id) {
    backWithError(BASE, "Нямате право да променяте тази задача.");
  }

  await updateRow<TaskRow>("tasks", id, {
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
  });

  await audit({
    actor: user,
    action: "task.status_changed",
    entity: "tasks",
    entityId: id,
    meta: { from: task.status, to: status },
  });

  revalidatePath(BASE);
  backWithOk(BASE, "Статусът на задачата е обновен.");
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const user = await guard("tasks.manage");
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (title.length < 3) backWithError(BASE, "Въведете заглавие на задачата.");

  await updateRow<TaskRow>("tasks", id, {
    title,
    description: optional(formData, "description"),
    assignee_id: optional(formData, "assignee_id"),
    due_date: optional(formData, "due_date"),
    priority: (text(formData, "priority") || "normal") as TaskRow["priority"],
  });

  await audit({ actor: user, action: "task.updated", entity: "tasks", entityId: id });
  revalidatePath(BASE);
  backWithOk(BASE, "Задачата е обновена.");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const user = await guard("tasks.manage");
  const id = text(formData, "id");
  await deleteRow("tasks", id);
  await audit({ actor: user, action: "task.deleted", entity: "tasks", entityId: id });
  revalidatePath(BASE);
  backWithOk(BASE, "Задачата е изтрита.");
}
