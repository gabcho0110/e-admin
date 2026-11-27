#!/usr/bin/env node
/**
 * Създаване на първи (или допълнителен) административен профил.
 *
 *   npm run create-admin -- --email=director@pig-ohridski.bg --password='СилнаПарола1' \
 *                          --name='Радослав Якимов' --role=director
 *
 * Поддържани роли: superadmin, director, deputy_director, accreditation_expert,
 * hr_expert, committee_chair, committee_member, ict_officer, teacher.
 *
 * Работи в два режима:
 *  • Supabase (когато NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY са налични) —
 *    създава потребител в Supabase Auth и запис в public.users / public.user_roles.
 *  • Локален файлов store — записва в .data/db.json (файлът трябва да съществува;
 *    създава се автоматично при първото стартиране на `npm run dev`).
 */

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DB_FILE = path.join(process.env.LOCAL_DATA_DIR || path.join(ROOT, ".data"), "db.json");
const VALID_ROLES = [
  "superadmin",
  "director",
  "deputy_director",
  "accreditation_expert",
  "hr_expert",
  "committee_chair",
  "committee_member",
  "ict_officer",
  "teacher",
];

/* ─────────────────────────── помощни ─────────────────────────── */

function loadEnvFile(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return; // липсващ файл — игнорираме
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {};
  for (const item of argv.slice(2)) {
    if (!item.startsWith("--")) continue;
    const eq = item.indexOf("=");
    if (eq === -1) args[item.slice(2)] = "true";
    else args[item.slice(2, eq)] = item.slice(eq + 1);
  }
  return args;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16384 }).toString("hex");
  return `scrypt$16384$${salt}$${hash}`;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function ok(message) {
  console.log(`✔ ${message}`);
}

/* ─────────────────────────── локален режим ─────────────────────────── */

async function createLocal({ email, password, name, position, role }) {
  let raw;
  try {
    raw = await fs.readFile(DB_FILE, "utf8");
  } catch {
    fail(
      `Файлът ${DB_FILE} не съществува.\n` +
        "  Стартирайте приложението веднъж (`npm run dev`), за да се създаде локалната база,\n" +
        "  след което пуснете скрипта отново.",
    );
  }

  const store = JSON.parse(raw);
  store.users ||= [];
  store.user_roles ||= [];

  const existing = store.users.find((u) => String(u.email).toLowerCase() === email);
  const now = new Date().toISOString();

  let userId;
  if (existing) {
    userId = existing.id;
    existing.password_hash = hashPassword(password);
    existing.is_active = true;
    existing.is_protected = true;
    existing.failed_attempts = 0;
    existing.locked_until = null;
    existing.updated_at = now;
    if (name) existing.full_name = name;
    if (position) existing.position = position;
    ok(`Профилът ${email} вече съществуваше — паролата и данните са обновени.`);
  } else {
    userId = randomUUID();
    store.users.push({
      id: userId,
      email,
      password_hash: hashPassword(password),
      full_name: name,
      position,
      phone: null,
      is_active: true,
      is_protected: true,
      totp_secret: null,
      totp_enabled: false,
      last_login_at: null,
      failed_attempts: 0,
      locked_until: null,
      created_at: now,
      updated_at: now,
    });
    ok(`Създаден е профил ${email}.`);
  }

  const hasRole = store.user_roles.some((r) => r.user_id === userId && r.role_key === role);
  if (!hasRole) {
    store.user_roles.push({
      id: randomUUID(),
      user_id: userId,
      role_key: role,
      created_at: now,
    });
  }
  ok(`Роля: ${role}`);

  await fs.writeFile(DB_FILE, JSON.stringify(store, null, 2), "utf8");
  ok(`Записът е в ${DB_FILE}`);
  console.log(`\nВлезте на /login с ${email}.\n`);
}

/* ─────────────────────────── Supabase режим ─────────────────────────── */

async function createSupabase({ email, password, name, position, role }) {
  const { createClient } = await import("@supabase/supabase-js");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail("Липсват NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();

  // 1. Намираме или създаваме потребител в Supabase Auth.
  let userId = null;
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) fail(`Supabase Auth: ${listError.message}`);
  const found = list?.users?.find((u) => (u.email || "").toLowerCase() === email);

  if (found) {
    userId = found.id;
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) fail(`Обновяване на паролата: ${error.message}`);
    ok(`Потребителят ${email} вече съществува в Supabase Auth — паролата е обновена.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !data.user) fail(`Създаване в Supabase Auth: ${error?.message ?? "неизвестна грешка"}`);
    userId = data.user.id;
    ok(`Създаден е потребител ${email} в Supabase Auth.`);
  }

  // 2. Запис в public.users (upsert по id).
  const { error: userError } = await admin.from("users").upsert(
    {
      id: userId,
      email,
      password_hash: null, // паролата се проверява от Supabase Auth
      full_name: name,
      position,
      is_active: true,
      is_protected: true,
      failed_attempts: 0,
      locked_until: null,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (userError) fail(`Запис в public.users: ${userError.message}`);
  ok("Профилът е записан в public.users.");

  // 3. Роля — изтриваме стари и записваме избраната (един профил = една основна роля).
  const { error: delError } = await admin.from("user_roles").delete().eq("user_id", userId);
  if (delError) fail(`Изчистване на ролите: ${delError.message}`);

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role_key: role });
  if (roleError) fail(`Запис на роля: ${roleError.message}`);
  ok(`Роля: ${role}`);

  // 4. Профил (по избор) — не е задължителен за вход.
  await admin.from("profiles").upsert(
    { user_id: userId, position, department: null, updated_at: now },
    { onConflict: "user_id" },
  );

  console.log(`\nВлезте на /login с ${email}. При първи вход задайте 2FA от Настройки → Сигурност.\n`);
}

/* ─────────────────────────── старт ─────────────────────────── */

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const args = parseArgs(process.argv);

const email = (args.email || process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
const password = args.password || process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
const name = args.name || "Системен администратор";
const position = args.position || (args.role === "director" ? "Директор" : "Суперадминистратор");
const role = args.role || "superadmin";

if (!email) fail("Липсва --email. Пример: npm run create-admin -- --email=admin@pig-ohridski.bg");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Невалиден имейл адрес.");
if (!password || password.length < 8) fail("Паролата е задължителна и трябва да е поне 8 знака.");
if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
  fail("Паролата трябва да съдържа поне една буква и една цифра.");
}
if (!VALID_ROLES.includes(role)) fail(`Невалидна роля „${role}“. Позволени: ${VALID_ROLES.join(", ")}.`);

const useSupabase =
  process.env.DATA_MODE !== "local" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log(`\nPIG e-ADMIN · създаване на административен профил (${useSupabase ? "Supabase" : "локален режим"})\n`);

if (useSupabase) await createSupabase({ email, password, name, position, role });
else await createLocal({ email, password, name, position, role });
