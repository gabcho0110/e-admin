import type { Metadata } from "next";
import { History, ShieldCheck } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import type { AuditLogRow } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Одиторски журнал" };
export const dynamic = "force-dynamic";

const ACTION_TONE: Record<string, "success" | "danger" | "warning" | "info" | "neutral" | "gold"> = {
  "login.success": "success",
  "login.failed": "danger",
  "login.2fa_failed": "danger",
  "document.approved": "success",
  "document.returned": "warning",
  "application.submitted": "info",
  "staff.role_changed": "warning",
  "staff.deactivated": "danger",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  await requirePermission("audit.view");
  const sp = await searchParams;

  const logs = await listRows<AuditLogRow>("audit_logs", { orderBy: "created_at", limit: 200 });
  const entity = sp.entity || "";
  const filtered = entity ? logs.filter((log) => log.entity === entity) : logs;
  const entities = Array.from(new Set(logs.map((log) => log.entity)));

  return (
    <div>
      <PageHeader
        title="Одиторски журнал"
        subtitle="Неизменяем запис на административните действия — кой, какво, кога и откъде."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 py-2 text-[11.5px] text-muted">
            <ShieldCheck size={13} /> Само за четене
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/dashboard/settings/audit"
          className={`rounded-full border px-3 py-1.5 text-[12px] ${
            !entity ? "border-navy-700 bg-navy-700 text-white" : "border-hairline bg-panel text-muted"
          }`}
        >
          Всички ({logs.length})
        </a>
        {entities.map((name) => (
          <a
            key={name}
            href={`/dashboard/settings/audit?entity=${encodeURIComponent(name)}`}
            className={`rounded-full border px-3 py-1.5 text-[12px] ${
              entity === name ? "border-navy-700 bg-navy-700 text-white" : "border-hairline bg-panel text-muted"
            }`}
          >
            {name}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader title="Записи" description={`${filtered.length} от последните 200`} icon={History} />
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={History}
                title="Няма записи в журнала"
                description="Действията в системата се записват автоматично — вход, промени по кандидатури, документи, роли и настройки."
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Дата и час</th>
                    <th>Потребител</th>
                    <th>Действие</th>
                    <th>Обект</th>
                    <th>IP адрес</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-[11.5px] text-muted">{formatDateTime(log.created_at)}</td>
                      <td className="text-[12.5px]">{log.actor_name || "Система"}</td>
                      <td>
                        <Badge tone={ACTION_TONE[log.action] || "neutral"}>{log.action}</Badge>
                      </td>
                      <td className="text-[11.5px] text-muted">
                        {log.entity}
                        {log.entity_id ? (
                          <span className="ml-1 font-mono text-[10px] opacity-70">
                            {log.entity_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td className="font-mono text-[10.5px] text-muted">{log.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-[11.5px] text-muted">
        Журналът се съхранява съгласно политиката за сигурност и не се редактира от потребители.
        Препоръчително е периодично архивиране.
      </p>
    </div>
  );
}
