import "server-only";

import {
  fbCount,
  fbDelete,
  fbGet,
  fbInsert,
  fbList,
  fbUpdate,
  isFirebaseConfigured,
} from "@/lib/db/firebase";
import {
  localCount,
  localDelete,
  localGet,
  localInsert,
  localList,
  localUpdate,
} from "@/lib/db/local";
import { ensureFirebaseSeed } from "@/lib/db/seed-firebase";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/db/supabase";

export type TableName =
  | "users"
  | "profiles"
  | "roles"
  | "permissions"
  | "user_roles"
  | "job_posts"
  | "applications"
  | "candidate_documents"
  | "application_events"
  | "committees"
  | "committee_members"
  | "evaluation_criteria"
  | "evaluations"
  | "accreditation_cycles"
  | "criteria"
  | "evidence"
  | "institutional_reports"
  | "documents"
  | "document_versions"
  | "invoices"
  | "invoice_items"
  | "invoice_clients"
  | "tasks"
  | "notifications"
  | "audit_logs"
  | "system_settings";

export interface ListOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export type DataMode = "supabase" | "firebase" | "local";

/**
 * Ред на приоритетите:
 *   1. DATA_MODE=supabase|firebase|local — принудителен режим;
 *   2. Supabase (ако има URL + service ключ) — продукционният път с RLS;
 *   3. Firebase Realtime Database (ако има databaseURL);
 *   4. локален файлов store.
 */
export function dataMode(): DataMode {
  const forced = process.env.DATA_MODE;
  if (forced === "local") return "local";
  if (forced === "supabase") return isSupabaseConfigured() ? "supabase" : "local";
  if (forced === "firebase") return isFirebaseConfigured() ? "firebase" : "local";
  if (isSupabaseConfigured()) return "supabase";
  if (isFirebaseConfigured()) return "firebase";
  return "local";
}

/**
 * Връща режима и при Firebase гарантира, че базата е инициализирана.
 *
 * Ако първоначалното зареждане не успее (бавна връзка при студен старт),
 * страницата не бива да пада с 500 — логваме и продължаваме; следващата
 * заявка ще опита отново, защото `ensureFirebaseSeed` нулира обещанието си.
 */
async function ready(): Promise<DataMode> {
  const mode = dataMode();
  if (mode === "firebase") {
    try {
      await ensureFirebaseSeed();
    } catch (error) {
      console.error("[firebase] първоначалното зареждане не успя:", error);
    }
  }
  return mode;
}

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export async function listRows<T>(table: TableName, opts: ListOptions = {}): Promise<T[]> {
  const mode = await ready();
  if (mode === "supabase") {
    let query = supabaseAdmin().from(table).select("*");
    if (opts.where) {
      for (const [key, value] of Object.entries(opts.where)) {
        if (value === undefined) continue;
        if (value === null) query = query.is(key, null);
        else query = query.eq(key, value);
      }
    }
    query = query.order(opts.orderBy ?? "created_at", { ascending: opts.ascending ?? false });
    if (opts.limit) query = query.limit(opts.limit);
    const { data, error } = await query;
    if (error) fail(`Грешка при четене на ${table}`, error.message);
    return (data || []) as T[];
  }
  if (mode === "firebase") return (await fbList(table, opts)) as unknown as T[];
  return (await localList(table, opts)) as unknown as T[];
}

export async function getRow<T>(table: TableName, id: string): Promise<T | null> {
  const mode = await ready();
  if (mode === "supabase") {
    const { data, error } = await supabaseAdmin().from(table).select("*").eq("id", id).maybeSingle();
    if (error) fail(`Грешка при четене на ${table}`, error.message);
    return (data as T) || null;
  }
  if (mode === "firebase") return ((await fbGet(table, id)) as unknown as T) || null;
  return ((await localGet(table, id)) as unknown as T) || null;
}

export async function insertRow<T>(table: TableName, row: Record<string, unknown>): Promise<T> {
  const mode = await ready();
  if (mode === "supabase") {
    const { data, error } = await supabaseAdmin().from(table).insert(row).select("*").single();
    if (error) fail(`Грешка при запис в ${table}`, error.message);
    return data as T;
  }
  if (mode === "firebase") return (await fbInsert(table, row)) as unknown as T;
  return (await localInsert(table, row)) as unknown as T;
}

export async function updateRow<T>(
  table: TableName,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const mode = await ready();
  if (mode === "supabase") {
    const { data, error } = await supabaseAdmin()
      .from(table)
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail(`Грешка при обновяване на ${table}`, error.message);
    return data as T;
  }
  if (mode === "firebase") return (await fbUpdate(table, id, patch)) as unknown as T;
  return (await localUpdate(table, id, patch)) as unknown as T;
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  const mode = await ready();
  if (mode === "supabase") {
    const { error } = await supabaseAdmin().from(table).delete().eq("id", id);
    if (error) fail(`Грешка при изтриване от ${table}`, error.message);
    return;
  }
  if (mode === "firebase") {
    await fbDelete(table, id);
    return;
  }
  await localDelete(table, id);
}

export async function countRows(table: TableName, where?: Record<string, unknown>): Promise<number> {
  const mode = await ready();
  if (mode === "supabase") {
    let query = supabaseAdmin().from(table).select("*", { count: "exact", head: true });
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        if (value === undefined) continue;
        if (value === null) query = query.is(key, null);
        else query = query.eq(key, value);
      }
    }
    const { count, error } = await query;
    if (error) fail(`Грешка при броене в ${table}`, error.message);
    return count || 0;
  }
  if (mode === "firebase") return fbCount(table, where);
  return localCount(table, where);
}

/** Чете настройките като обект key → value. */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await listRows<{ key: string; value: string }>("system_settings", {
    orderBy: "key",
    ascending: true,
  });
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function setSetting(key: string, value: string): Promise<void> {
  const mode = await ready();
  if (mode === "supabase") {
    const { error } = await supabaseAdmin()
      .from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) fail("Грешка при запис на настройка", error.message);
    return;
  }
  const existing = await listRows<{ id: string }>("system_settings", { where: { key }, limit: 1 });
  if (existing.length) await updateRow("system_settings", existing[0].id, { value });
  else await insertRow("system_settings", { id: key, key, value });
}
