"use client";

import { Check, Copy, Eye, EyeOff, Loader2, Moon, Printer, Sun } from "lucide-react";
import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button, buttonStyles } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ─── Submit бутон с автоматичен pending индикатор ─── */
export function SubmitButton({
  children,
  pendingText = "Записване…",
  variant = "primary",
  size = "md",
  className,
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "gold" | "outline" | "subtle" | "ghost" | "danger" | "link";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
      className={cn(buttonStyles({ variant, size }), className)}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : null}
      {pending ? pendingText : children}
    </button>
  );
}

/* ─── Тема ─── */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pig-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Светъл режим" : "Тъмен режим"}
      title={dark ? "Светъл режим" : "Тъмен режим"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-panel text-muted transition-colors hover:text-content",
        className,
      )}
    >
      {mounted && dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* ─── Показване/скриване на парола ─── */
export function PasswordInput({
  name,
  id,
  placeholder,
  autoComplete,
  required,
}: {
  name: string;
  id?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="field-input pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-content"
        aria-label={visible ? "Скрий паролата" : "Покажи паролата"}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

/* ─── Копиране ─── */
export function CopyButton({ value, label = "Копирай" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-panel px-2 py-1 text-[12px] text-muted transition-colors hover:text-content"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? "Копирано" : label}
    </button>
  );
}

export function PrintButton({ label = "Печат / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer size={14} /> {label}
    </Button>
  );
}
