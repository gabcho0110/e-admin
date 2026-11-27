"use server";

import { revalidatePath } from "next/cache";

import { backWithError } from "@/lib/actions/helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { listRows, updateRow } from "@/lib/db";
import type { NotificationRow } from "@/lib/types";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const rows = await listRows<NotificationRow>("notifications", {
    where: { user_id: user.id, is_read: false },
  });
  for (const row of rows) {
    await updateRow<NotificationRow>("notifications", row.id, { is_read: true });
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const id = String(formData.get("id") || "");
  if (!id) return;

  await updateRow<NotificationRow>("notifications", id, { is_read: true });
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
