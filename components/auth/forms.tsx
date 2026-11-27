"use client";

import { AlertCircle, ArrowRight, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";

import { loginAction, registerCandidateAction, verifyTwoFactorAction } from "@/lib/actions/auth";
import { initialAuthState } from "@/lib/actions/types";
import { PasswordInput } from "@/components/ui/client";

export function LoginForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(loginAction, initialAuthState);
  const [twoFactor, twoFactorAction, twoFactorPending] = useActionState(
    verifyTwoFactorAction,
    initialAuthState,
  );

  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    const target = state.redirectTo || twoFactor.redirectTo;
    if ((state.status === "success" || twoFactor.status === "success") && target) {
      router.replace(target);
      router.refresh();
    }
  }, [state, twoFactor, router]);

  const stage = twoFactor.status === "totp" || state.status === "totp" ? "totp" : "credentials";
  const message = twoFactor.message || state.message;

  if (stage === "totp") {
    return (
      <div className="animate-fade-in">
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-navy-100 bg-navy-50 px-4 py-3 text-[13px] leading-6 text-navy-800 dark:border-navy-700 dark:bg-navy-800/40 dark:text-navy-100">
          <ShieldCheck size={17} className="mt-0.5 shrink-0 text-navy-600 dark:text-gold-300" />
          <div>
            <div className="font-semibold">Двуфакторна автентикация</div>
            <p className="text-[12.5px]">
              Профилът е защитен с код от приложение за автентикация (Google Authenticator, Authy,
              1Password).
            </p>
          </div>
        </div>

        {message ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        <form action={twoFactorAction} className="space-y-4">
          <div>
            <label htmlFor="code" className="field-label">
              Код за потвърждение
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              className="field-input text-center font-mono text-[22px] tracking-[0.5em]"
            />
            {twoFactor.fieldErrors?.code ? (
              <p className="mt-1 text-[12px] font-medium text-danger">{twoFactor.fieldErrors.code}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={twoFactorPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-700 text-[14px] font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
          >
            {twoFactorPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Потвърди и влез
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted">
          Загубихте достъп до приложението? Обърнете се към отговорника ИКТ.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="animate-fade-in space-y-4">
      {state.message && state.status === "error" ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] leading-5 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="field-label">
          Служебен имейл
        </label>
        <div className="relative">
          <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ime@pig-ohridski.bg"
            className="field-input pl-9"
          />
        </div>
        {state.fieldErrors?.email ? (
          <p className="mt-1 text-[12px] font-medium text-danger">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="field-label">
            Парола
          </label>
          <Link href="/login/help" className="mb-1.5 text-[11.5px] text-muted hover:text-content">
            Забравена парола?
          </Link>
        </div>
        <div className="relative">
          <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
          <div className="[&>input]:pl-9">
            <PasswordInput name="password" id="password" autoComplete="current-password" required />
          </div>
        </div>
        {state.fieldErrors?.password ? (
          <p className="mt-1 text-[12px] font-medium text-danger">{state.fieldErrors.password}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-700 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-navy-800 disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        {pending ? "Проверка…" : "Вход в системата"}
        {!pending ? <ArrowRight size={16} /> : null}
      </button>

      <div className="pt-2 text-center text-[12.5px] text-muted">
        Нямате профил?{" "}
        <Link href="/register" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
          Регистрация на кандидат
        </Link>
      </div>

      <div className="rounded-lg border border-hairline bg-panel2 px-3.5 py-2.5 text-[11.5px] leading-5 text-muted">
        <ShieldCheck size={13} className="mr-1 inline" />
        Достъпът е защитен. Всяко влизане и действие се записва в одиторския журнал. Не
        споделяйте паролата си.
      </div>
    </form>
  );
}

export function LoginAside({ institution }: { institution: string }) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950 p-10 lg:flex lg:flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #C5A253 0, transparent 45%), radial-gradient(circle at 85% 75%, #244A73 0, transparent 50%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/50 bg-white/5">
          <ShieldCheck size={22} className="text-gold" />
        </span>
        <div>
          <div className="font-display text-[17px] font-semibold text-white">PIG e-ADMIN</div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-gold/80">версия 1.0</div>
        </div>
      </div>

      <div className="relative mt-auto max-w-lg">
        <div className="mb-5 h-px w-16 bg-gold" />
        <h2 className="font-display text-[34px] leading-[1.15] text-white">
          Една институция.
          <br />
          Единна система.
          <br />
          <span className="text-gold">Пълен контрол.</span>
        </h2>
        <p className="mt-5 max-w-md text-[13.5px] leading-7 text-white/65">
          Централизирано управление на кандидатстването, подбора, акредитацията, документооборота и
          институционалния контрол на {institution}.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 text-[12px] text-white/70">
          {[
            "Електронно кандидатстване",
            "Комисии и оценки",
            "Акредитационни досиета",
            "Документооборот и архив",
            "Ролеви достъп",
            "Одиторски журнал",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-10 flex items-center justify-between text-[11px] text-white/40">
        <span>{institution}</span>
        <span>Сигурен достъп · HTTPS</span>
      </div>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(registerCandidateAction, initialAuthState);

  React.useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {state.message && state.status === "error" ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="full_name" className="field-label">
          Име и фамилия <span className="text-danger">*</span>
        </label>
        <input id="full_name" name="full_name" required className="field-input" placeholder="Иван Петров" />
        {state.fieldErrors?.full_name ? (
          <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.full_name}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reg_email" className="field-label">
            Имейл <span className="text-danger">*</span>
          </label>
          <input id="reg_email" name="email" type="email" required className="field-input" placeholder="ivan@example.com" />
          {state.fieldErrors?.email ? (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="reg_phone" className="field-label">
            Телефон
          </label>
          <input id="reg_phone" name="phone" className="field-input" placeholder="+359 88 000 0000" />
          {state.fieldErrors?.phone ? (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.phone}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reg_password" className="field-label">
            Парола <span className="text-danger">*</span>
          </label>
          <PasswordInput name="password" id="reg_password" autoComplete="new-password" required />
          {state.fieldErrors?.password ? (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.password}</p>
          ) : (
            <p className="mt-1 text-[11.5px] text-muted">Поне 8 знака, буква и цифра.</p>
          )}
        </div>
        <div>
          <label htmlFor="reg_password_confirm" className="field-label">
            Повторете паролата <span className="text-danger">*</span>
          </label>
          <PasswordInput name="password_confirm" id="reg_password_confirm" autoComplete="new-password" required />
          {state.fieldErrors?.password_confirm ? (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.password_confirm}</p>
          ) : null}
        </div>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-hairline bg-panel2 px-3.5 py-3 text-[12px] leading-5 text-muted">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-navy-700" required />
        <span>
          Съгласен/на съм личните ми данни да бъдат обработвани за целите на подбора съгласно
          Регламент (ЕС) 2016/679 (GDPR) и Политиката за поверителност на институцията.
        </span>
      </label>
      {state.fieldErrors?.consent ? (
        <p className="-mt-2 text-[12px] text-danger">{state.fieldErrors.consent}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-700 text-[14px] font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null}
        Създай профил
      </button>

      <p className="text-center text-[12.5px] text-muted">
        Вече имате профил?{" "}
        <Link href="/login" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
          Вход
        </Link>
      </p>
    </form>
  );
}
