import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { LoginAside, LoginForm } from "@/components/auth/forms";
import { getCurrentUser, isCandidate } from "@/lib/auth/session";
import { getSettings } from "@/lib/db";

export const metadata: Metadata = { title: "Вход" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isCandidate(user) ? "/track" : "/dashboard");

  const settings = await getSettings();
  const institution = settings.institution_name || "ПИГ „Св. Климент Охридски“";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <LoginAside institution={institution} />

      <div className="flex flex-col justify-center bg-canvas px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[410px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy-700">
              <ShieldCheck size={19} className="text-gold" />
            </span>
            <div>
              <div className="font-display text-[15px] font-semibold">PIG e-ADMIN</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-gold-600">версия 1.0</div>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600 dark:text-gold-400">
              Сигурен достъп
            </div>
            <h1 className="text-[27px] font-semibold tracking-tight">Вход в системата</h1>
            <p className="mt-2 text-[13.5px] leading-6 text-muted">
              Използвайте служебния си профил. Достъпът е обвързан с ролята, която ви е определил
              директорът.
            </p>
          </div>

          <LoginForm />

          <div className="mt-8 flex items-center justify-between border-t border-hairline pt-4 text-[11.5px] text-muted">
            <span>{institution}</span>
            <Link href="/" className="hover:text-content">
              Публичен портал →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
