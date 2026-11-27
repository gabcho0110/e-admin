import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { RegisterForm } from "@/components/auth/forms";
import { getCurrentUser, isCandidate } from "@/lib/auth/session";
import { getSettings } from "@/lib/db";

export const metadata: Metadata = { title: "Регистрация на кандидат" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(isCandidate(user) ? "/track" : "/dashboard");

  const settings = await getSettings();
  const institution = settings.institution_name || "ПИГ „Св. Климент Охридски“";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-700">
              <ShieldCheck size={17} className="text-gold" />
            </span>
            <div>
              <div className="font-display text-[14px] font-semibold leading-tight">PIG e-ADMIN</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-gold-600">версия 1.0</div>
            </div>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-content"
          >
            <ArrowLeft size={14} /> Към входа
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1fr_460px] lg:py-16">
        <div className="max-w-lg">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">
            Публичен портал
          </div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight">
            Профил на кандидат
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-muted">
            Профилът ви позволява да проследявате статуса на всички свои кандидатури на едно място,
            да получавате известия при промяна и да виждате историята на всяка процедура.
          </p>

          <div className="mt-8 space-y-4">
            {[
              {
                title: "Кандидатствайте онлайн",
                text: "Подайте документите си по обявена позиция за минути — без посещение в институцията.",
              },
              {
                title: "Проследявайте статуса",
                text: "Виждате всеки етап: проверка, допускане, интервю, решение — с дата и основание.",
              },
              {
                title: "Защитени данни",
                text: "Документите се съхраняват в защитена среда и се виждат само от оторизираната комисия.",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 rounded-xl border border-hairline bg-panel p-4">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <div>
                  <div className="text-[13.5px] font-semibold">{item.title}</div>
                  <p className="mt-0.5 text-[12.5px] leading-6 text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[11.5px] leading-6 text-muted">
            {institution} · Обработката на лични данни се извършва при спазване на Регламент (ЕС)
            2016/679 и приложимото българско законодателство.
          </p>
        </div>

        <div className="surface-card h-fit p-6 sm:p-7">
          <h2 className="text-[17px] font-semibold">Създаване на профил</h2>
          <p className="mb-5 mt-1 text-[12.5px] text-muted">
            Полетата с <span className="text-danger">*</span> са задължителни.
          </p>
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
