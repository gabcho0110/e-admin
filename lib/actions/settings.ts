"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { generateTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { getRow, setSetting, updateRow } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/supabase";
import type { UserRow } from "@/lib/types";

const BASE = "/dashboard/settings";
const SECURITY = "/dashboard/settings/security";

const ALLOWED_KEYS = [
  "institution_name",
  "institution_director",
  "institution_director_role",
  "institution_ict",
  "institution_ict_role",
  "institution_motto",
  "institution_address",
  "institution_email",
  "application_prefix",
  "retention_months",
  // Фактуриране
  "invoice_supplier_name",
  "invoice_supplier_eik",
  "invoice_supplier_vat",
  "invoice_supplier_address",
  "invoice_supplier_iban",
  "invoice_supplier_bank",
  "invoice_supplier_mol",
  "invoice_currency",
  "invoice_vat_rate",
  "invoice_due_days",
  "invoice_footer_note",
];

export async function saveInstitutionSettingsAction(formData: FormData): Promise<void> {
  const user = await guard("settings.manage");

  for (const key of ALLOWED_KEYS) {
    if (!formData.has(key)) continue;
    await setSetting(key, text(formData, key));
  }

  // Страницата има няколко отделни формуляра (институция, фактуриране…).
  // Отметката за кандидатстване се променя САМО от формуляра на институцията —
  // иначе записът на данните за фактуриране би затворил регистрацията.
  if (text(formData, "scope") === "institution" || formData.has("registration_open")) {
    await setSetting("registration_open", formData.get("registration_open") === "on" ? "true" : "false");
  }

  await audit({ actor: user, action: "settings.updated", entity: "system_settings", meta: { keys: ALLOWED_KEYS } });
  revalidatePath(BASE);
  revalidatePath("/");
  backWithOk(BASE, "Настройките са запазени.");
}

export async function startTwoFactorAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const secret = generateTotpSecret();
  await updateRow<UserRow>("users", user.id, { totp_secret: secret, totp_enabled: false });

  await audit({ actor: user, action: "security.2fa_started", entity: "users", entityId: user.id });
  revalidatePath(SECURITY);
  backWithOk(SECURITY, "1");
}

export async function confirmTwoFactorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const code = text(formData, "code");
  const record = await getRow<UserRow>("users", user.id);
  if (!record?.totp_secret) backWithError(SECURITY, "Първо генерирайте тайна за приложението.");

  if (!verifyTotp(record.totp_secret, code)) {
    backWithError(SECURITY, "Кодът е невалиден или изтекъл. Опитайте с нов код.");
  }

  await updateRow<UserRow>("users", user.id, { totp_enabled: true });
  await audit({ actor: user, action: "security.2fa_enabled", entity: "users", entityId: user.id });
  revalidatePath(SECURITY);
  backWithOk(SECURITY, "Двуфакторната автентикация е включена.");
}

export async function disableTwoFactorAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const password = text(formData, "password");
  const record = await getRow<UserRow>("users", user.id);
  if (!record) backWithError(SECURITY, "Профилът не е намерен.");

  if (record.password_hash) {
    if (!verifyPassword(password, record.password_hash)) {
      backWithError(SECURITY, "Паролата е грешна.");
    }
  } else if (isSupabaseConfigured()) {
    const { createClient } = await import("@supabase/supabase-js");
    const verifier = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await verifier.auth.signInWithPassword({ email: record.email, password });
    if (error) backWithError(SECURITY, "Паролата е грешна.");
  }

  await updateRow<UserRow>("users", user.id, { totp_enabled: false, totp_secret: null });
  await audit({ actor: user, action: "security.2fa_disabled", entity: "users", entityId: user.id });
  revalidatePath(SECURITY);
  backWithOk(SECURITY, "Двуфакторната автентикация е изключена.");
}

export async function cancelTwoFactorSetupAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");
  await updateRow<UserRow>("users", user.id, { totp_secret: null, totp_enabled: false });
  revalidatePath(SECURITY);
  backWithOk(SECURITY, "Настройката е отменена.");
}
