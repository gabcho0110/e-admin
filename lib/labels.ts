import type {
  AccreditationStatus,
  ApplicationStatus,
  CommitteeMemberRole,
  CommitteeStatus,
  CriterionStatus,
  DocStatus,
  DocType,
  DocumentKind,
  InvoiceStatus,
  InvoiceType,
  JobStatus,
  NotificationKind,
  PaymentMethod,
  ReportKind,
  ReportStatus,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "gold" | "navy";

export interface LabelMeta {
  label: string;
  tone: Tone;
}

export const APPLICATION_STATUS: Record<ApplicationStatus, LabelMeta> = {
  submitted: { label: "Подадена", tone: "info" },
  under_review: { label: "В процес на проверка", tone: "warning" },
  admitted: { label: "Допусната", tone: "success" },
  not_admitted: { label: "Недопусната", tone: "danger" },
  interview: { label: "На интервю", tone: "gold" },
  approved: { label: "Одобрена", tone: "success" },
  rejected: { label: "Отхвърлена", tone: "danger" },
  archived: { label: "Архивирана", tone: "neutral" },
};

export const APPLICATION_FLOW: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "admitted",
  "interview",
  "approved",
];

export const JOB_STATUS: Record<JobStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  published: { label: "Публикувана", tone: "success" },
  closed: { label: "Затворена", tone: "danger" },
};

export const DOC_STATUS: Record<DocStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  pending_approval: { label: "За одобрение", tone: "warning" },
  approved: { label: "Одобрен", tone: "success" },
  returned: { label: "Върнат за корекция", tone: "danger" },
  archived: { label: "Архивиран", tone: "neutral" },
};

export const DOC_TYPE: Record<DocType, LabelMeta> = {
  order: { label: "Заповед", tone: "navy" },
  protocol: { label: "Протокол", tone: "info" },
  report: { label: "Доклад", tone: "gold" },
  reference: { label: "Служебна справка", tone: "neutral" },
  plan: { label: "План", tone: "info" },
  program: { label: "Програма", tone: "info" },
  incoming: { label: "Входящ документ", tone: "neutral" },
  outgoing: { label: "Изходящ документ", tone: "neutral" },
  policy: { label: "Вътрешно правило", tone: "gold" },
};

export const DOCUMENT_KIND: Record<DocumentKind, string> = {
  cv: "Автобиография (CV)",
  motivation: "Мотивационно писмо",
  diploma: "Диплома",
  certificate: "Сертификат",
  other: "Друг документ",
};

export const INVOICE_TYPE: Record<InvoiceType, LabelMeta> = {
  invoice: { label: "Фактура", tone: "navy" },
  proforma: { label: "Проформа фактура", tone: "info" },
  debit_note: { label: "Дебитно известие", tone: "warning" },
  credit_note: { label: "Кредитно известие", tone: "gold" },
  storno: { label: "Сторно", tone: "danger" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  issued: { label: "Издадена", tone: "info" },
  paid: { label: "Платена", tone: "success" },
  cancelled: { label: "Анулирана", tone: "danger" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  bank: "Банков превод",
  cash: "В брой",
  card: "С карта",
  other: "Друго",
};

/** Валути, в които може да се издава документ. */
export const INVOICE_CURRENCIES = ["EUR", "BGN"] as const;

/** Стандартни мерни единици за редовете. */
export const INVOICE_UNITS = ["бр.", "час", "месец", "курс", "ден", "услуга", "кг"] as const;

/** Стандартни ставки на ДДС в България. */
export const VAT_RATES = [20, 9, 0] as const;

export const TASK_STATUS: Record<TaskStatus, LabelMeta> = {
  todo: { label: "За изпълнение", tone: "neutral" },
  in_progress: { label: "В изпълнение", tone: "info" },
  done: { label: "Изпълнена", tone: "success" },
  cancelled: { label: "Отменена", tone: "danger" },
};

export const TASK_PRIORITY: Record<TaskPriority, LabelMeta> = {
  low: { label: "Нисък", tone: "neutral" },
  normal: { label: "Нормален", tone: "info" },
  high: { label: "Висок", tone: "warning" },
  critical: { label: "Критичен", tone: "danger" },
};

export const CRITERION_STATUS: Record<CriterionStatus, LabelMeta> = {
  not_started: { label: "Не е започнат", tone: "neutral" },
  in_progress: { label: "В изпълнение", tone: "info" },
  submitted: { label: "Подаден за преглед", tone: "warning" },
  approved: { label: "Одобрен", tone: "success" },
  needs_revision: { label: "За корекция", tone: "danger" },
};

export const REPORT_STATUS: Record<ReportStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  submitted: { label: "Подаден", tone: "warning" },
  approved: { label: "Одобрен", tone: "success" },
  returned: { label: "Върнат за корекция", tone: "danger" },
};

export const REPORT_KIND: Record<ReportKind, string> = {
  self_assessment: "Самооценка",
  analysis: "Анализ",
  report: "Доклад",
  improvement_plan: "План за подобрение",
  recommendation: "Препоръка",
};

export const ACCREDITATION_STATUS: Record<AccreditationStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  active: { label: "Активна", tone: "success" },
  completed: { label: "Приключена", tone: "info" },
  archived: { label: "Архивирана", tone: "neutral" },
};

export const COMMITTEE_STATUS: Record<CommitteeStatus, LabelMeta> = {
  draft: { label: "Чернова", tone: "neutral" },
  active: { label: "Активна", tone: "success" },
  closed: { label: "Приключена", tone: "info" },
};

export const COMMITTEE_ROLE: Record<CommitteeMemberRole, string> = {
  chair: "Председател",
  member: "Член",
  secretary: "Секретар",
};

export const NOTIFICATION_KIND: Record<NotificationKind, Tone> = {
  info: "info",
  success: "success",
  warning: "warning",
  deadline: "danger",
};

export const EMPLOYMENT_TYPES = [
  "Трудов договор — безсрочен",
  "Трудов договор — срочен",
  "Срочен договор за заместване",
  "Граждански договор",
  "Непълен работен ден",
];

export const DEPARTMENTS = [
  "Ръководство",
  "Учебна дейност",
  "Администрация",
  "Счетоводство",
  "Детска градина",
  "Начален етап",
  "Прогимназиален етап",
  "Гимназиален етап",
  "Технически персонал",
];
