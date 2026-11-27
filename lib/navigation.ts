import type { Permission } from "@/lib/types";

export interface NavEntry {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
  description?: string;
}

export interface NavSection {
  title?: string;
  items: NavEntry[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: "/dashboard", label: "Табло", icon: "dashboard", permission: "dashboard.view" }],
  },
  {
    title: "Процеси",
    items: [
      {
        href: "/dashboard/recruitment",
        label: "Кандидатстване",
        icon: "briefcase",
        permission: "recruitment.manage",
      },
      {
        href: "/dashboard/selection",
        label: "Подбор на персонал",
        icon: "users",
        permission: "applications.review",
      },
      {
        href: "/dashboard/accreditation",
        label: "Акредитация",
        icon: "badge",
        permission: "accreditation.manage",
      },
      {
        href: "/dashboard/documents",
        label: "Документи",
        icon: "folder",
        permission: "documents.view",
      },
      {
        href: "/dashboard/invoices",
        label: "Фактури",
        icon: "receipt",
        permission: "invoices.view",
      },
      {
        href: "/dashboard/tasks",
        label: "Задачи",
        icon: "checklist",
        permission: "tasks.manage",
      },
    ],
  },
  {
    title: "Институция",
    items: [
      { href: "/dashboard/staff", label: "Персонал", icon: "idcard", permission: "staff.view" },
      {
        href: "/dashboard/committees",
        label: "Комисии",
        icon: "gavel",
        permission: "committees.manage",
      },
      {
        href: "/dashboard/quality",
        label: "Качество",
        icon: "shield",
        permission: "accreditation.manage",
      },
      { href: "/dashboard/reports", label: "Анализи", icon: "chart", permission: "reports.view" },
    ],
  },
  {
    title: "Система",
    items: [
      {
        href: "/dashboard/notifications",
        label: "Известия",
        icon: "bell",
        permission: "notifications.view",
      },
      {
        href: "/dashboard/settings",
        label: "Настройки",
        icon: "settings",
        permission: "settings.manage",
      },
    ],
  },
];

export function allowedNavSections(permissions: Permission[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);
}

export function navLabelFor(pathname: string): string {
  const all = NAV_SECTIONS.flatMap((s) => s.items);
  const exact = all.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const partial = all
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return partial?.label ?? "PIG e-ADMIN";
}
