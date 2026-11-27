"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, optional, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteRow, getRow, insertRow, listRows, updateRow } from "@/lib/db";
import { isSupabaseConfigured, supabaseAdmin, verifySupabasePassword } from "@/lib/db/supabase";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import { notifyUsers } from "@/lib/notifications";
import type {
  CommitteeMemberRow,
  EvaluationRow,
  NotificationRow,
  ProfileRow,
  RoleKey,
  UserRoleRow,
  UserRow,
} from "@/lib/types";
import { fieldErrors, staffSchema } from "@/lib/validation/schemas";

const BASE = "/dashboard/staff";

/** Защитените профили (суперадминистраторите) не се изтриват, деактивират или понижават. */
function assertNotProtected(target: UserRow, action: string): void {
  if (!target.is_protected) return;
  backWithError(
    BASE,
    `Профилът на ${target.full_name} е защитен и не може да бъде ${action}.`,
  );
}

/** Последният активен суперадминистратор не бива да остава без права. */
async function isLastSuperadmin(userId: string): Promise<boolean> {
  const roles = await listRows<UserRoleRow>("user_roles", { where: { role_key: "superadmin" } });
  if (roles.length > 1) return false;
  return roles.length === 1 && roles[0].user_id === userId;
}

export async function createStaffAction(formData: FormData): Promise<void> {
  const admin = await guard("staff.manage");
  const parsed = staffSchema.safeParse({
    full_name: text(formData, "full_name"),
    email: text(formData, "email"),
    position: text(formData, "position"),
    phone: text(formData, "phone"),
    role_keys: formData.getAll("role_key").map(String),
    password: text(formData, "password"),
  });
  if (!parsed.success) backWithError(BASE, Object.values(fieldErrors(parsed.error))[0]);

  const data = parsed.data;
  const roleKeys = Array.from(new Set(data.role_keys)) as RoleKey[];
  const existing = await listRows<UserRow>("users");
  if (existing.some((u) => u.email.toLowerCase() === data.email)) {
    backWithError(BASE, "Вече съществува профил с този имейл.");
  }

  if (roleKeys.includes("superadmin") && !admin.roles.includes("superadmin")) {
    backWithError(BASE, "Само суперадминистратор може да създава суперадминистратори.");
  }

  let userId: string | undefined;
  if (isSupabaseConfigured()) {
    const { data: created, error } = await supabaseAdmin().auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) backWithError(BASE, `Профилът не можа да бъде създаден: ${error?.message ?? ""}`);
    userId = created.user.id;
  }

  const user = await insertRow<UserRow>("users", {
    ...(userId ? { id: userId } : {}),
    email: data.email,
    password_hash: isSupabaseConfigured() ? null : hashPassword(data.password),
    full_name: data.full_name,
    position: data.position,
    phone: data.phone || null,
    is_active: true,
    // Суперадминистраторските профили се заключват — не могат да бъдат
    // изтрити, деактивирани или понижени от друг администратор.
    is_protected: roleKeys.includes("superadmin"),
    totp_enabled: false,
    totp_secret: null,
  });

  const parts = data.full_name.split(/\s+/);
  await insertRow<ProfileRow>("profiles", {
    user_id: user.id,
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(" ") || null,
    department: null,
    employment_type: null,
    hired_at: new Date().toISOString().slice(0, 10),
    notes: null,
  });

  for (const roleKey of roleKeys) {
    await insertRow<UserRoleRow>("user_roles", { user_id: user.id, role_key: roleKey });
  }

  await notifyUsers([user.id], {
    title: "Създаден е служебен профил",
    body: `Имате профил в PIG e-ADMIN с роля(и) ${roleKeys
      .map((key) => `„${ROLE_LABELS[key]}“`)
      .join(", ")}. При първи вход сменете паролата си.`,
    kind: "info",
    link: "/dashboard/settings/profile",
  });

  await audit({
    actor: admin,
    action: "staff.created",
    entity: "users",
    entityId: user.id,
    meta: { roles: roleKeys, email: data.email },
  });

  revalidatePath(BASE);
  backWithOk(BASE, `Профилът на ${data.full_name} е създаден.`);
}

/**
 * Задава целия набор от роли на служител (една или няколко).
 *
 * Правата са обединение на всички роли, затова човек може да е едновременно
 * например „зам.-директор“ и „председател на комисия“. Проверките пазят
 * последния суперадминистратор и защитените профили.
 */
export async function setStaffRolesAction(formData: FormData): Promise<void> {
  const admin = await guard("staff.manage");
  const userId = text(formData, "user_id");
  // Връщаме се на страницата на профила, за да види администраторът резултата.
  const back = userId ? `${BASE}/${userId}` : BASE;
  const roleKeys = Array.from(new Set(formData.getAll("role_key").map(String))) as RoleKey[];

  if (userId === admin.id) {
    backWithError(back, "Не можете да променяте собствените си роли.");
  }
  if (roleKeys.length === 0) {
    backWithError(back, "Изберете поне една роля.");
  }
  if (roleKeys.some((role) => !ROLE_LABELS[role] || role === "candidate")) {
    backWithError(back, "Невалидна роля.");
  }
  if (roleKeys.includes("superadmin") && !admin.roles.includes("superadmin")) {
    backWithError(back, "Само суперадминистратор може да дава тази роля.");
  }

  const target = await getRow<UserRow>("users", userId);
  if (!target) backWithError(BASE, "Профилът не е намерен.");
  assertNotProtected(target, "преместен в други роли");

  const current = await listRows<UserRoleRow>("user_roles", { where: { user_id: userId } });
  const losesSuperadmin =
    current.some((row) => row.role_key === "superadmin") && !roleKeys.includes("superadmin");
  if (losesSuperadmin && (await isLastSuperadmin(userId))) {
    backWithError(back, "Това е единственият суперадминистратор — първо създайте втори.");
  }

  for (const row of current) {
    await deleteRow("user_roles", row.id);
  }
  for (const roleKey of roleKeys) {
    await insertRow<UserRoleRow>("user_roles", { user_id: userId, role_key: roleKey });
  }

  await notifyUsers([userId], {
    title: "Промяна на роли",
    body: `Ролите ви в системата са: ${roleKeys
      .map((key) => `„${ROLE_LABELS[key]}“`)
      .join(", ")}.`,
    kind: "warning",
    link: "/dashboard",
  });

  await audit({
    actor: admin,
    action: "staff.roles_changed",
    entity: "users",
    entityId: userId,
    meta: { roles: roleKeys },
  });

  revalidatePath(BASE);
  revalidatePath(back);
  backWithOk(back, "Ролите са обновени.");
}

export async function toggleStaffActiveAction(formData: FormData): Promise<void> {
  const admin = await guard("staff.manage");
  const userId = text(formData, "user_id");
  const back = userId ? `${BASE}/${userId}` : BASE;

  if (userId === admin.id) backWithError(back, "Не можете да деактивирате собствения си профил.");

  const user = await getRow<UserRow>("users", userId);
  if (!user) backWithError(BASE, "Профилът не е намерен.");
  assertNotProtected(user, "деактивиран");
  if (user.is_active && (await isLastSuperadmin(userId))) {
    backWithError(back, "Това е единственият суперадминистратор — първо създайте втори.");
  }

  await updateRow<UserRow>("users", userId, { is_active: !user.is_active });

  await audit({
    actor: admin,
    action: user.is_active ? "staff.deactivated" : "staff.activated",
    entity: "users",
    entityId: userId,
  });

  revalidatePath(BASE);
  revalidatePath(back);
  backWithOk(back, user.is_active ? "Профилът е деактивиран." : "Профилът е активиран.");
}

/**
 * Окончателно изтриване на служебен профил.
 *
 * Изтриването е необратимо, затова е обградено с проверки:
 *   – не може собствен профил;
 *   – не може защитен профил (собственик/суперадминистратор);
 *   – не може последният суперадминистратор;
 *   – не може профил с вписани оценки в комисия (пази протоколите).
 * Заедно с профила се махат ролята, членството в комисии, личните данни
 * и неговите известия. Одиторският журнал остава като история.
 */
export async function deleteStaffAction(formData: FormData): Promise<void> {
  const admin = await guard("staff.manage");
  const userId = text(formData, "user_id");

  if (!userId) backWithError(BASE, "Липсва профил за изтриване.");
  if (userId === admin.id) backWithError(BASE, "Не можете да изтриете собствения си профил.");

  const target = await getRow<UserRow>("users", userId);
  if (!target) backWithError(BASE, "Профилът не е намерен.");
  assertNotProtected(target, "изтрит");

  const targetRoles = await listRows<UserRoleRow>("user_roles", { where: { user_id: userId } });
  const isSuper = targetRoles.some((row) => row.role_key === "superadmin");
  if (isSuper) {
    if (!admin.roles.includes("superadmin")) {
      backWithError(BASE, "Само суперадминистратор може да изтрие суперадминистратор.");
    }
    if (await isLastSuperadmin(userId)) {
      backWithError(BASE, "Това е единственият суперадминистратор — първо създайте втори.");
    }
  }

  const evaluations = await listRows<EvaluationRow>("evaluations", { where: { member_id: userId } });
  if (evaluations.length > 0) {
    backWithError(
      BASE,
      `${target.full_name} има ${evaluations.length} вписани оценки в комисия. ` +
        "Профилът не може да бъде изтрит, докато те са част от протокол — премахнете го от комисията или приключете процедурата.",
    );
  }

  // Свързани записи, които нямат смисъл без профила.
  for (const row of targetRoles) await deleteRow("user_roles", row.id);

  const memberships = await listRows<CommitteeMemberRow>("committee_members", { where: { user_id: userId } });
  for (const row of memberships) await deleteRow("committee_members", row.id);

  const profiles = await listRows<ProfileRow>("profiles", { where: { user_id: userId } });
  for (const row of profiles) await deleteRow("profiles", row.id);

  const notes = await listRows<NotificationRow>("notifications", { where: { user_id: userId } });
  for (const row of notes) await deleteRow("notifications", row.id);

  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) backWithError(BASE, `Профилът не можа да бъде изтрит: ${error.message}`);
  }

  await deleteRow("users", userId);

  await audit({
    actor: admin,
    action: "staff.deleted",
    entity: "users",
    entityId: userId,
    meta: {
      email: target.email,
      full_name: target.full_name,
      roles: targetRoles.map((row) => row.role_key),
    },
  });

  revalidatePath(BASE);
  backWithOk(BASE, `Профилът на ${target.full_name} е изтрит.`);
}

export async function resetStaffPasswordAction(formData: FormData): Promise<void> {
  const admin = await guard("staff.manage");
  const userId = text(formData, "user_id");
  const password = text(formData, "password");
  const back = userId ? `${BASE}/${userId}` : BASE;

  if (password.length < 8) backWithError(back, "Временната парола е поне 8 знака.");
  if (userId === admin.id) backWithError(back, "Сменете собствената си парола от „Моят профил“.");

  const target = await getRow<UserRow>("users", userId);
  if (!target) backWithError(BASE, "Профилът не е намерен.");
  if (target.is_protected && !admin.roles.includes("superadmin")) {
    backWithError(back, "Паролата на защитен профил може да смени само суперадминистратор.");
  }

  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
    if (error) backWithError(back, `Паролата не можа да бъде сменена: ${error.message}`);
  } else {
    await updateRow<UserRow>("users", userId, {
      password_hash: hashPassword(password),
      failed_attempts: 0,
      locked_until: null,
    });
  }

  await audit({ actor: admin, action: "staff.password_reset", entity: "users", entityId: userId });
  revalidatePath(BASE);
  backWithOk(back, "Временната парола е зададена.");
}

export async function updateOwnProfileAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const fullName = text(formData, "full_name");
  const phone = optional(formData, "phone");

  if (fullName.length < 3) backWithError("/dashboard/settings/profile", "Въведете име.");

  await updateRow<UserRow>("users", user.id, { full_name: fullName, phone });

  await audit({
    actor: user,
    action: "profile.updated",
    entity: "users",
    entityId: user.id,
  });

  revalidatePath("/dashboard/settings/profile");
  backWithOk("/dashboard/settings/profile", "Профилът е обновен.");
}

export async function changeOwnPasswordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) backWithError("/login", "Необходим е вход.");

  const current = text(formData, "current_password");
  const next = text(formData, "new_password");
  const confirm = text(formData, "confirm_password");

  if (next.length < 8) backWithError("/dashboard/settings/profile", "Новата парола е поне 8 знака.");
  if (next !== confirm) backWithError("/dashboard/settings/profile", "Паролите не съвпадат.");

  const record = await getRow<UserRow>("users", user.id);
  if (!record) backWithError("/dashboard/settings/profile", "Профилът не е намерен.");

  if (record.password_hash) {
    if (!verifyPassword(current, record.password_hash)) {
      backWithError("/dashboard/settings/profile", "Текущата парола е грешна.");
    }
  } else if (isSupabaseConfigured()) {
    const ok = await verifySupabasePassword(record.email, current);
    if (!ok) backWithError("/dashboard/settings/profile", "Текущата парола е грешна.");
  }

  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, { password: next });
    if (error) backWithError("/dashboard/settings/profile", error.message);
  } else {
    await updateRow<UserRow>("users", user.id, { password_hash: hashPassword(next) });
  }

  await audit({ actor: user, action: "profile.password_changed", entity: "users", entityId: user.id });
  revalidatePath("/dashboard/settings/profile");
  backWithOk("/dashboard/settings/profile", "Паролата е сменена.");
}
