import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck, Inbox } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { NOTIFICATION_KIND } from "@/lib/labels";
import type { NotificationRow } from "@/lib/types";
import { fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Известия" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requirePermission("notifications.view");
  const sp = await searchParams;

  const notifications = await listRows<NotificationRow>("notifications", {
    where: { user_id: user.id },
    orderBy: "created_at",
  });

  const unread = notifications.filter((n) => !n.is_read);
  const filter = sp.filter === "unread" ? "unread" : "all";
  const visible = filter === "unread" ? unread : notifications;

  return (
    <div>
      <PageHeader
        title="Известия"
        subtitle="Автоматични съобщения при нови кандидатури, задачи, срокове и одобрения."
        actions={
          unread.length > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="outline" size="sm" pendingText="…">
                <CheckCheck size={14} /> Маркирай всички като прочетени
              </SubmitButton>
            </form>
          ) : null
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/dashboard/notifications"
          className={`rounded-full border px-3 py-1.5 text-[12px] ${
            filter === "all" ? "border-navy-700 bg-navy-700 text-white" : "border-hairline bg-panel text-muted"
          }`}
        >
          Всички ({notifications.length})
        </Link>
        <Link
          href="/dashboard/notifications?filter=unread"
          className={`rounded-full border px-3 py-1.5 text-[12px] ${
            filter === "unread" ? "border-navy-700 bg-navy-700 text-white" : "border-hairline bg-panel text-muted"
          }`}
        >
          Непрочетени ({unread.length})
        </Link>
      </div>

      <Card>
        <CardHeader title="Съобщения" description={`${visible.length} записа`} icon={Bell} />
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title={filter === "unread" ? "Няма непрочетени известия" : "Няма известия"}
                description="Когато получите нова задача, кандидатура или документ за одобрение, съобщението ще се появи тук."
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {visible.map((notification) => (
                <li
                  key={notification.id}
                  className={`flex flex-wrap items-start gap-3 px-5 py-3.5 ${
                    notification.is_read ? "" : "bg-gold/[0.04]"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.is_read ? "bg-hairline" : "bg-gold"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{notification.title}</span>
                      <Badge tone={NOTIFICATION_KIND[notification.kind]}>
                        {notification.kind === "deadline"
                          ? "срок"
                          : notification.kind === "warning"
                            ? "внимание"
                            : notification.kind === "success"
                              ? "успех"
                              : "инфо"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-5 text-muted">{notification.body}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10.5px] text-muted">
                      <span>{fromNow(notification.created_at)}</span>
                      {notification.email_status ? (
                        <span>
                          имейл:{" "}
                          {notification.email_status === "sent"
                            ? "изпратен"
                            : notification.email_status === "skipped"
                              ? "не е конфигуриран"
                              : "неуспешен"}
                        </span>
                      ) : null}
                      {notification.link ? (
                        <Link href={notification.link} className="font-medium text-navy-600 hover:underline dark:text-gold-300">
                          Отвори →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {!notification.is_read ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <SubmitButton variant="ghost" size="sm" pendingText="…">
                        Прочетено
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
