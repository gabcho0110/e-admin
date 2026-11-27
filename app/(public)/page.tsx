import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  FileSearch,
  FolderOpen,
  Lock,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { Badge, ButtonLink, EmptyState } from "@/components/ui/primitives";
import { countRows, getSettings, listRows } from "@/lib/db";
import type { AccreditationCycleRow, JobPostRow } from "@/lib/types";
import { daysUntil, formatDate, formatDateShort } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getSettings();
  const jobs = await listRows<JobPostRow>("job_posts", { where: { status: "published" }, limit: 4 });
  const openJobs = jobs.filter((job) => new Date(job.deadline).getTime() >= Date.now() - 86_400_000);
  const cycles = await countRows("accreditation_cycles", { status: "active" });
  const staff = await countRows("users", { is_active: true });

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 10%, rgba(197,162,83,.55) 0, transparent 42%), radial-gradient(circle at 90% 85%, rgba(36,74,115,.9) 0, transparent 55%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.25fr_0.75fr] lg:py-24">
          <div className="animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-gold-200">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {settings.institution_name}
            </div>
            <h1 className="font-display text-[38px] leading-[1.08] tracking-tight text-white sm:text-[52px]">
              Електронна
              <br />
              административна
              <br />
              <span className="text-gold">система</span>
            </h1>
            <p className="mt-6 max-w-xl text-[14.5px] leading-7 text-white/70">
              {settings.institution_motto} Прозрачни процедури по кандидатстване, подбор и
              акредитация, единен документооборот и контрол върху всеки етап — на едно място.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-gold px-5 text-[13.5px] font-medium text-navy-900 transition-colors hover:bg-gold-400"
              >
                <BriefcaseBusiness size={16} /> Обяви за работа
              </Link>
              <Link
                href="/track"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/25 px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-white/10"
              >
                <Search size={16} /> Проследи кандидатура
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[11.5px] text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13} className="text-gold/70" /> Защитен достъп и одиторски журнал
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-gold/70" /> GDPR-съобразна обработка
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={13} className="text-gold/70" /> Единна институционална система
              </span>
            </div>
          </div>

          {/* Карта с реални данни */}
          <div className="animate-fade-up animate-delay-2 self-start rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold/80">
                Към момента
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] text-white/50">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> на живо
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Отворени позиции", value: openJobs.length, icon: BriefcaseBusiness },
                { label: "Активни процедури", value: cycles, icon: FileSearch },
                { label: "Активни служители", value: staff, icon: UsersRound },
                { label: "Публичен достъп", value: "24/7", icon: CalendarClock },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-navy-900/30 p-3.5">
                  <item.icon size={15} className="mb-2 text-gold/80" />
                  <div className="font-display text-[24px] font-semibold leading-none text-white">
                    {item.value}
                  </div>
                  <div className="mt-1 text-[10.5px] leading-4 text-white/50">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4 text-[11px] leading-5 text-white/50">
              Данните се обновяват в реално време от институционалната база. При липса на активни
              процедури системата показва съответното съобщение.
            </div>
          </div>
        </div>
      </section>

      {/* ─── Бърз достъп ─── */}
      <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              href: "/jobs",
              icon: BriefcaseBusiness,
              title: "Кандидатстване",
              text: "Актуални обяви и онлайн подаване на документи.",
            },
            {
              href: "/track",
              icon: Search,
              title: "Проследяване",
              text: "Статус по регистрационен номер и имейл.",
            },
            {
              href: "/privacy",
              icon: ShieldCheck,
              title: "Поверителност",
              text: "Как обработваме и съхраняваме личните данни.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group surface-card flex items-start gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600 dark:bg-navy-800/60 dark:text-gold-300">
                <item.icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  {item.title}
                  <ArrowRight size={13} className="text-muted transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-[12px] leading-5 text-muted">{item.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Обяви ─── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
              Кариера в институцията
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight">Актуални обяви</h2>
          </div>
          <ButtonLink href="/jobs" variant="outline" size="sm">
            Всички обяви <ArrowRight size={14} />
          </ButtonLink>
        </div>

        {openJobs.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="В момента няма публикувани свободни позиции"
            description="Щом бъде обявена нова процедура, тя ще се появи тук с описание, изисквания и краен срок за кандидатстване."
            action={
              <ButtonLink href="/register" variant="outline" size="sm">
                Създай профил за известия
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {openJobs.map((job) => {
              const left = daysUntil(job.deadline);
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="surface-card group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                        {job.department}
                      </div>
                      <h3 className="mt-1 truncate text-[16px] font-semibold group-hover:text-navy-600 dark:group-hover:text-gold-300">
                        {job.title}
                      </h3>
                    </div>
                    <Badge tone={left !== null && left <= 3 ? "warning" : "success"}>
                      {left !== null && left >= 0 ? `още ${left} дни` : "изтекъл срок"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-6 text-muted">
                    {job.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[11.5px] text-muted">
                    <span>{job.employment_type}</span>
                    <span>Краен срок: {formatDateShort(job.deadline)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Как работи ─── */}
      <section className="border-y border-hairline bg-panel">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-8 max-w-2xl">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
              Процес
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight">Как протича една процедура</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Всеки етап е проследим. Кандидатът вижда статуса си, а комисията — само своите
              задължения и поверителни оценки.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Подаване",
                text: "Кандидатът избира позиция и прикачва CV, мотивационно писмо и документи.",
              },
              {
                step: "02",
                title: "Регистрация",
                text: "Системата генерира уникален номер и потвърждава подаването по имейл.",
              },
              {
                step: "03",
                title: "Оценяване",
                text: "Комисията разглежда документите и попълва индивидуални оценъчни карти.",
              },
              {
                step: "04",
                title: "Решение",
                text: "Класирането и предложението се утвърждават от директора с протокол.",
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-xl border border-hairline bg-canvas p-5">
                <div className="font-display text-[22px] font-semibold text-gold/70">{item.step}</div>
                <div className="mt-2 text-[14px] font-semibold">{item.title}</div>
                <p className="mt-1 text-[12px] leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Институция ─── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
              Институция
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight">
              {settings.institution_name}
            </h2>
            <p className="mt-3 text-[13.5px] leading-7 text-muted">
              PIG e-ADMIN обединява административните процеси на институцията в една среда:
              кандидатстване и подбор на персонал, акредитация и институционално развитие,
              електронен документооборот, задачи, комисии и анализи. Достъпът се определя от ролята
              на служителя, а всяко действие се записва в одиторски журнал.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="surface-card p-4">
                <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted">Ръководител</div>
                <div className="mt-1 text-[14px] font-semibold">
                  {settings.institution_director || "Радослав Якимов"}
                </div>
                <div className="text-[11.5px] text-muted">
                  {settings.institution_director_role || "Директор"}
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted">
                  Техническа координация
                </div>
                <div className="mt-1 text-[14px] font-semibold">
                  {settings.institution_ict || "Алекс Тодоров"}
                </div>
                <div className="text-[11.5px] text-muted">
                  {settings.institution_ict_role || "Отговорник ИКТ"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-hairline bg-gradient-to-br from-navy-700 to-navy-900 p-6 text-white">
            <FolderOpen size={20} className="text-gold" />
            <h3 className="mt-3 font-display text-[19px] font-semibold">Прозрачност и отчетност</h3>
            <ul className="mt-4 space-y-3 text-[12.5px] leading-6 text-white/70">
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                Всяка кандидатура има уникален регистрационен номер и история на статусите.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                Индивидуалните оценки са защитени — достъп имат само членовете на комисията и
                директорът.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
                Документите се версионират, а одобренията и връщанията за корекция се записват.
              </li>
            </ul>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.05] p-3 text-[11px] leading-5 text-white/55">
              Вътрешните оценки и самооценката по критериите за качество имат институционален
              характер и не представляват официална държавна акредитация.
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-hairline bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <div>
            <h2 className="text-[20px] font-semibold">Готови ли сте да кандидатствате?</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              Разгледайте отворените позиции и подайте документите си онлайн.
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/jobs" variant="primary">
              Разгледай обявите <ArrowRight size={15} />
            </ButtonLink>
            <ButtonLink href="/track" variant="outline">
              Проследяване
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
