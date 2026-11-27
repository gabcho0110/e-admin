"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearAttempts,
  isRateLimited,
  rateLimitRetryAfter,
  registerFailedAttempt,
} from "@/lib/auth/rate-limit";
import {
  clearPendingTwoFactor,
  createSession,
  destroySession,
  getCurrentUser,
  readPendingTwoFactor,
  requestMeta,
  setPendingTwoFactor,
} from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { getRow, insertRow, listRows, updateRow } from "@/lib/db";
import { isSupabaseConfigured, supabaseAdmin, verifySupabasePassword } from "@/lib/db/supabase";
import { ROLE_MAP } from "@/lib/permissions/roles";
import type { RoleKey, UserRoleRow, UserRow } from "@/lib/types";
import { fieldErrors, formValue, loginSchema, registerSchema, twoFactorSchema } from "@/lib/validation/schemas";

import type { AuthState } from "@/lib/actions/types";

const DUMMY_HASH =
  "scrypt$16384$00000000000000000000000000000000$" +
  "0".repeat(128);

async function findByEmail(email: string): Promise<UserRow | null> {
  const users = await listRows<UserRow>("users");
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function landingFor(user: UserRow, roles: RoleKey[]): string {
  if (roles.includes("candidate") && !roles.some((r) => r !== "candidate")) return "/track";
  return "/dashboard";
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), message: "Проверете въведените данни." };
  }

  const { email, password } = parsed.data;
  const { ip, userAgent } = await requestMeta();

  if (isRateLimited(email, ip)) {
    const wait = Math.ceil(rateLimitRetryAfter(email, ip) / 60);
    return {
      status: "error",
      message: `Твърде много неуспешни опити. Опитайте отново след ${wait || 1} мин.`,
    };
  }

  const user = await findByEmail(email);

  if (!user) {
    verifyPassword(password, DUMMY_HASH);
    registerFailedAttempt(email, ip);
    await audit({ action: "login.failed", entity: "users", meta: { email }, ip, userAgent });
    return { status: "error", message: "Невалиден имейл или парола." };
  }

  if (!user.is_active) {
    return { status: "error", message: "Профилът е деактивиран. Обърнете се към администратора." };
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { status: "error", message: "Профилът е временно блокиран след неуспешни опити." };
  }

  if (!verifyPassword(password, user.password_hash)) {
    // Профили, създадени през Supabase Auth, нямат локален scrypt хеш —
    // паролата се проверява от Supabase (anon клиент, само за тази проверка).
    const remoteOk =
      !user.password_hash && isSupabaseConfigured()
        ? await verifySupabasePassword(email, password)
        : false;

    if (!remoteOk) {
      registerFailedAttempt(email, ip);
      await updateRow<UserRow>("users", user.id, {
        failed_attempts: (user.failed_attempts || 0) + 1,
        locked_until:
          (user.failed_attempts || 0) + 1 >= 8
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : user.locked_until,
      });
      await audit({
        action: "login.failed",
        entity: "users",
        entityId: user.id,
        meta: { reason: "wrong_password" },
        ip,
        userAgent,
      });
      return { status: "error", message: "Невалиден имейл или парола." };
    }
  }

  clearAttempts(email, ip);

  if (user.totp_enabled && user.totp_secret) {
    await setPendingTwoFactor(user.id);
    return {
      status: "totp",
      message: "Въведете 6-цифрения код от приложението за автентикация.",
    };
  }

  await createSession(user.id);
  await updateRow<UserRow>("users", user.id, {
    last_login_at: new Date().toISOString(),
    failed_attempts: 0,
    locked_until: null,
  });

  const roleRows = await listRows<UserRoleRow>("user_roles", { where: { user_id: user.id } });
  const roles = roleRows.map((r) => r.role_key).filter((key) => ROLE_MAP[key]);

  await audit({ action: "login.success", entity: "users", entityId: user.id, ip, userAgent });

  return { status: "success", redirectTo: landingFor(user, roles) };
}

export async function verifyTwoFactorAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = twoFactorSchema.safeParse({ code: formValue(formData, "code") });
  if (!parsed.success) {
    return { status: "totp", fieldErrors: fieldErrors(parsed.error), message: "Въведете валиден код." };
  }

  const userId = await readPendingTwoFactor();
  if (!userId) {
    return { status: "error", message: "Сесията за потвърждение изтече. Влезте отново." };
  }

  const user = await getRow<UserRow>("users", userId);
  if (!user || !user.totp_secret) {
    return { status: "error", message: "Двуфакторната автентикация не е конфигурирана." };
  }

  const { ip, userAgent } = await requestMeta();
  if (!verifyTotp(user.totp_secret, parsed.data.code)) {
    await audit({
      action: "login.2fa_failed",
      entity: "users",
      entityId: user.id,
      ip,
      userAgent,
    });
    return { status: "totp", message: "Невалиден код. Опитайте отново." };
  }

  await clearPendingTwoFactor();
  await createSession(user.id);
  await updateRow<UserRow>("users", user.id, {
    last_login_at: new Date().toISOString(),
    failed_attempts: 0,
    locked_until: null,
  });
  await audit({ action: "login.2fa_success", entity: "users", entityId: user.id, ip, userAgent });

  const roleRows = await listRows<UserRoleRow>("user_roles", { where: { user_id: user.id } });
  const roles = roleRows.map((r) => r.role_key).filter((key) => ROLE_MAP[key]);
  return { status: "success", redirectTo: landingFor(user, roles) };
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) {
    await audit({ actor: user, action: "logout", entity: "users", entityId: user.id });
  }
  redirect("/login");
}

export async function registerCandidateAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    full_name: formValue(formData, "full_name"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    password: formValue(formData, "password"),
    password_confirm: formValue(formData, "password_confirm"),
    consent: formValue(formData, "consent"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), message: "Проверете въведените данни." };
  }

  const data = parsed.data;
  const existing = await findByEmail(data.email);
  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: "Вече съществува профил с този имейл" },
      message: "Вече съществува профил с този имейл.",
    };
  }

  let userId: string | undefined;

  if (isSupabaseConfigured()) {
    const { data: created, error } = await supabaseAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      return { status: "error", message: `Регистрацията не успя: ${error?.message ?? "неизвестна грешка"}` };
    }
    userId = created.user.id;
  }

  const user = await insertRow<UserRow>("users", {
    ...(userId ? { id: userId } : {}),
    email: data.email,
    password_hash: isSupabaseConfigured() ? null : hashPassword(data.password),
    full_name: data.full_name,
    position: null,
    phone: data.phone || null,
    is_active: true,
    totp_enabled: false,
    totp_secret: null,
    last_login_at: new Date().toISOString(),
  });

  await insertRow<UserRoleRow>("user_roles", { user_id: user.id, role_key: "candidate" });
  await createSession(user.id);

  const { ip, userAgent } = await requestMeta();
  await audit({ action: "candidate.registered", entity: "users", entityId: user.id, ip, userAgent });

  return { status: "success", redirectTo: "/track" };
}
