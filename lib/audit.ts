import "server-only";

import { insertRow } from "@/lib/db";
import type { AuditLogRow, SessionUser } from "@/lib/types";

interface AuditInput {
  actor?: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/** Записва административно действие в одиторския журнал. Не хвърля при грешка. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await insertRow<AuditLogRow>("audit_logs", {
      actor_id: input.actor?.id ?? null,
      actor_name: input.actor?.full_name ?? "Система",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      meta: input.meta ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (error) {
    console.error("[audit] неуспешен запис", error);
  }
}
