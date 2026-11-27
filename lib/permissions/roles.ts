import type { Permission, RoleKey } from "@/lib/types";

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  permissions: Permission[];
}

/**
 * Единен източник на истина за ролите.
 * Същите стойности се записват в таблиците `roles`, `permissions` и `role_permissions`
 * чрез database/seed.sql — при промяна тук миграцията трябва да се обнови.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "superadmin",
    name: "Суперадминистратор",
    description: "Пълен технически достъп до системата и настройките.",
    permissions: [
      "dashboard.view",
      "recruitment.manage",
      "applications.review",
      "evaluations.confidential",
      "accreditation.manage",
      "documents.view",
      "documents.manage",
      "staff.view",
      "staff.manage",
      "committees.manage",
      "tasks.manage",
      "reports.view",
      "notifications.view",
      "settings.manage",
      "audit.view",
      "invoices.view",
      "invoices.manage",
      "director.decide",
    ],
  },
  {
    key: "director",
    name: "Директор",
    description: "Пълен институционален контрол върху всички модули.",
    permissions: [
      "dashboard.view",
      "recruitment.manage",
      "applications.review",
      "evaluations.confidential",
      "accreditation.manage",
      "documents.view",
      "documents.manage",
      "staff.view",
      "staff.manage",
      "committees.manage",
      "tasks.manage",
      "reports.view",
      "notifications.view",
      "settings.manage",
      "audit.view",
      "invoices.view",
      "invoices.manage",
      "director.decide",
    ],
  },
  {
    key: "deputy_director",
    name: "Заместник-директор",
    description: "Оперативно управление без достъп до системните настройки.",
    permissions: [
      "dashboard.view",
      "recruitment.manage",
      "applications.review",
      "accreditation.manage",
      "documents.view",
      "documents.manage",
      "staff.view",
      "committees.manage",
      "tasks.manage",
      "reports.view",
      "notifications.view",
      "invoices.view",
      "invoices.manage",
    ],
  },
  {
    key: "accreditation_expert",
    name: "Експерт по акредитация",
    description: "Води процедурите по самооценка, доказателства и доклади.",
    permissions: [
      "dashboard.view",
      "accreditation.manage",
      "documents.view",
      "documents.manage",
      "tasks.manage",
      "reports.view",
      "notifications.view",
    ],
  },
  {
    key: "hr_expert",
    name: "Експерт по човешки ресурси",
    description: "Отговаря за обявите, кандидатурите и кадровия регистър.",
    permissions: [
      "dashboard.view",
      "recruitment.manage",
      "applications.review",
      "documents.view",
      "documents.manage",
      "staff.view",
      "staff.manage",
      "committees.manage",
      "tasks.manage",
      "reports.view",
      "notifications.view",
    ],
  },
  {
    key: "committee_chair",
    name: "Председател на комисия",
    description: "Ръководи комисия, води протокол и обобщава оценките.",
    permissions: [
      "dashboard.view",
      "applications.review",
      "evaluations.confidential",
      "documents.view",
      "documents.manage",
      "committees.manage",
      "tasks.manage",
      "notifications.view",
    ],
  },
  {
    key: "committee_member",
    name: "Член на комисия",
    description: "Попълва индивидуални оценъчни карти по зададени критерии.",
    permissions: [
      "dashboard.view",
      "applications.review",
      "evaluations.confidential",
      "documents.view",
      "tasks.manage",
      "notifications.view",
    ],
  },
  {
    key: "ict_officer",
    name: "Отговорник ИКТ",
    description: "Техническа поддръжка без достъп до кадрови досиета и оценки.",
    permissions: [
      "dashboard.view",
      "documents.view",
      "tasks.manage",
      "notifications.view",
      "settings.manage",
      "audit.view",
    ],
  },
  {
    key: "teacher",
    name: "Преподавател",
    description: "Достъп до задачи, документи и известия.",
    permissions: ["dashboard.view", "documents.view", "tasks.manage", "notifications.view"],
  },
  {
    key: "candidate",
    name: "Кандидат",
    description: "Достъп единствено до собствените кандидатури.",
    permissions: [],
  },
];

export const ROLE_MAP: Record<RoleKey, RoleDefinition> = ROLE_DEFINITIONS.reduce(
  (acc, role) => {
    acc[role.key] = role;
    return acc;
  },
  {} as Record<RoleKey, RoleDefinition>,
);

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "Преглед на таблото",
  "recruitment.manage": "Управление на обяви",
  "applications.review": "Разглеждане на кандидатури",
  "evaluations.confidential": "Достъп до поверителни оценки",
  "accreditation.manage": "Управление на акредитация",
  "documents.view": "Преглед на документи",
  "documents.manage": "Създаване и редакция на документи",
  "staff.view": "Преглед на персонала",
  "staff.manage": "Управление на персонала",
  "committees.manage": "Управление на комисии",
  "tasks.manage": "Управление на задачи",
  "reports.view": "Преглед на анализи",
  "notifications.view": "Известия",
  "settings.manage": "Системни настройки",
  "audit.view": "Журнал на действията",
  "invoices.view": "Преглед на фактури",
  "invoices.manage": "Издаване на фактури",
  "director.decide": "Окончателни решения",
};

export const ROLE_LABELS: Record<RoleKey, string> = ROLE_DEFINITIONS.reduce(
  (acc, role) => {
    acc[role.key] = role.name;
    return acc;
  },
  {} as Record<RoleKey, string>,
);

/** Роли, които имат достъп до административния панел. */
export const ADMIN_ROLES: RoleKey[] = ROLE_DEFINITIONS.filter((r) => r.key !== "candidate").map(
  (r) => r.key,
);

/** Роли, за които двуфакторната автентикация е задължителна при наличие на настройка. */
export const MFA_REQUIRED_ROLES: RoleKey[] = [
  "superadmin",
  "director",
  "deputy_director",
  "ict_officer",
];
