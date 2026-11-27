"use client";

import { Menu, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { ThemeToggle } from "@/components/ui/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Начало" },
  { href: "/jobs", label: "Обяви за работа" },
  { href: "/track", label: "Проследяване" },
  { href: "/privacy", label: "Поверителност" },
];

export function PublicHeader({ institution }: { institution: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-700/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/50 bg-white/5">
            <ShieldCheck size={18} className="text-gold" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[14.5px] font-semibold leading-tight text-white">
              PIG e-ADMIN
            </span>
            <span className="block truncate text-[10px] uppercase tracking-[0.13em] text-gold/80">
              {institution}
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-[12.5px] transition-colors",
                  active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle className="ml-2 border-white/20 bg-white/5 text-white/70 hover:text-white" />
          <Link
            href="/login"
            className="ml-1 rounded-lg bg-gold px-3.5 py-2 text-[12.5px] font-medium text-navy-900 transition-colors hover:bg-gold-400"
          >
            Служебен вход
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle className="border-white/20 bg-white/5 text-white/70" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Меню"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/20 text-white"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-navy-800 px-5 py-3 md:hidden">
          <nav className="flex flex-col">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-2 py-2.5 text-[13px] text-white/80 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-lg bg-gold px-3 py-2.5 text-center text-[13px] font-medium text-navy-900"
            >
              Служебен вход
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
