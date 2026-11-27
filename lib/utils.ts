import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { bg } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "d MMMM yyyy", { locale: bg }) : "—";
}

export function formatDateShort(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "dd.MM.yyyy", { locale: bg }) : "—";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "d MMMM yyyy, HH:mm", { locale: bg }) : "—";
}

export function fromNow(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return formatDistanceToNowStrict(date, { locale: bg, addSuffix: true });
}

export function daysUntil(value: string | Date | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = (bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1).replace(/\.0$/, "");
  return `${value} ${units[i]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function percent(part: number, total: number): number {
  if (!total || !Number.isFinite(part) || !Number.isFinite(total)) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function truncate(text: string, length = 120): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function pluralBg(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
