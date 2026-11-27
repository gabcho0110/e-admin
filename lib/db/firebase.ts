import "server-only";

import { newId } from "@/lib/auth/password";
import { firebaseDatabaseUrl } from "@/lib/firebase/config";
import type { Row } from "@/lib/db/local";

/**
 * Firebase Realtime Database адаптер.
 *
 * Работи през REST API на RTDB (без Admin SDK и без service account), защото
 * приложението няма сървърни ключове — само публичната web конфигурация.
 * Данните живеят в:
 *
 *   /tables/<table>/<id>   → ред от таблица (същата схема като Supabase)
 *   /_files/<key>/…        → прикачени файлове (виж lib/storage)
 *
 * Достъпът се определя от правилата на самата база. За продукция правилата
 * трябва да изискват автентикация; за демо режим могат да са отворени.
 */

const TABLES_ROOT = "tables";

const UPDATED_AT_TABLES = new Set([
  "users",
  "profiles",
  "job_posts",
  "applications",
  "committees",
  "accreditation_cycles",
  "criteria",
  "institutional_reports",
  "documents",
  "invoices",
  "invoice_clients",
  "tasks",
]);

export function isFirebaseConfigured(): boolean {
  if (process.env.DATA_MODE === "local") return false;
  return Boolean(firebaseDatabaseUrl());
}

function base(): string {
  const url = firebaseDatabaseUrl();
  if (!url) throw new Error("Firebase не е конфигуриран (липсва databaseURL).");
  return url;
}

/** Пътят се кодира сегмент по сегмент — ключовете съдържат „/“. */
function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${base()}/${encodePath(path)}.json`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch (error) {
    throw new Error(`Firebase: няма връзка с базата (${(error as Error).message}).`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Firebase ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

type Node = Record<string, Row> | null;

function toRows(node: Node): Row[] {
  if (!node) return [];
  return Object.entries(node)
    .filter(([, value]) => value && typeof value === "object")
    .map(([id, value]) => ({ ...(value as Row), id: (value as Row).id || id }));
}

function matches(row: Row, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (value === null) return row[key] === null || row[key] === undefined;
    return row[key] === value;
  });
}

function sortRows(rows: Row[], orderBy: string, ascending: boolean): Row[] {
  return rows.sort((a, b) => {
    const av = a[orderBy];
    const bv = b[orderBy];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = String(av).localeCompare(String(bv), "bg");
    return ascending ? cmp : -cmp;
  });
}

export async function fbList(
  table: string,
  opts: { where?: Record<string, unknown>; orderBy?: string; ascending?: boolean; limit?: number } = {},
): Promise<Row[]> {
  const node = await request<Node>(`${TABLES_ROOT}/${table}`);
  let rows = toRows(node).filter((row) => matches(row, opts.where));
  rows = sortRows(rows, opts.orderBy ?? "created_at", opts.ascending ?? false);
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function fbGet(table: string, id: string): Promise<Row | null> {
  const node = await request<Row | null>(`${TABLES_ROOT}/${table}/${id}`);
  if (!node) return null;
  return { ...node, id: node.id || id };
}

export async function fbInsert(table: string, row: Record<string, unknown>): Promise<Row> {
  const created = new Date().toISOString();
  const record = {
    ...row,
    id: (row.id as string) || newId(),
    created_at: (row.created_at as string) || created,
    ...(UPDATED_AT_TABLES.has(table) ? { updated_at: (row.updated_at as string) || created } : {}),
  } as Row;
  await request(`${TABLES_ROOT}/${table}/${record.id}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
  return record;
}

export async function fbUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Row> {
  const existing = await fbGet(table, id);
  if (!existing) throw new Error(`Записът не е намерен в ${table}`);
  const updated = {
    ...existing,
    ...patch,
    id,
    ...(UPDATED_AT_TABLES.has(table) ? { updated_at: new Date().toISOString() } : {}),
  } as Row;
  await request(`${TABLES_ROOT}/${table}/${id}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
  return updated;
}

export async function fbDelete(table: string, id: string): Promise<void> {
  await request(`${TABLES_ROOT}/${table}/${id}`, { method: "DELETE" });
}

export async function fbCount(table: string, where?: Record<string, unknown>): Promise<number> {
  const rows = await fbList(table, { where });
  return rows.length;
}

/** Достъп до произволен възел (използва се от файловото хранилище). */
export async function fbReadNode<T>(path: string): Promise<T | null> {
  return request<T | null>(path);
}

export async function fbWriteNode(path: string, value: unknown): Promise<void> {
  await request(path, { method: "PUT", body: JSON.stringify(value) });
}

export async function fbDeleteNode(path: string): Promise<void> {
  await request(path, { method: "DELETE" });
}

/** Проверка дали базата отговаря (използва се в „Настройки“). */
export async function firebasePing(): Promise<boolean> {
  try {
    await request<null>(`${TABLES_ROOT}/system_settings`);
    return true;
  } catch {
    return false;
  }
}
