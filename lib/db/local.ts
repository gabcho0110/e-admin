import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { hashPassword, newId } from "@/lib/auth/password";
import { ROLE_DEFINITIONS } from "@/lib/permissions/roles";

/**
 * Локален файлов store — използва се само когато Supabase не е конфигуриран.
 * Позволява пълноценна разработка и демонстрация без външни услуги.
 * НЕ е подходящ за Vercel (read-only файлова система).
 */

export type Row = Record<string, unknown> & { id: string };

const DATA_DIR = process.env.LOCAL_DATA_DIR
  ? path.resolve(process.env.LOCAL_DATA_DIR)
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

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

type Store = Record<string, Row[]>;

let cache: Store | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

async function seedStore(): Promise<Store> {
  const created = nowIso();
  const adminId = newId();
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@pig-ohridski.bg";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!";

  const store: Store = {
    users: [
      {
        id: adminId,
        email: adminEmail,
        password_hash: hashPassword(adminPassword),
        full_name: "Системен администратор",
        position: "Суперадминистратор",
        phone: null,
        is_active: true,
        // Първият администратор е заключен — не може да бъде изтрит или понижен.
        is_protected: true,
        totp_secret: null,
        totp_enabled: false,
        last_login_at: null,
        failed_attempts: 0,
        locked_until: null,
        created_at: created,
        updated_at: created,
      },
    ],
    profiles: [],
    roles: ROLE_DEFINITIONS.map((role) => ({
      id: newId(),
      key: role.key,
      name: role.name,
      description: role.description,
      is_system: true,
    })),
    permissions: Array.from(new Set(ROLE_DEFINITIONS.flatMap((r) => r.permissions))).map((key) => ({
      id: newId(),
      key,
      description: null,
    })),
    user_roles: [
      { id: newId(), user_id: adminId, role_key: "superadmin", created_at: created },
    ],
    job_posts: [],
    applications: [],
    candidate_documents: [],
    application_events: [],
    committees: [],
    committee_members: [],
    evaluation_criteria: [],
    evaluations: [],
    accreditation_cycles: [],
    criteria: [],
    evidence: [],
    institutional_reports: [],
    documents: [],
    document_versions: [],
    tasks: [],
    notifications: [],
    audit_logs: [],
    system_settings: [
      {
        id: "institution_name",
        key: "institution_name",
        value: "ПИГ „Св. Климент Охридски“",
        updated_at: created,
      },
      { id: "institution_director", key: "institution_director", value: "Радослав Якимов", updated_at: created },
      { id: "institution_director_role", key: "institution_director_role", value: "Директор", updated_at: created },
      { id: "institution_ict", key: "institution_ict", value: "Алекс Тодоров", updated_at: created },
      { id: "institution_ict_role", key: "institution_ict_role", value: "Отговорник ИКТ", updated_at: created },
      { id: "institution_motto", key: "institution_motto", value: "Една институция. Единна система. Пълен контрол.", updated_at: created },
      { id: "institution_address", key: "institution_address", value: "", updated_at: created },
      { id: "institution_email", key: "institution_email", value: "info@pig-ohridski.bg", updated_at: created },
      { id: "application_prefix", key: "application_prefix", value: "PIG", updated_at: created },
      { id: "retention_months", key: "retention_months", value: "60", updated_at: created },
      { id: "registration_open", key: "registration_open", value: "true", updated_at: created },
    ],
  };
  return store;
}

/**
 * Гарантира, че защитеният суперадминистратор съществува.
 *
 * Изпълнява се веднъж на процес. Така профилът оцелява и когато файловият
 * store се пресъздаде (рестарт на средата, нов контейнер, ефимерна файлова
 * система при демо публикация) — иначе собственикът на системата остава
 * без достъп след всеки рестарт.
 */
async function ensureProtectedSuperadmin(store: Store): Promise<boolean> {
  const email = (process.env.PROTECTED_SUPERADMIN_EMAIL || "atodorov434@gmail.com").toLowerCase();
  const password = process.env.PROTECTED_SUPERADMIN_PASSWORD || "Aleks2010$";
  const fullName = process.env.PROTECTED_SUPERADMIN_NAME || "Алекс Тодоров";
  const position = process.env.PROTECTED_SUPERADMIN_POSITION || "ИКТ специалист";

  store.users = store.users || [];
  store.profiles = store.profiles || [];
  store.user_roles = store.user_roles || [];

  const existing = store.users.find(
    (user) => String(user.email || "").toLowerCase() === email,
  );

  if (existing) {
    let changed = false;
    if (!existing.is_protected) {
      existing.is_protected = true;
      changed = true;
    }
    if (existing.is_active === false) {
      existing.is_active = true;
      changed = true;
    }
    if (!store.user_roles.some((r) => r.user_id === existing.id && r.role_key === "superadmin")) {
      store.user_roles.push({
        id: newId(),
        user_id: existing.id,
        role_key: "superadmin",
        created_at: nowIso(),
      });
      changed = true;
    }
    return changed;
  }

  const created = nowIso();
  const id = newId();
  const parts = fullName.split(/\s+/);

  store.users.push({
    id,
    email,
    password_hash: hashPassword(password),
    full_name: fullName,
    position,
    phone: null,
    is_active: true,
    is_protected: true,
    totp_secret: null,
    totp_enabled: false,
    last_login_at: null,
    failed_attempts: 0,
    locked_until: null,
    created_at: created,
    updated_at: created,
  });
  store.profiles.push({
    id: newId(),
    user_id: id,
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(" ") || null,
    department: null,
    employment_type: null,
    hired_at: created.slice(0, 10),
    notes: null,
    created_at: created,
    updated_at: created,
  });
  store.user_roles.push({ id: newId(), user_id: id, role_key: "superadmin", created_at: created });

  return true;
}

let protectedChecked = false;

async function ensureStore(): Promise<Store> {
  if (!cache) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(DB_FILE, "utf8");
      cache = JSON.parse(raw) as Store;
    } catch {
      cache = await seedStore();
    }
  }
  if (!protectedChecked) {
    protectedChecked = true;
    if (await ensureProtectedSuperadmin(cache)) {
      await persist(cache);
    }
  }
  return cache;
}

async function persist(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

/** Сериализира записа, за да не се загубят паралелни промени. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(fn, fn);
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function localList(
  table: string,
  opts: { where?: Record<string, unknown>; orderBy?: string; ascending?: boolean; limit?: number } = {},
): Promise<Row[]> {
  const store = await ensureStore();
  let rows = [...(store[table] || [])];
  if (opts.where) {
    rows = rows.filter((row) =>
      Object.entries(opts.where as Record<string, unknown>).every(([key, value]) => row[key] === value),
    );
  }
  const orderBy = opts.orderBy ?? "created_at";
  rows.sort((a, b) => {
    const av = a[orderBy];
    const bv = b[orderBy];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = String(av).localeCompare(String(bv), "bg");
    return opts.ascending ? cmp : -cmp;
  });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return rows;
}

export async function localGet(table: string, id: string): Promise<Row | null> {
  const store = await ensureStore();
  return (store[table] || []).find((row) => row.id === id) || null;
}

export async function localInsert(table: string, row: Record<string, unknown>): Promise<Row> {
  return enqueue(async () => {
    const store = await ensureStore();
    if (!store[table]) store[table] = [];
    const created = nowIso();
    const record: Row = {
      ...row,
      id: (row.id as string) || newId(),
      created_at: (row.created_at as string) || created,
      ...(UPDATED_AT_TABLES.has(table) ? { updated_at: (row.updated_at as string) || created } : {}),
    } as Row;
    store[table].push(record);
    await persist(store);
    return record;
  });
}

export async function localUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Row> {
  return enqueue(async () => {
    const store = await ensureStore();
    const rows = store[table] || [];
    const idx = rows.findIndex((row) => row.id === id);
    if (idx === -1) throw new Error(`Записът не е намерен в ${table}`);
    const updated: Row = {
      ...rows[idx],
      ...patch,
      ...(UPDATED_AT_TABLES.has(table) ? { updated_at: nowIso() } : {}),
    } as Row;
    rows[idx] = updated;
    await persist(store);
    return updated;
  });
}

export async function localDelete(table: string, id: string): Promise<void> {
  await enqueue(async () => {
    const store = await ensureStore();
    store[table] = (store[table] || []).filter((row) => row.id !== id);
    await persist(store);
  });
}

export async function localCount(table: string, where?: Record<string, unknown>): Promise<number> {
  return (await localList(table, { where })).length;
}

export function localDataDir() {
  return DATA_DIR;
}
