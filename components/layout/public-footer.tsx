import { Mail, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function PublicFooter({ settings }: { settings: Record<string, string> }) {
  return (
    <footer className="mt-20 border-t border-hairline bg-panel">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-700">
              <ShieldCheck size={17} className="text-gold" />
            </span>
            <div>
              <div className="font-display text-[14px] font-semibold">PIG e-ADMIN 1.0</div>
              <div className="text-[11px] text-muted">{settings.institution_name}</div>
            </div>
          </div>
          <p className="mt-4 max-w-md text-[12.5px] leading-6 text-muted">
            Електронна административна система за централизирано управление на кандидатстването,
            подбора, акредитацията и документооборота. {settings.institution_motto}
          </p>
          <div className="mt-4 space-y-1.5 text-[12px] text-muted">
            <div className="flex items-center gap-2">
              <MapPin size={13} /> {settings.institution_address || "гр. София, България"}
            </div>
            <div className="flex items-center gap-2">
              <Mail size={13} /> {settings.institution_email || "info@pig-ohridski.bg"}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Публичен портал
          </div>
          <ul className="space-y-2 text-[12.5px]">
            <li>
              <Link href="/jobs" className="text-content/80 hover:text-content">
                Обяви за работа
              </Link>
            </li>
            <li>
              <Link href="/track" className="text-content/80 hover:text-content">
                Проследяване на кандидатура
              </Link>
            </li>
            <li>
              <Link href="/register" className="text-content/80 hover:text-content">
                Регистрация на кандидат
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-content/80 hover:text-content">
                Поверителност и GDPR
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Институция
          </div>
          <ul className="space-y-2 text-[12.5px] text-content/80">
            <li>{settings.institution_director || "Радослав Якимов"} — директор</li>
            <li>{settings.institution_ict || "Алекс Тодоров"} — отговорник ИКТ</li>
            <li>
              <Link href="/login" className="hover:text-content">
                Служебен вход
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11px] text-muted">
          <span>© {new Date().getFullYear()} {settings.institution_name}. Всички права запазени.</span>
          <span>Обработка на лични данни съгласно Регламент (ЕС) 2016/679</span>
        </div>
      </div>
    </footer>
  );
}
