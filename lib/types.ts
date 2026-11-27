/**
 * Домейн типове на PIG e-ADMIN.
 * Имената на полетата съвпадат с колоните в PostgreSQL (snake_case),
 * за да може един и същ обект да се използва и в Supabase, и в локалния store.
 */

export type UUID = string;

export type RoleKey =
  | "superadmin"
  | "director"
  | "deputy_director"
  | "accreditation_expert"
  | "hr_expert"
  | "committee_chair"
  | "committee_member"
  | "ict_officer"
  | "teacher"
  | "candidate";

export type Permission =
  | "dashboard.view"
  | "recruitment.manage"
  | "applications.review"
  | "evaluations.confidential"
  | "accreditation.manage"
  | "documents.view"
  | "documents.manage"
  | "staff.view"
  | "staff.manage"
  | "committees.manage"
  | "tasks.manage"
  | "reports.view"
  | "notifications.view"
  | "settings.manage"
  | "audit.view"
  | "invoices.view"
  | "invoices.manage"
  | "director.decide";

export interface UserRow {
  id: UUID;
  email: string;
  password_hash: string | null;
  full_name: string;
  position: string | null;
  phone: string | null;
  is_active: boolean;
  /** Защитен профил — не може да бъде изтрит, деактивиран или понижен. */
  is_protected?: boolean | null;
  totp_secret: string | null;
  totp_enabled: boolean;
  last_login_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: UUID;
  user_id: UUID;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  employment_type: string | null;
  hired_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleRow {
  id: UUID;
  key: RoleKey;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface PermissionRow {
  id: UUID;
  key: Permission;
  description: string | null;
}

export interface UserRoleRow {
  id: UUID;
  user_id: UUID;
  role_key: RoleKey;
  created_at: string;
}

export type JobStatus = "draft" | "published" | "closed";

export interface JobPostRow {
  id: UUID;
  title: string;
  department: string;
  employment_type: string;
  positions_count: number;
  description: string;
  requirements: string;
  responsibilities: string;
  salary_range: string | null;
  deadline: string;
  status: JobStatus;
  published_at: string | null;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "admitted"
  | "not_admitted"
  | "interview"
  | "approved"
  | "rejected"
  | "archived";

export interface ApplicationRow {
  id: UUID;
  registration_number: string;
  job_post_id: UUID;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone: string;
  city: string | null;
  motivation: string;
  status: ApplicationStatus;
  committee_id: UUID | null;
  score_total: number | null;
  decision_note: string | null;
  submitted_at: string;
  updated_at: string;
}

export type DocumentKind = "cv" | "motivation" | "diploma" | "certificate" | "other";

export interface CandidateDocumentRow {
  id: UUID;
  application_id: UUID;
  kind: DocumentKind;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface ApplicationEventRow {
  id: UUID;
  application_id: UUID;
  status: ApplicationStatus;
  note: string | null;
  actor_id: UUID | null;
  created_at: string;
}

export type CommitteeStatus = "draft" | "active" | "closed";

export interface CommitteeRow {
  id: UUID;
  name: string;
  purpose: string | null;
  protocol_number: string | null;
  status: CommitteeStatus;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export type CommitteeMemberRole = "chair" | "member" | "secretary";

export interface CommitteeMemberRow {
  id: UUID;
  committee_id: UUID;
  user_id: UUID;
  member_role: CommitteeMemberRole;
  conflict_declared: boolean;
  created_at: string;
}

export interface EvaluationCriterionRow {
  id: UUID;
  committee_id: UUID;
  name: string;
  description: string | null;
  max_score: number;
  weight: number;
  position: number;
}

/** Поверителна оценка — вижда се само от членове на комисията и директора. */
export interface EvaluationRow {
  id: UUID;
  committee_id: UUID;
  application_id: UUID;
  member_id: UUID;
  criterion_id: UUID;
  score: number;
  comment: string | null;
  created_at: string;
}

export type AccreditationKind = "internal" | "external";
export type AccreditationStatus = "draft" | "active" | "completed" | "archived";

export interface AccreditationCycleRow {
  id: UUID;
  title: string;
  kind: AccreditationKind;
  period_start: string;
  period_end: string;
  status: AccreditationStatus;
  lead_id: UUID | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type CriterionStatus = "not_started" | "in_progress" | "submitted" | "approved" | "needs_revision";

export interface CriterionRow {
  id: UUID;
  cycle_id: UUID;
  code: string;
  title: string;
  description: string | null;
  responsible_id: UUID | null;
  status: CriterionStatus;
  self_score: number | null;
  target_score: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceRow {
  id: UUID;
  criterion_id: UUID;
  title: string;
  description: string | null;
  file_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: UUID | null;
  uploaded_at: string;
}

export type ReportKind = "self_assessment" | "analysis" | "report" | "improvement_plan" | "recommendation";
export type ReportStatus = "draft" | "submitted" | "approved" | "returned";

export interface InstitutionalReportRow {
  id: UUID;
  cycle_id: UUID;
  title: string;
  kind: ReportKind;
  summary: string;
  status: ReportStatus;
  author_id: UUID | null;
  approved_by: UUID | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocType =
  | "order"
  | "protocol"
  | "report"
  | "reference"
  | "plan"
  | "program"
  | "incoming"
  | "outgoing"
  | "policy";

export type DocStatus = "draft" | "pending_approval" | "approved" | "returned" | "archived";

export interface DocumentRow {
  id: UUID;
  number: string;
  title: string;
  doc_type: DocType;
  status: DocStatus;
  version: number;
  author_id: UUID | null;
  related_type: string | null;
  related_id: UUID | null;
  body: string;
  approved_by: UUID | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersionRow {
  id: UUID;
  document_id: UUID;
  version: number;
  body: string;
  note: string | null;
  changed_by: UUID | null;
  created_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface TaskRow {
  id: UUID;
  title: string;
  description: string | null;
  assignee_id: UUID | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  related_type: string | null;
  related_id: UUID | null;
  created_by: UUID | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationKind = "info" | "success" | "warning" | "deadline";

export interface NotificationRow {
  id: UUID;
  user_id: UUID;
  title: string;
  body: string;
  kind: NotificationKind;
  link: string | null;
  is_read: boolean;
  email_status: "sent" | "skipped" | "failed" | null;
  created_at: string;
}

export interface AuditLogRow {
  id: UUID;
  actor_id: UUID | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SystemSettingRow {
  key: string;
  value: string;
  updated_at: string;
}

/* ─────────────────────────── Фактури ─────────────────────────── */

/** Видове документи в модул „Фактури“. */
export type InvoiceType = "invoice" | "proforma" | "debit_note" | "credit_note" | "storno";

/** Чернова → издадена → платена; анулираната остава в регистъра с нулев ефект. */
export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export type PaymentMethod = "bank" | "cash" | "card" | "other";

/** Контрагент (получател) — може да се използва многократно. */
export interface InvoiceClientRow {
  id: UUID;
  name: string;
  /** ЕИК / ЕГН / БУЛСТАТ */
  eik: string | null;
  /** ДДС номер за вътреобщностни доставки */
  vat_number: string | null;
  /** Материално отговорно лице */
  mol: string | null;
  address: string | null;
  city: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Издаден документ. Данните за издателя и получателя се записват като
 * „снимка“ в самия документ — така по-късна промяна на контрагента или на
 * настройките не променя вече издадените фактури.
 */
export interface InvoiceRow {
  id: UUID;
  number: string;
  doc_type: InvoiceType;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  client_id: UUID | null;
  client_name: string;
  client_eik: string | null;
  client_vat: string | null;
  client_mol: string | null;
  client_address: string | null;
  client_city: string | null;
  client_country: string;
  client_email: string | null;
  supplier_name: string;
  supplier_eik: string | null;
  supplier_vat: string | null;
  supplier_address: string | null;
  supplier_iban: string | null;
  supplier_bank: string | null;
  supplier_mol: string | null;
  currency: string;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  paid_amount: number;
  payment_method: PaymentMethod;
  /** Основание: договор, заявление, заповед… */
  basis: string | null;
  note: string | null;
  /** Кредитно известие / сторно сочи към първичния документ. */
  related_invoice_id: UUID | null;
  created_by: UUID | null;
  issued_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: UUID;
  invoice_id: UUID;
  position: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_subtotal: number;
  line_vat: number;
  line_total: number;
  created_at: string;
}

/** Сесия, върната от `getCurrentUser()`. */
export interface SessionUser {
  id: UUID;
  email: string;
  full_name: string;
  position: string | null;
  phone: string | null;
  roles: RoleKey[];
  permissions: Permission[];
  totp_enabled: boolean;
  is_active: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
