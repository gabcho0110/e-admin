import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";

import { getSettings } from "@/lib/db";

export const metadata: Metadata = { title: "Помощ при вход" };
export const dynamic = "force-dynamic";

export default async function LoginHelpPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-content">
          <ArrowLeft size={14} /> Обратно към входа
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-700">
            <LifeBuoy size={20} className="text-gold" />
          </span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">Помощ при вход</h1>
            <p className="text-[12.5px] text-muted">PIG e-ADMIN · {settings.institution_name}</p>
          </div>
        </div>

        <div className="space-y-4">
          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <KeyRound size={16} className="text-gold-600" /> Забравена парола
            </h2>
            <p className="mt-2 text-[13px] leading-7 text-muted">
              По съображения за сигурност паролата не се изпраща по имейл. Заявете възстановяване
              при отговорника ИКТ —{" "}
              <span className="font-medium text-content">{settings.institution_ict || "Алекс Тодоров"}</span>{" "}
              ({settings.institution_email || "info@pig-ohridski.bg"}). Администраторът ще зададе
              временна парола, която е задължително да смените при първия вход.
            </p>
          </section>

          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <ShieldCheck size={16} className="text-gold-600" /> Двуфакторна автентикация
            </h2>
            <p className="mt-2 text-[13px] leading-7 text-muted">
              Административните профили могат да бъдат защитени с еднократен код от приложение за
              автентикация. Ако сте загубили достъп до приложението, отговорникът ИКТ може да
              нулира настройката след проверка на самоличността.
            </p>
          </section>

          <section className="surface-card p-5">
            <h2 className="text-[15px] font-semibold">Кандидати</h2>
            <p className="mt-2 text-[13px] leading-7 text-muted">
              Кандидатите не използват служебен вход. Подайте кандидатура от{" "}
              <Link href="/jobs" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
                обявите за работа
              </Link>{" "}
              и проследявайте статуса с регистрационния номер и имейла си на страницата{" "}
              <Link href="/track" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
                Проследяване
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
