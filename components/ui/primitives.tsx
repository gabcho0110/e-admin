import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────── Button ─────────────────────────── */

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-navy-700 text-white shadow-sm hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-navy-400",
        gold: "bg-gold text-navy-900 shadow-sm hover:bg-gold-400 focus-visible:ring-2 focus-visible:ring-gold-300",
        outline:
          "border border-hairline bg-panel text-content hover:border-navy-300 hover:bg-panel2",
        subtle: "bg-panel2 text-content hover:bg-navy-50 dark:hover:bg-navy-800/40",
        ghost: "text-muted hover:bg-panel2 hover:text-content",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "text-navy-600 underline-offset-4 hover:underline dark:text-gold-300",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonStyles>;

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

/* ─────────────────────────── Card ─────────────────────────── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600 dark:bg-navy-800/60 dark:text-gold-300">
            <Icon size={17} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{title}</h3>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* ─────────────────────────── Badge ─────────────────────────── */

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "gold"
  | "navy";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-panel2 text-muted border-hairline",
  info: "bg-navy-50 text-navy-600 border-navy-100 dark:bg-navy-800/50 dark:text-navy-100 dark:border-navy-700",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:border-amber-800",
  danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/25 dark:text-red-300 dark:border-red-800",
  gold: "bg-gold-50 text-gold-700 border-gold-200 dark:bg-gold-900/25 dark:text-gold-300 dark:border-gold-800",
  navy: "bg-navy-700 text-white border-navy-700",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium leading-5",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: BadgeTone }) {
  const colors: Record<BadgeTone, string> = {
    neutral: "bg-muted",
    info: "bg-navy-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    gold: "bg-gold",
    navy: "bg-navy-700",
  };
  return <span className={cn("h-1.5 w-1.5 rounded-full", colors[tone])} />;
}

/* ─────────────────────────── Form fields ─────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-[12px] leading-5 text-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-[12px] font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("field-input", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("field-input min-h-[110px] resize-y", className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn("field-input cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
});

/* ─────────────────────────── Page header ─────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[26px]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ─────────────────────────── Stat card ─────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  accent = "navy",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  accent?: "navy" | "gold" | "success" | "danger";
}) {
  const accents = {
    navy: "text-navy-600 bg-navy-50 dark:bg-navy-800/60 dark:text-gold-300",
    gold: "text-gold-700 bg-gold-50 dark:bg-gold-900/30 dark:text-gold-300",
    success: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/25 dark:text-emerald-300",
    danger: "text-red-700 bg-red-50 dark:bg-red-900/25 dark:text-red-300",
  };

  const inner = (
    <div className="surface-card group h-full p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", accents[accent])}>
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-3 font-display text-[30px] font-semibold leading-none tracking-tight">
        {value}
      </div>
      {hint ? <div className="mt-2 text-[12.5px] leading-5 text-muted">{hint}</div> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-panel2/60 px-6 text-center",
        compact ? "py-8" : "py-14",
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-panel text-muted shadow-sm">
        <Icon size={20} />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[13px] leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ─────────────────────────── Alert ─────────────────────────── */

const alertTones = {
  info: "border-navy-200 bg-navy-50 text-navy-800 dark:border-navy-700 dark:bg-navy-800/40 dark:text-navy-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200",
  danger:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200",
};

export function Alert({
  tone = "info",
  title,
  children,
  icon: Icon,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: string;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-[13px] leading-6", alertTones[tone], className)}>
      {Icon ? <Icon size={16} className="mt-1 shrink-0" /> : null}
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────── Misc ─────────────────────────── */

export function ProgressBar({ value, tone = "navy" }: { value: number; tone?: "navy" | "gold" | "success" }) {
  const colors = { navy: "bg-navy-600", gold: "bg-gold", success: "bg-emerald-500" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2 ring-1 ring-inset ring-hairline">
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const label = parts.map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-navy-700 font-semibold text-white ring-2 ring-gold/30"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">{children}</h2>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  );
}

export function Collapsible({
  summary,
  children,
  tone = "outline",
  open,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  tone?: "outline" | "primary";
  open?: boolean;
}) {
  return (
    <details className="group" open={open}>
      <summary
        className={cn(
          buttonStyles({ variant: tone === "primary" ? "primary" : "outline", size: "sm" }),
          "cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden",
        )}
      >
        {summary}
      </summary>
      <div className="mt-4 animate-fade-in">{children}</div>
    </details>
  );
}
