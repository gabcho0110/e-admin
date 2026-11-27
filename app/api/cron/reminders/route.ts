import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { listRows } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import type { JobPostRow, NotificationRow, TaskRow } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Без зададен CRON_SECRET задачата е изключена (не отваряме публичен endpoint).
    return false;
  }
  const header = request.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/** Предотвратява повторни известия за същия обект в рамките на 20 часа. */
async function recentlyNotified(userId: string, link: string): Promise<boolean> {
  const rows = await listRows<NotificationRow>("notifications", {
    where: { user_id: userId, link },
    limit: 5,
  });
  return rows.some((row) => Date.now() - new Date(row.created_at).getTime() < 20 * 3_600_000);
}

/**
 * Планирани напомняния (Vercel Cron / външен плануващ агент).
 *
 *   GET /api/cron/reminders  с  Authorization: Bearer $CRON_SECRET
 *
 * Задачи:
 *  1. Изтичащ срок за кандидатстване (≤ 3 дни) → директор.
 *  2. Просрочени задачи → изпълнител + директор.
 *  3. Задачи със срок днес → изпълнител.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 });
  }

  const result = { jobDeadlines: 0, overdueTasks: 0, dueToday: 0 };

  /* 1. Изтичащи обяви */
  const jobs = await listRows<JobPostRow>("job_posts", { where: { status: "published" } });
  const expiring = jobs.filter((job) => {
    const left = daysUntil(job.deadline);
    return left !== null && left >= 0 && left <= 3;
  });

  if (expiring.length) {
    const directors = await listRows<{ user_id: string }>("user_roles", {
      where: { role_key: "director" },
    });
    const ids = directors.map((row) => row.user_id);
    for (const job of expiring) {
      const left = daysUntil(job.deadline) ?? 0;
      const link = `/dashboard/recruitment/${job.id}`;
      if (await recentlyNotified(ids[0] ?? "", link)) continue;
      await notifyUsers(ids, {
        title: `Изтичащ срок: ${job.title}`,
        body: `Крайният срок за кандидатстване е ${formatDate(job.deadline)} (остават ${left} дни).`,
        kind: "deadline",
        link,
      });
      result.jobDeadlines += 1;
    }
  }

  /* 2 и 3. Задачи */
  const tasks = await listRows<TaskRow>("tasks");
  const open = tasks.filter((task) => task.status !== "done" && task.due_date);

  const directors = await listRows<{ user_id: string }>("user_roles", { where: { role_key: "director" } });
  const directorIds = directors.map((row) => row.user_id);

  for (const task of open) {
    const left = daysUntil(task.due_date!);
    if (left === null) continue;
    const link = `/dashboard/tasks`;

    if (left < 0) {
      const targets = Array.from(new Set([task.assignee_id, ...directorIds].filter(Boolean) as string[]));
      if (await recentlyNotified(targets[0] ?? "", link)) continue;
      await notifyUsers(targets, {
        title: `Просрочена задача: ${task.title}`,
        body: `Срокът е изтекъл на ${formatDate(task.due_date!)} (преди ${Math.abs(left)} дни).`,
        kind: "warning",
        link,
      });
      result.overdueTasks += 1;
    } else if (left === 0 && task.assignee_id) {
      if (await recentlyNotified(task.assignee_id, link)) continue;
      await notifyUsers([task.assignee_id], {
        title: `Задача със срок днес: ${task.title}`,
        body: `Задачата трябва да бъде приключена днес (${formatDate(task.due_date!)}).`,
        kind: "deadline",
        link,
      });
      result.dueToday += 1;
    }
  }

  await audit({
    action: "cron.reminders",
    entity: "system",
    meta: result,
  });

  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
