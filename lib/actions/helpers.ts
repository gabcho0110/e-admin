import "server-only";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";

/** Пренасочва обратно към страницата с ясно съобщение за грешка. */
export function backWithError(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(message)}`);
}

export function backWithOk(path: string, message = "1"): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

export async function guard(permission: Parameters<typeof requirePermission>[0]) {
  return requirePermission(permission);
}

/** Чете текстова стойност от FormData. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optional(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
