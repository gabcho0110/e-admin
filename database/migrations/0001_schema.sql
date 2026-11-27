-- =====================================================================
-- PIG e-ADMIN 1.0 — основна схема
-- PostgreSQL 15+ / Supabase
-- Всички идентификатори са UUID. Всички дати са timestamptz (UTC).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ─── Изброими типове ────────────────────────────────────────────────
do $$ begin
  create type public.role_key as enum (
    'superadmin','director','deputy_director','accreditation_expert','hr_expert',
    'committee_chair','committee_member','ict_officer','teacher','candidate'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('draft','published','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum (
    'submitted','under_review','admitted','not_admitted','interview','approved','rejected','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_kind as enum ('cv','motivation','diploma','certificate','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.committee_status as enum ('draft','active','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.committee_member_role as enum ('chair','member','secretary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.accreditation_kind as enum ('internal','external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.accreditation_status as enum ('draft','active','completed','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.criterion_status as enum ('not_started','in_progress','submitted','approved','needs_revision');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_kind as enum ('self_assessment','analysis','report','improvement_plan','recommendation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('draft','submitted','approved','returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.doc_type as enum ('order','protocol','report','reference','plan','program','incoming','outgoing','policy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.doc_status as enum ('draft','pending_approval','approved','returned','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo','in_progress','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low','normal','high','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_kind as enum ('info','success','warning','deadline');
exception when duplicate_object then null; end $$;

-- ─── Помощна функция за updated_at ──────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Потребители ────────────────────────────────────────────────────
-- id съвпада с auth.users.id (Supabase Auth). password_hash се използва
-- само от локалния режим и остава NULL в продукция.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  password_hash text,
  full_name text not null,
  position text,
  phone text,
  is_active boolean not null default true,
  is_protected boolean not null default false,
  totp_secret text,
  totp_enabled boolean not null default false,
  last_login_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_format check (position(email in ('@')) > 0)
);

create unique index if not exists users_email_lower_idx on public.users (lower(email));
create index if not exists users_active_idx on public.users (is_active);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  department text,
  employment_type text,
  hired_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Роли и права ───────────────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key public.role_key not null unique,
  name text not null,
  description text,
  is_system boolean not null default true
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

create table if not exists public.role_permissions (
  role_key public.role_key not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role_key public.role_key not null references public.roles(key),
  created_at timestamptz not null default now(),
  unique (user_id, role_key)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);

-- ─── Комисии (преди кандидатурите, за да има FK) ────────────────────
create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purpose text,
  protocol_number text,
  status public.committee_status not null default 'draft',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  member_role public.committee_member_role not null default 'member',
  conflict_declared boolean not null default false,
  created_at timestamptz not null default now(),
  unique (committee_id, user_id)
);

create index if not exists committee_members_committee_idx on public.committee_members (committee_id);
create index if not exists committee_members_user_idx on public.committee_members (user_id);

-- ─── Обяви за работа ────────────────────────────────────────────────
create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  employment_type text not null,
  positions_count integer not null default 1 check (positions_count > 0),
  description text not null,
  requirements text not null,
  responsibilities text not null default '',
  salary_range text,
  deadline date not null,
  status public.job_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_posts_status_idx on public.job_posts (status, deadline desc);

-- ─── Кандидатури ────────────────────────────────────────────────────
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  job_post_id uuid not null references public.job_posts(id) on delete restrict,
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text not null,
  phone text not null,
  city text,
  motivation text not null,
  status public.application_status not null default 'submitted',
  committee_id uuid references public.committees(id) on delete set null,
  score_total numeric(6,2),
  decision_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_job_idx on public.applications (job_post_id);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_email_idx on public.applications (lower(email));
create index if not exists applications_committee_idx on public.applications (committee_id);

create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind public.document_kind not null default 'other',
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_at timestamptz not null default now()
);

create index if not exists candidate_documents_app_idx on public.candidate_documents (application_id);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status public.application_status not null,
  note text,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists application_events_app_idx on public.application_events (application_id, created_at);

-- ─── Оценяване ──────────────────────────────────────────────────────
create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  description text,
  max_score numeric(5,2) not null default 10 check (max_score > 0),
  weight numeric(4,2) not null default 1 check (weight > 0),
  position integer not null default 0
);

create index if not exists evaluation_criteria_committee_idx on public.evaluation_criteria (committee_id);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0),
  comment text,
  created_at timestamptz not null default now(),
  unique (committee_id, application_id, member_id, criterion_id)
);

create index if not exists evaluations_app_idx on public.evaluations (application_id);
create index if not exists evaluations_member_idx on public.evaluations (member_id);

-- ─── Акредитация и институционално развитие ────────────────────────
create table if not exists public.accreditation_cycles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind public.accreditation_kind not null default 'internal',
  period_start date not null,
  period_end date not null,
  status public.accreditation_status not null default 'draft',
  lead_id uuid references public.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditation_period_check check (period_end >= period_start)
);

create table if not exists public.criteria (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.accreditation_cycles(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  responsible_id uuid references public.users(id) on delete set null,
  status public.criterion_status not null default 'not_started',
  self_score numeric(5,2),
  target_score numeric(5,2),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, code)
);

create index if not exists criteria_cycle_idx on public.criteria (cycle_id);
create index if not exists criteria_responsible_idx on public.criteria (responsible_id);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.criteria(id) on delete cascade,
  title text not null,
  description text,
  file_name text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists evidence_criterion_idx on public.evidence (criterion_id);

create table if not exists public.institutional_reports (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.accreditation_cycles(id) on delete cascade,
  title text not null,
  kind public.report_kind not null default 'report',
  summary text not null default '',
  status public.report_status not null default 'draft',
  author_id uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institutional_reports_cycle_idx on public.institutional_reports (cycle_id);

-- ─── Документооборот ────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null,
  doc_type public.doc_type not null default 'order',
  status public.doc_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  author_id uuid references public.users(id) on delete set null,
  related_type text,
  related_id uuid,
  body text not null default '',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_type_idx on public.documents (doc_type);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version integer not null,
  body text not null,
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

-- ─── Задачи ─────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references public.users(id) on delete set null,
  due_date date,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  related_type text,
  related_id uuid,
  created_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_assignee_idx on public.tasks (assignee_id, status);
create index if not exists tasks_due_idx on public.tasks (due_date);

-- ─── Известия, журнал, настройки ────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind public.notification_kind not null default 'info',
  link text,
  is_read boolean not null default false,
  email_status text check (email_status in ('sent','skipped','failed')),
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ─── Тригери за updated_at ──────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'users','profiles','committees','job_posts','applications',
    'accreditation_cycles','criteria','institutional_reports','documents','tasks'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;
