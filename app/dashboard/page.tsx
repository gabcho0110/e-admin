import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileClock,
  FolderOpen,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
} from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { countRows, getSettings, listRows } from "@/lib/db";
import { APPLICATION_STATUS, CRITERION_STATUS, DOC_STATUS, TASK_STATUS } from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type {
  AccreditationCycleRow,
  ApplicationRow,
  AuditLogRow,
  CriterionRow,
  DocumentRow,
  JobPostRow,
  NotificationRow,
  TaskRow,
} from "@/lib/types";
import { daysUntil, formatDate, formatDateShort, fromNow } from "@/lib/utils";

export const metadata: Metadata = { title: "Табло" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requirePermission("dashboard.view");
  const sp = await searchParams;

  const canReview = user.permissions.includes("applications.review");
  const canApprove = user.permissions.includes("director.decide");
  const canAudit = user.permissions.includes("audit.view");
  const canAccreditation = user.permissions.includes("accreditation.manage");

  const [settings, staffCount, newApplications, totalApplications, activeCycles, pendingDocs, tasks, notifications] =
    await Promise.all([
      getSettings(),
      countRows("users", { is_active: true }),
      canReview ? countRows("applications", { status: "submitted" }) : Promise.resolve(0),
      canReview ? countRows("applications") : Promise.resolve(0),
      canAccreditation ? countRows("accreditation_cycles", { status: "active" }) : Promise.resolve(0),
      user.permissions.includes("documents.view")
        ? countRows("documents", { status: "pending_approval" })
        : Promise.resolve(0),
      listRows<TaskRow>("tasks", { orderBy: "created_at" }),
      listRows<NotificationRow>("notifications", { where: { user_id: user.id }, limit: 5 }),
    ]);

  const myTasks = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled" && task.assignee_id === user.id,
  );
  const openTasks = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");

  const [pendingDocuments, recentApplications, cycles, auditRows, jobs] = await Promise.all([
    user.permissions.includes("documents.view")
      ? listRows<DocumentRow>("documents", { where: { status: "pending_approval" }, limit: 5 })
      : Promise.resolve([]),
    canReview ? listRows<ApplicationRow>("applications", { limit: 5 }) : Promise.resolve([]),
    canAccreditation
      ? listRows<AccreditationCycleRow>("accreditation_cycles", { where: { status: "active" }, limit: 3 })
      : Promise.resolve([]),
    canAudit ? listRows<AuditLogRow>("audit_logs", { limit: 7 }) : Promise.resolve([]),
    user.permissions.includes("recruitment.manage")
      ? listRows<JobPostRow>("job_posts", { where: { status: "published" }, limit: 3 })
      : Promise.resolve([]),
  ]);

  const criteriaByCycle = canAccreditation
    ? await Promise.all(
        cycles.map(async (cycle) => ({
          cycle,
          criteria: await listRows<CriterionRow>("criteria", { where: { cycle_id: cycle.id } }),
        })),
      )
    : [];

  const deadlines = [
    ...myTasks
      .filter((task) => task.due_date)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        date: task.due_date as string,
        kind: "Задача",
        href: "/dashboard/tasks",
      })),
    ...jobs
      .filter((job) => job.deadline)
      .map((job) => ({
        id: `job-${job.id}`,
        title: `Краен срок: ${job.title}`,
        date: job.deadline,
        kind: "Обява",
        href: `/dashboard/recruitment/${job.id}`,
      })),
  ]
    .filter((item) => {
      const left = daysUntil(item.date);
      return left !== null && left >= 0 && left <= 21;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const roleLabel = user.roles.length
    ? user.roles.map((role) => ROLE_LABELS[role]).join(" · ")
    : "Служител";
  const today = new Intl.DateTimeFormat("bg-BG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {sp.denied ? (
        <Alert tone="warning" title="Ограничен достъп" icon={AlertTriangle}>
          Нямате право за достъп до този модул. Ако смятате, че това е грешка, обърнете се към
          директора или отговорника ИКТ.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600 dark:text-gold-400">
            {today}
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Добре дошли, {user.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {roleLabel} · {settings.institution_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.permissions.includes("recruitment.manage") ? (
            <ButtonLink href="/dashboard/recruitment" variant="primary" size="sm">
              <BriefcaseBusiness size={14} /> Обяви
            </ButtonLink>
          ) : null}
          {canReview ? (
            <ButtonLink href="/dashboard/selection" variant="outline" size="sm">
              <ClipboardList size={14} /> Кандидатури
            </ButtonLink>
          ) : null}
          <ButtonLink href="/dashboard/tasks" variant="outline" size="sm">
            <CheckCircle2 size={14} /> Задачи
          </ButtonLink>
        </div>
      </div>

      {/* Показатели */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {user.permissions.includes("staff.view") ? (
          <StatCard
            label="Активни служители"
            value={staffCount}
            hint="Профили с активен достъп"
            icon={UsersRound}
            href="/dashboard/staff"
          />
        ) : (
          <StatCard label="Мои задачи" value={myTasks.length} hint="Задачи в изпълнение" icon={CheckCircle2} href="/dashboard/tasks" />
        )}
        {canReview ? (
          <StatCard
            label="Нови кандидатури"
            value={newApplications}
            hint={`${totalApplications} общо в регистъра`}
            icon={BriefcaseBusiness}
            href="/dashboard/selection"
            accent={newApplications > 0 ? "gold" : "navy"}
          />
        ) : (
          <StatCard label="Документи" value={pendingDocs} hint="Чакащи одобрение" icon={FolderOpen} href="/dashboard/documents" />
        )}
        {canAccreditation ? (
          <StatCard
            label="Активни процедури"
            value={activeCycles}
            hint="Акредитация и институционално развитие"
            icon={BadgeCheck}
            href="/dashboard/accreditation"
          />
        ) : (
          <StatCard label="Известия" value={notifications.filter((n) => !n.is_read).length} hint="Непрочетени" icon={Bell} href="/dashboard/notifications" />
        )}
        <StatCard
          label="Документи за одобрение"
          value={pendingDocs}
          hint={canApprove ? "Очакват вашето решение" : "В процес на съгласуване"}
          icon={FileClock}
          href="/dashboard/documents?status=pending_approval"
          accent={pendingDocs > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Срокове */}
          <Card>
            <CardHeader
              title="Предстоящи срокове"
              description="Задачи и обяви с краен срок до 21 дни"
              icon={CalendarClock}
              action={
                <Link href="/dashboard/tasks" className="text-[12px] text-muted hover:text-content">
                  Всички задачи →
                </Link>
              }
            />
            <CardBody className="p-0">
              {deadlines.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={CalendarClock}
                    compact
                    title="Няма предстоящи срокове"
                    description="Когато бъде възложена задача или обявена позиция с краен срок, тя ще се появи тук."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {deadlines.map((item) => {
                    const left = daysUntil(item.date) ?? 0;
                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel2"
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[12px] font-semibold ${
                              left <= 3
                                ? "bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300"
                                : "bg-panel2 text-muted"
                            }`}
                          >
                            {left}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{item.title}</span>
                            <span className="block text-[11.5px] text-muted">
                              {item.kind} · {formatDate(item.date)}
                            </span>
                          </span>
                          <ArrowRight size={14} className="text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Кандидатури / документи */}
          {canReview ? (
            <Card>
              <CardHeader
                title="Последни кандидатури"
                description="Най-новите постъпления в регистъра"
                icon={BriefcaseBusiness}
                action={
                  <Link href="/dashboard/selection" className="text-[12px] text-muted hover:text-content">
                    Регистър →
                  </Link>
                }
              />
              <CardBody className="p-0">
                {recentApplications.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={BriefcaseBusiness}
                      compact
                      title="Няма подадени кандидатури"
                      description="Публикувайте обява — кандидатурите ще се появят тук автоматично."
                      action={
                        user.permissions.includes("recruitment.manage") ? (
                          <ButtonLink href="/dashboard/recruitment" size="sm" variant="outline">
                            Към обявите
                          </ButtonLink>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {recentApplications.map((application) => (
                      <li key={application.id}>
                        <Link
                          href={`/dashboard/selection/${application.id}`}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel2"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {application.first_name} {application.last_name}
                            </span>
                            <span className="block text-[11.5px] text-muted">
                              № {application.registration_number} · {fromNow(application.submitted_at)}
                            </span>
                          </span>
                          <Badge tone={APPLICATION_STATUS[application.status].tone}>
                            {APPLICATION_STATUS[application.status].label}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}

          {/* Акредитация */}
          {criteriaByCycle.length > 0 ? (
            <Card>
              <CardHeader
                title="Акредитация — напредък"
                description="Активни процедури и готовност на критериите"
                icon={BadgeCheck}
                action={
                  <Link href="/dashboard/accreditation" className="text-[12px] text-muted hover:text-content">
                    Всички →
                  </Link>
                }
              />
              <CardBody className="space-y-5">
                {criteriaByCycle.map(({ cycle, criteria }) => {
                  const approved = criteria.filter((c) => c.status === "approved").length;
                  const percent = criteria.length ? Math.round((approved / criteria.length) * 100) : 0;
                  return (
                    <div key={cycle.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <Link
                          href={`/dashboard/accreditation/${cycle.id}`}
                          className="truncate text-[13px] font-medium hover:text-navy-600 dark:hover:text-gold-300"
                        >
                          {cycle.title}
                        </Link>
                        <span className="shrink-0 text-[11.5px] text-muted">
                          {approved}/{criteria.length} критерия
                        </span>
                      </div>
                      <ProgressBar value={percent} tone={percent === 100 ? "success" : "navy"} />
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {/* Документи за одобрение */}
          <Card>
            <CardHeader title="За одобрение" description="Документи, чакащи решение" icon={FileClock} />
            <CardBody className="p-0">
              {pendingDocuments.length === 0 ? (
                <p className="px-5 py-6 text-center text-[12.5px] text-muted">
                  Няма документи, чакащи одобрение.
                </p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {pendingDocuments.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/dashboard/documents/${doc.id}`}
                        className="block px-5 py-3 transition-colors hover:bg-panel2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] font-medium">{doc.title}</span>
                            <span className="block text-[11px] text-muted">№ {doc.number}</span>
                          </span>
                          <Badge tone={DOC_STATUS[doc.status].tone}>{DOC_STATUS[doc.status].label}</Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Известия */}
          <Card>
            <CardHeader
              title="Известия"
              description="Последни съобщения"
              icon={Bell}
              action={
                <Link href="/dashboard/notifications" className="text-[12px] text-muted hover:text-content">
                  Всички →
                </Link>
              }
            />
            <CardBody className="p-0">
              {notifications.length === 0 ? (
                <p className="px-5 py-6 text-center text-[12.5px] text-muted">Няма известия.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {notifications.map((notification) => (
                    <li key={notification.id} className="px-5 py-3">
                      <div className="flex items-start gap-2">
                        {!notification.is_read ? (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        ) : (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-medium">{notification.title}</div>
                          <div className="line-clamp-2 text-[11.5px] leading-5 text-muted">
                            {notification.body}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-muted">{fromNow(notification.created_at)}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Одиторски журнал */}
          {canAudit ? (
            <Card>
              <CardHeader
                title="Последни действия"
                description="Одиторски журнал"
                icon={ShieldCheck}
                action={
                  <Link href="/dashboard/settings/audit" className="text-[12px] text-muted hover:text-content">
                    Журнал →
                  </Link>
                }
              />
              <CardBody className="p-0">
                {auditRows.length === 0 ? (
                  <p className="px-5 py-6 text-center text-[12.5px] text-muted">Няма записани действия.</p>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {auditRows.map((row) => (
                      <li key={row.id} className="px-5 py-2.5">
                        <div className="truncate text-[12px] font-medium">{row.action}</div>
                        <div className="text-[10.5px] text-muted">
                          {row.actor_name || "Система"} · {fromNow(row.created_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}

          {/* Кратък статус на задачите */}
          <Card>
            <CardHeader title="Задачи" description="Разпределение по статус" icon={CheckCircle2} />
            <CardBody className="space-y-3">
              {(["todo", "in_progress", "done"] as const).map((status) => {
                const count = tasks.filter((task) => task.status === status).length;
                const percent = tasks.length ? Math.round((count / tasks.length) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-[11.5px]">
                      <span className="text-muted">{TASK_STATUS[status].label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <ProgressBar value={percent} tone={status === "done" ? "success" : "navy"} />
                  </div>
                );
              })}
              {tasks.length === 0 ? (
                <p className="pt-1 text-[12px] text-muted">
                  Няма задачи.{" "}
                  <Link href="/dashboard/tasks" className="text-navy-600 hover:underline dark:text-gold-300">
                    Създайте първата
                  </Link>
                  .
                </p>
              ) : null}
              <div className="border-t border-hairline pt-3 text-[11.5px] text-muted">
                {openTasks.length} отворени задачи · {myTasks.length} възложени на вас
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Празно състояние за институция без данни */}
      {totalApplications === 0 && staffCount <= 1 && activeCycles === 0 && pendingDocs === 0 ? (
        <Alert tone="info" title="Системата е готова за работа" icon={ShieldCheck}>
          Все още няма въведени данни. Започнете с публикуване на обява, създаване на
          акредитационна процедура или добавяне на служители — всички показатели тук се изчисляват
          от реалните записи в базата.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "/dashboard/recruitment",
            icon: BriefcaseBusiness,
            label: "Публикувай обява",
            show: user.permissions.includes("recruitment.manage"),
          },
          {
            href: "/dashboard/accreditation",
            icon: BadgeCheck,
            label: "Нова процедура",
            show: canAccreditation,
          },
          {
            href: "/dashboard/documents",
            icon: FolderOpen,
            label: "Нов документ",
            show: user.permissions.includes("documents.manage"),
          },
          {
            href: "/dashboard/tasks",
            icon: CheckCircle2,
            label: "Възложи задача",
            show: user.permissions.includes("tasks.manage"),
          },
        ]
          .filter((item) => item.show)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-2.5 rounded-xl border border-hairline bg-panel px-4 py-3 text-[12.5px] font-medium transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-600 dark:bg-navy-800/60 dark:text-gold-300">
                <item.icon size={15} />
              </span>
              {item.label}
              <ArrowRight size={13} className="ml-auto text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
      </div>
    </div>
  );
}
