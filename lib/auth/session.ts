import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { signPayload, verifyPayload } from "@/lib/auth/password";
import { listRows, getRow, updateRow } from "@/lib/db";
import { ROLE_MAP } from "@/lib/permissions/roles";
import type { Permission, RoleKey, SessionUser, UserRoleRow, UserRow } from "@/lib/types";

const SESSION_COOKIE = "pig_session";
const TWOFA_COOKIE = "pig_2fa";
const SESSION_TTL = 60 * 60 * 8; // 8 часа

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Само за локална разработка — в продукция AUTH_SECRET е задължителен.
  return "pig-e-admin-development-secret-change-me";
}

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  const token = signPayload({ uid: userId }, authSecret(), SESSION_TTL);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(TWOFA_COOKIE);
}

export async function setPendingTwoFactor(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(TWOFA_COOKIE, signPayload({ uid: userId }, authSecret(), 300), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
}

export async function readPendingTwoFactor(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(TWOFA_COOKIE)?.value;
  const payload = verifyPayload<{ uid?: string }>(token, authSecret());
  return payload?.uid || null;
}

export async function clearPendingTwoFactor(): Promise<void> {
  const jar = await cookies();
  jar.delete(TWOFA_COOKIE);
}

/** Текущ потребител с роли и права. Кешира се за рамките на един request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const payload = verifyPayload<{ uid?: string }>(token, authSecret());
  if (!payload?.uid) return null;

  const user = await getRow<UserRow>("users", payload.uid);
  if (!user || !user.is_active) return null;

  const roleRows = await listRows<UserRoleRow>("user_roles", { where: { user_id: user.id } });
  const roles = roleRows.map((r) => r.role_key).filter((key): key is RoleKey => Boolean(ROLE_MAP[key]));
  const permissions = Array.from(
    new Set(roles.flatMap((role) => ROLE_MAP[role]?.permissions ?? [])),
  ) as Permission[];

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    position: user.position,
    phone: user.phone,
    roles,
    permissions,
    totp_enabled: Boolean(user.totp_enabled),
    is_active: user.is_active,
  };
});

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

export function isStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.roles.some((role) => role !== "candidate");
}

export function isCandidate(user: SessionUser | null): boolean {
  return Boolean(user && user.roles.includes("candidate") && !isStaff(user));
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Изисква право; при липса връща към таблото с ясно съобщение. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (isCandidate(user)) redirect("/track");
  if (!hasPermission(user, permission)) redirect(`/dashboard?denied=${permission}`);
  return user;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await updateRow<UserRow>("users", userId, { last_login_at: new Date().toISOString() });
}

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip")) || "неизвестен",
    userAgent: h.get("user-agent") || "неизвестен",
  };
}
