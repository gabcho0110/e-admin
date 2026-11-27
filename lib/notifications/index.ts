import "server-only";

import { insertRow, listRows } from "@/lib/db";
import { sendEmail, emailLayout } from "@/lib/notifications/email";
import type { NotificationKind, NotificationRow, UserRow } from "@/lib/types";

interface NotifyInput {
  title: string;
  body: string;
  kind?: NotificationKind;
  link?: string | null;
  /** Ако е true, се изпраща и имейл (изисква RESEND_API_KEY). */
  email?: boolean;
}

/** Създава известие за всеки от посочените потребители. */
export async function notifyUsers(userIds: string[], input: NotifyInput): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;

  let recipients: UserRow[] = [];
  if (input.email) {
    recipients = await listRows<UserRow>("users");
  }

  for (const userId of unique) {
    let emailStatus: NotificationRow["email_status"] = null;
    if (input.email) {
      const user = recipients.find((u) => u.id === userId);
      if (user) {
        emailStatus = await sendEmail({
          to: user.email,
          subject: input.title,
          html: emailLayout(
            input.title,
            `<p>${input.body.replace(/\n/g, "</p><p>")}</p>${
              input.link
                ? `<p style="margin-top:18px"><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${input.link}" style="background:#17365D;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Отвори в системата</a></p>`
                : ""
            }`,
          ),
        });
      } else {
        emailStatus = "skipped";
      }
    }

    await insertRow<NotificationRow>("notifications", {
      user_id: userId,
      title: input.title,
      body: input.body,
      kind: input.kind ?? "info",
      link: input.link ?? null,
      is_read: false,
      email_status: emailStatus,
    });
  }
}

/** Известие до всички активни служители с дадена роля. */
export async function notifyRole(roleKey: string, input: NotifyInput): Promise<void> {
  const roleRows = await listRows<{ user_id: string }>("user_roles", { where: { role_key: roleKey } });
  await notifyUsers(roleRows.map((r) => r.user_id), input);
}
