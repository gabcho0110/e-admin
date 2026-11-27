import { Database, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Sidebar, TopbarLabel } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { dataMode, countRows } from "@/lib/db";
import { getCurrentUser, isCandidate } from "@/lib/auth/session";
import { allowedNavSections } from "@/lib/navigation";
import { MFA_REQUIRED_ROLES } from "@/lib/permissions/roles";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isCandidate(user)) redirect("/track");

  const sections = allowedNavSections(user.permissions);

  const [unread, pendingApplications] = await Promise.all([
    countRows("notifications", { user_id: user.id, is_read: false }),
    user.permissions.includes("applications.review")
      ? countRows("applications", { status: "submitted" })
      : Promise.resolve(0),
  ]);

  const mode = dataMode();
  const needsTwoFactor =
    !user.totp_enabled && user.roles.some((role) => MFA_REQUIRED_ROLES.includes(role));

  return (
    // На телефон мобилната лента е първият елемент в колоната; на десктоп
    // страничната лента и съдържанието са в ред. Без flex-col лентата става
    // flex елемент в реда и избутва съдържанието извън екрана.
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        sections={sections}
        user={{ full_name: user.full_name, position: user.position, email: user.email }}
        unreadCount={unread}
        pendingApplications={pendingApplications}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unreadCount={unread} label={<TopbarLabel />} />

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {mode === "local" ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-5 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/15 dark:text-amber-200">
              <Database size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">Локален режим.</strong> Supabase не е конфигуриран —
                данните се пазят във файл <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">./.data/db.json</code>.
                За продукционна среда задайте ключовете от <code>.env.example</code> и изпълнете миграциите.
              </span>
            </div>
          ) : null}
          {needsTwoFactor ? (
            <div className="mb-5 flex flex-wrap items-start gap-2.5 rounded-lg border border-navy-200 bg-navy-50 px-3.5 py-2.5 text-[12px] leading-5 text-navy-800 dark:border-navy-700 dark:bg-navy-800/40 dark:text-navy-100">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <strong className="font-semibold">Двуфакторната автентикация не е включена.</strong>{" "}
                За административните профили тя е задължителна по политика за сигурност.{" "}
                <Link
                  href="/dashboard/settings/security"
                  className="font-medium underline underline-offset-2 hover:no-underline"
                >
                  Включете я сега
                </Link>
                .
              </span>
            </div>
          ) : null}
          {children}
        </main>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-6 py-4 text-[11.5px] text-muted">
          <span>© {new Date().getFullYear()} ПИГ „Св. Климент Охридски“ · PIG e-ADMIN 1.0</span>
          <span className="flex items-center gap-1.5">
            <ShieldAlert size={12} />
            Всяко действие се записва в одиторския журнал
          </span>
        </footer>
      </div>
    </div>
  );
}
