import "server-only";

import { hashPassword, newId } from "@/lib/auth/password";
import { fbCount, fbGet, fbInsert, isFirebaseConfigured, fbList } from "@/lib/db/firebase";

/**
 * Първоначално зареждане на Firebase базата.
 *
 * RTDB стартира празна, затова при първия достъп се създават:
 *   – настройките на институцията (system_settings);
 *   – bootstrap администраторът (BOOTSTRAP_ADMIN_*);
 *   – защитеният суперадминистратор (PROTECTED_SUPERADMIN_*).
 *
 * Всички стъпки са идемпотентни и се изпълняват веднъж на процес.
 */

const DEFAULT_SETTINGS: Array<[string, string]> = [
  ["institution_name", "ПИГ „Св. Климент Охридски“"],
  ["institution_director", "Радослав Якимов"],
  ["institution_director_role", "Директор"],
  ["institution_ict", "Алекс Тодоров"],
  ["institution_ict_role", "Отговорник ИКТ"],
  ["institution_motto", "Една институция. Единна система. Пълен контрол."],
  ["institution_address", ""],
  ["institution_email", "info@pig-ohridski.bg"],
  ["application_prefix", "PIG"],
  ["retention_months", "60"],
  ["registration_open", "true"],
  // Фактуриране — данните на издателя се използват в печатните документи.
  ["invoice_supplier_name", "ПИГ „Св. Климент Охридски“"],
  ["invoice_supplier_eik", ""],
  ["invoice_supplier_vat", ""],
  ["invoice_supplier_address", ""],
  ["invoice_supplier_iban", ""],
  ["invoice_supplier_bank", ""],
  ["invoice_supplier_mol", "Радослав Якимов"],
  ["invoice_currency", "EUR"],
  ["invoice_vat_rate", "20"],
  ["invoice_due_days", "14"],
  ["invoice_footer_note", "Благодарим Ви, че работите с нас!"],
];

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  position: string;
  protectedProfile: boolean;
}

async function findByEmail(email: string): Promise<{ id: string } | null> {
  const rows = await fbList("users", { where: { email }, limit: 1 });
  if (rows.length) return { id: rows[0].id };
  const all = await fbList("users");
  const match = all.find((row) => String(row.email || "").toLowerCase() === email.toLowerCase());
  return match ? { id: match.id } : null;
}

async function ensureUser(user: SeedUser): Promise<void> {
  const existing = await findByEmail(user.email);
  if (existing) {
    const record = await fbGet("users", existing.id);
    if (record && (!record.is_protected || record.is_active === false)) {
      await fbInsert("users", { ...record, is_protected: true, is_active: true });
    }
    const roles = await fbList("user_roles", { where: { user_id: existing.id } });
    if (!roles.some((row) => row.role_key === "superadmin")) {
      await fbInsert("user_roles", { user_id: existing.id, role_key: "superadmin" });
    }
    return;
  }

  const created = new Date().toISOString();
  const id = newId();
  const parts = user.fullName.split(/\s+/);

  await fbInsert("users", {
    id,
    email: user.email.toLowerCase(),
    password_hash: hashPassword(user.password),
    full_name: user.fullName,
    position: user.position,
    phone: null,
    is_active: true,
    is_protected: user.protectedProfile,
    totp_secret: null,
    totp_enabled: false,
    last_login_at: null,
    failed_attempts: 0,
    locked_until: null,
  });
  await fbInsert("profiles", {
    user_id: id,
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(" ") || null,
    department: null,
    employment_type: null,
    hired_at: created.slice(0, 10),
    notes: null,
  });
  await fbInsert("user_roles", { user_id: id, role_key: "superadmin" });
}

async function ensureSettings(): Promise<void> {
  const count = await fbCount("system_settings");
  if (count > 0) return;
  for (const [key, value] of DEFAULT_SETTINGS) {
    await fbInsert("system_settings", { id: key, key, value });
  }
}

async function runSeed(): Promise<void> {
  if (!isFirebaseConfigured()) return;

  await ensureSettings();

  await ensureUser({
    email: (process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@pig-ohridski.bg").toLowerCase(),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin123!",
    fullName: "Системен администратор",
    position: "Суперадминистратор",
    protectedProfile: true,
  });

  await ensureUser({
    email: (process.env.PROTECTED_SUPERADMIN_EMAIL || "atodorov434@gmail.com").toLowerCase(),
    password: process.env.PROTECTED_SUPERADMIN_PASSWORD || "Aleks2010$",
    fullName: process.env.PROTECTED_SUPERADMIN_NAME || "Алекс Тодоров",
    position: process.env.PROTECTED_SUPERADMIN_POSITION || "ИКТ специалист",
    protectedProfile: true,
  });
}

let seedPromise: Promise<void> | null = null;

/** Извиква се от слоя за данни преди първата операция във Firebase режим. */
export function ensureFirebaseSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
