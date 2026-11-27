-- =====================================================================
-- PIG e-ADMIN 1.0 — Row Level Security
-- Принцип: достъпът се дава само след изрична политика.
-- Публичният (anon) достъп е сведен до публикувани обяви и подаване на кандидатура.
-- =====================================================================

-- ─── Помощни функции ────────────────────────────────────────────────
create or replace function public.has_role(r public.role_key)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key = r
  );
$$;

create or replace function public.has_permission(p text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = auth.uid() and rp.permission_key = p
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key <> 'candidate'
  );
$$;

create or replace function public.is_committee_member(c uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.committee_members m
    where m.committee_id = c and m.user_id = auth.uid()
  );
$$;

-- ─── Защита срещу повишаване на собствени права ─────────────────────
create or replace function public.tg_guard_user_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.has_permission('staff.manage') then
    if new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.totp_enabled is distinct from old.totp_enabled
       or new.totp_secret is distinct from old.totp_secret
       or new.password_hash is distinct from old.password_hash then
      raise exception 'Не можете да променяте собствения си статус или права.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_update on public.users;
create trigger guard_user_update
  before update on public.users
  for each row execute function public.tg_guard_user_update();

create or replace function public.tg_guard_user_roles()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role_key = 'superadmin' and not public.has_permission('settings.manage') then
    raise exception 'Само суперадминистратор може да дава роля „суперадминистратор“.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_roles on public.user_roles;
create trigger guard_user_roles
  before insert or update on public.user_roles
  for each row execute function public.tg_guard_user_roles();

-- ─── Включване на RLS ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'users','profiles','roles','permissions','role_permissions','user_roles',
    'job_posts','applications','candidate_documents','application_events',
    'committees','committee_members','evaluation_criteria','evaluations',
    'accreditation_cycles','criteria','evidence','institutional_reports',
    'documents','document_versions','tasks','notifications','audit_logs','system_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ─── users ──────────────────────────────────────────────────────────
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid());

drop policy if exists users_select_staff on public.users;
create policy users_select_staff on public.users
  for select using (public.has_permission('staff.view'));

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists users_manage on public.users;
create policy users_manage on public.users
  for all using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- ─── profiles ───────────────────────────────────────────────────────
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select using (public.has_permission('staff.view'));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profiles_manage on public.profiles;
create policy profiles_manage on public.profiles
  for all using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- ─── роли и права ───────────────────────────────────────────────────
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select using (auth.uid() is not null);

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select using (auth.uid() is not null);

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select using (auth.uid() is not null);

drop policy if exists roles_manage on public.roles;
create policy roles_manage on public.roles for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists permissions_manage on public.permissions;
create policy permissions_manage on public.permissions for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists role_permissions_manage on public.role_permissions;
create policy role_permissions_manage on public.role_permissions for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self on public.user_roles for select using (user_id = auth.uid());

drop policy if exists user_roles_select_staff on public.user_roles;
create policy user_roles_select_staff on public.user_roles for select using (public.has_permission('staff.view'));

drop policy if exists user_roles_manage on public.user_roles;
create policy user_roles_manage on public.user_roles for all using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- ─── обяви ──────────────────────────────────────────────────────────
drop policy if exists job_posts_public_read on public.job_posts;
create policy job_posts_public_read on public.job_posts
  for select using (status = 'published');

drop policy if exists job_posts_manage on public.job_posts;
create policy job_posts_manage on public.job_posts
  for all using (public.has_permission('recruitment.manage'))
  with check (public.has_permission('recruitment.manage'));

-- ─── кандидатури ────────────────────────────────────────────────────
-- Публично подаване: само в начален статус, без комисия и без оценка.
drop policy if exists applications_public_insert on public.applications;
create policy applications_public_insert on public.applications
  for insert to anon, authenticated
  with check (
    status = 'submitted'
    and committee_id is null
    and score_total is null
    and decision_note is null
  );

drop policy if exists applications_review_read on public.applications;
create policy applications_review_read on public.applications
  for select using (public.has_permission('applications.review'));

drop policy if exists applications_review_update on public.applications;
create policy applications_review_update on public.applications
  for update using (public.has_permission('applications.review'))
  with check (public.has_permission('applications.review'));

drop policy if exists applications_candidate_read on public.applications;
create policy applications_candidate_read on public.applications
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and lower(u.email) = lower(applications.email)
    )
  );

drop policy if exists candidate_documents_read on public.candidate_documents;
create policy candidate_documents_read on public.candidate_documents
  for select using (
    public.has_permission('applications.review')
    or exists (
      select 1 from public.applications a
      join public.users u on lower(u.email) = lower(a.email)
      where a.id = candidate_documents.application_id and u.id = auth.uid()
    )
  );

drop policy if exists candidate_documents_write on public.candidate_documents;
create policy candidate_documents_write on public.candidate_documents
  for all using (public.has_permission('applications.review'))
  with check (public.has_permission('applications.review'));

drop policy if exists application_events_read on public.application_events;
create policy application_events_read on public.application_events
  for select using (
    public.has_permission('applications.review')
    or exists (
      select 1 from public.applications a
      join public.users u on lower(u.email) = lower(a.email)
      where a.id = application_events.application_id and u.id = auth.uid()
    )
  );

drop policy if exists application_events_write on public.application_events;
create policy application_events_write on public.application_events
  for insert with check (public.has_permission('applications.review'));

-- ─── комисии ────────────────────────────────────────────────────────
drop policy if exists committees_read on public.committees;
create policy committees_read on public.committees
  for select using (
    public.has_permission('committees.manage')
    or public.has_permission('applications.review')
    or public.is_committee_member(id)
  );

drop policy if exists committees_manage on public.committees;
create policy committees_manage on public.committees
  for all using (public.has_permission('committees.manage'))
  with check (public.has_permission('committees.manage'));

drop policy if exists committee_members_read on public.committee_members;
create policy committee_members_read on public.committee_members
  for select using (
    public.has_permission('applications.review')
    or user_id = auth.uid()
  );

drop policy if exists committee_members_manage on public.committee_members;
create policy committee_members_manage on public.committee_members
  for all using (public.has_permission('committees.manage'))
  with check (public.has_permission('committees.manage'));

drop policy if exists evaluation_criteria_read on public.evaluation_criteria;
create policy evaluation_criteria_read on public.evaluation_criteria
  for select using (
    public.has_permission('applications.review') or public.is_committee_member(committee_id)
  );

drop policy if exists evaluation_criteria_manage on public.evaluation_criteria;
create policy evaluation_criteria_manage on public.evaluation_criteria
  for all using (public.has_permission('committees.manage'))
  with check (public.has_permission('committees.manage'));

-- ─── поверителни оценки ─────────────────────────────────────────────
-- Виждат се само от член на съответната комисия, директор или суперадмин.
drop policy if exists evaluations_confidential_read on public.evaluations;
create policy evaluations_confidential_read on public.evaluations
  for select using (
    public.is_committee_member(committee_id)
    or public.has_role('director')
    or public.has_role('superadmin')
  );

drop policy if exists evaluations_member_write on public.evaluations;
create policy evaluations_member_write on public.evaluations
  for all using (
    public.has_permission('evaluations.confidential') and public.is_committee_member(committee_id)
  )
  with check (
    public.has_permission('evaluations.confidential')
    and public.is_committee_member(committee_id)
    and member_id = auth.uid()
  );

-- ─── акредитация ────────────────────────────────────────────────────
drop policy if exists accreditation_read on public.accreditation_cycles;
create policy accreditation_read on public.accreditation_cycles
  for select using (public.is_staff());

drop policy if exists accreditation_manage on public.accreditation_cycles;
create policy accreditation_manage on public.accreditation_cycles
  for all using (public.has_permission('accreditation.manage'))
  with check (public.has_permission('accreditation.manage'));

drop policy if exists criteria_read on public.criteria;
create policy criteria_read on public.criteria for select using (public.is_staff());

drop policy if exists criteria_manage on public.criteria;
create policy criteria_manage on public.criteria
  for all using (public.has_permission('accreditation.manage'))
  with check (public.has_permission('accreditation.manage'));

drop policy if exists evidence_read on public.evidence;
create policy evidence_read on public.evidence for select using (public.is_staff());

drop policy if exists evidence_manage on public.evidence;
create policy evidence_manage on public.evidence
  for all using (public.has_permission('accreditation.manage'))
  with check (public.has_permission('accreditation.manage'));

drop policy if exists reports_read on public.institutional_reports;
create policy reports_read on public.institutional_reports for select using (public.is_staff());

drop policy if exists reports_manage on public.institutional_reports;
create policy reports_manage on public.institutional_reports
  for all using (public.has_permission('accreditation.manage'))
  with check (public.has_permission('accreditation.manage'));

-- ─── документи ──────────────────────────────────────────────────────
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select using (public.has_permission('documents.view'));

drop policy if exists documents_manage on public.documents;
create policy documents_manage on public.documents
  for all using (public.has_permission('documents.manage'))
  with check (public.has_permission('documents.manage'));

drop policy if exists document_versions_read on public.document_versions;
create policy document_versions_read on public.document_versions
  for select using (public.has_permission('documents.view'));

drop policy if exists document_versions_write on public.document_versions;
create policy document_versions_write on public.document_versions
  for insert with check (public.has_permission('documents.manage'));

-- ─── задачи ─────────────────────────────────────────────────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select using (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.has_permission('staff.manage')
  );

drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks
  for all using (public.has_permission('tasks.manage'))
  with check (public.has_permission('tasks.manage'));

-- ─── известия ───────────────────────────────────────────────────────
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── одиторски журнал (само четене от оторизирани) ──────────────────
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
  for select using (public.has_permission('audit.view'));

-- ─── настройки ──────────────────────────────────────────────────────
drop policy if exists settings_read on public.system_settings;
create policy settings_read on public.system_settings
  for select using (auth.uid() is not null);

drop policy if exists settings_manage on public.system_settings;
create policy settings_manage on public.system_settings
  for all using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ─── Storage: приватна папка за кандидатски документи ───────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-documents', 'candidate-documents', false, 10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do nothing;

drop policy if exists candidate_files_read on storage.objects;
create policy candidate_files_read on storage.objects
  for select using (
    bucket_id = 'candidate-documents' and public.has_permission('applications.review')
  );

drop policy if exists candidate_files_upload on storage.objects;
create policy candidate_files_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'candidate-documents' and public.has_permission('applications.review'));

drop policy if exists candidate_files_delete on storage.objects;
create policy candidate_files_delete on storage.objects
  for delete using (
    bucket_id = 'candidate-documents' and public.has_permission('applications.review')
  );
