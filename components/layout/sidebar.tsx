"use client";

import {
  BadgeCheck,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CheckSquare,
  ChevronRight,
  FolderOpen,
  Gavel,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { NavSection } from "@/lib/navigation";
import { navLabelFor } from "@/lib/navigation";
import { cn, initials } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/client";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dashboard: LayoutDashboard,
  briefcase: BriefcaseBusiness,
  users: UsersRound,
  badge: BadgeCheck,
  folder: FolderOpen,
  checklist: CheckSquare,
  idcard: IdCard,
  gavel: Gavel,
  shield: ShieldCheck,
  chart: BarChart3,
  receipt: Receipt,
  bell: Bell,
  settings: Settings,
};

interface SidebarProps {
  sections: NavSection[];
  user: { full_name: string; position: string | null; email: string };
  unreadCount: number;
  pendingApplications: number;
}

export function Sidebar({ sections, user, unreadCount, pendingApplications }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin">
      {sections.map((section, idx) => (
        <div key={section.title ?? `section-${idx}`}>
          {section.title ? (
            <div className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
              {section.title}
            </div>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              const badge =
                item.href === "/dashboard/notifications"
                  ? unreadCount
                  : item.href === "/dashboard/selection"
                    ? pendingApplications
                    : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-all duration-150",
                      active
                        ? "bg-white/12 font-medium text-white shadow-sm"
                        : "text-white/70 hover:bg-white/[0.07] hover:text-white",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold" />
                    ) : null}
                    <Icon size={16} className={active ? "text-gold" : "text-white/55 group-hover:text-white/80"} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 ? (
                      <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-navy-900">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-white/10 px-5 py-[18px]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/50 bg-white/5">
        <ShieldCheck size={18} className="text-gold" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-display text-[15px] font-semibold leading-tight text-white">
          PIG e-ADMIN
        </div>
        <div className="truncate text-[10px] uppercase tracking-[0.14em] text-gold/80">версия 1.0</div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="ml-auto grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
        aria-label="Затвори менюто"
      >
        <X size={17} />
      </button>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.06] px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-[12px] font-semibold text-navy-900">
          {initials(user.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-white">{user.full_name}</div>
          <div className="truncate text-[10.5px] text-white/50">{user.position || "Служител"}</div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="grid h-7 w-7 place-items-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title="Изход"
            aria-label="Изход"
          >
            <LogOut size={14} />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Мобилна лента */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-panel px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline text-content"
          aria-label="Отвори менюто"
        >
          <Menu size={18} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-navy-700">
            <ShieldCheck size={14} className="text-gold" />
          </span>
          <span className="font-display text-[14px] font-semibold">PIG e-ADMIN</span>
        </Link>
        <ThemeToggle className="ml-auto" />
        <Link
          href="/dashboard/notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-hairline"
          aria-label="Известия"
        >
          <Bell size={16} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-bold text-navy-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col bg-gradient-to-b from-navy-700 via-navy-800 to-navy-900 transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="hidden lg:block lg:w-[268px] lg:shrink-0" aria-hidden />
    </>
  );
}

export function Breadcrumb({ label }: { label: string }) {
  return (
    <div className="hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
      <Link href="/dashboard" className="hover:text-content">
        Табло
      </Link>
      <ChevronRight size={12} />
      <span className="font-medium text-content">{label}</span>
    </div>
  );
}

export function TopbarLabel() {
  const pathname = usePathname();
  return <>{navLabelFor(pathname)}</>;
}
