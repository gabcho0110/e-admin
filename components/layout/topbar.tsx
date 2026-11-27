import { Bell, ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { ThemeToggle } from "@/components/ui/client";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { SessionUser } from "@/lib/types";
import { initials } from "@/lib/utils";

export function Topbar({
  user,
  unreadCount,
  label,
}: {
  user: SessionUser;
  unreadCount: number;
  label: React.ReactNode;
}) {
  // Ролите са множествени — показваме всички, за да не се губи информация.
  const roleLabel = user.roles.length
    ? user.roles.map((role) => ROLE_LABELS[role]).join(" · ")
    : "Потребител";

  return (
    <header className="sticky top-0 z-20 hidden items-center gap-4 border-b border-hairline bg-panel/85 px-6 py-3 backdrop-blur-md lg:flex">
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
          Административен панел
        </div>
        <div className="truncate font-display text-[15px] font-semibold">{label}</div>
      </div>

      <form action="/dashboard/search" className="relative ml-auto w-full max-w-[300px]">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          name="q"
          placeholder="Търсене в системата…"
          className="h-9 w-full rounded-lg border border-hairline bg-panel2 pl-9 pr-3 text-[13px] text-content placeholder:text-muted/80 focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-gold/20"
          aria-label="Търсене"
        />
      </form>

      <ThemeToggle />

      <Link
        href="/dashboard/notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-panel text-muted transition-colors hover:text-content"
        aria-label="Известия"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-navy-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Link>

      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg border border-transparent px-1.5 py-1 transition-colors hover:border-hairline [&::-webkit-details-marker]:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-700 text-[11px] font-semibold text-white ring-2 ring-gold/30">
            {initials(user.full_name)}
          </span>
          <span className="hidden min-w-0 xl:block">
            <span className="block truncate text-[12.5px] font-medium leading-tight">{user.full_name}</span>
            <span className="block truncate text-[10.5px] text-muted">{roleLabel}</span>
          </span>
          <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-hairline bg-panel shadow-lift">
          <div className="border-b border-hairline px-4 py-3">
            <div className="truncate text-[13px] font-medium">{user.full_name}</div>
            <div className="truncate text-[11.5px] text-muted">{user.email}</div>
          </div>
          <Link
            href="/dashboard/settings/profile"
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-content hover:bg-panel2"
          >
            <UserRound size={14} /> Моят профил
          </Link>
          {user.permissions.includes("settings.manage") ? (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-content hover:bg-panel2"
            >
              <Settings size={14} /> Настройки
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post" className="border-t border-hairline">
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut size={14} /> Изход
            </button>
          </form>
        </div>
      </details>
    </header>
  );
}
