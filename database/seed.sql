-- =====================================================================
-- PIG e-ADMIN 1.0 — начални данни (роли, права, институционални настройки)
-- Изпълнява се СЛЕД миграциите, с service role / postgres.
-- Не създава потребители: първият администратор се създава с
--   npm run create-admin
-- =====================================================================

insert into public.roles (key, name, description) values
  ('superadmin',        'Суперадминистратор',        'Пълен технически достъп до системата и настройките.'),
  ('director',          'Директор',                  'Пълен институционален контрол върху всички модули.'),
  ('deputy_director',   'Заместник-директор',        'Оперативно управление без достъп до системните настройки.'),
  ('accreditation_expert','Експерт по акредитация',  'Води процедурите по самооценка, доказателства и доклади.'),
  ('hr_expert',         'Експерт по човешки ресурси','Отговаря за обявите, кандидатурите и кадровия регистър.'),
  ('committee_chair',   'Председател на комисия',    'Ръководи комисия, води протокол и обобщава оценките.'),
  ('committee_member',  'Член на комисия',           'Попълва индивидуални оценъчни карти по зададени критерии.'),
  ('ict_officer',       'Отговорник ИКТ',            'Техническа поддръжка без достъп до кадрови досиета и оценки.'),
  ('teacher',           'Преподавател',              'Достъп до задачи, документи и известия.'),
  ('candidate',         'Кандидат',                  'Достъп единствено до собствените кандидатури.')
on conflict (key) do update
  set name = excluded.name, description = excluded.description;

insert into public.permissions (key, description) values
  ('dashboard.view',            'Преглед на таблото'),
  ('recruitment.manage',        'Управление на обяви'),
  ('applications.review',       'Разглеждане на кандидатури'),
  ('evaluations.confidential',  'Достъп до поверителни оценки'),
  ('accreditation.manage',      'Управление на акредитация'),
  ('documents.view',            'Преглед на документи'),
  ('documents.manage',          'Създаване и редакция на документи'),
  ('staff.view',                'Преглед на персонала'),
  ('staff.manage',              'Управление на персонала'),
  ('committees.manage',         'Управление на комисии'),
  ('tasks.manage',              'Управление на задачи'),
  ('reports.view',              'Преглед на анализи'),
  ('notifications.view',        'Известия'),
  ('settings.manage',           'Системни настройки'),
  ('audit.view',                'Журнал на действията'),
  ('director.decide',           'Окончателни решения')
on conflict (key) do update set description = excluded.description;

-- Пълният набор за суперадминистратор и директор
insert into public.role_permissions (role_key, permission_key)
select r.key, p.key
from public.roles r
cross join public.permissions p
where r.key in ('superadmin','director')
on conflict do nothing;

-- Заместник-директор
insert into public.role_permissions (role_key, permission_key) values
  ('deputy_director','dashboard.view'),
  ('deputy_director','recruitment.manage'),
  ('deputy_director','applications.review'),
  ('deputy_director','accreditation.manage'),
  ('deputy_director','documents.view'),
  ('deputy_director','documents.manage'),
  ('deputy_director','staff.view'),
  ('deputy_director','committees.manage'),
  ('deputy_director','tasks.manage'),
  ('deputy_director','reports.view'),
  ('deputy_director','notifications.view')
on conflict do nothing;

-- Експерт по акредитация
insert into public.role_permissions (role_key, permission_key) values
  ('accreditation_expert','dashboard.view'),
  ('accreditation_expert','accreditation.manage'),
  ('accreditation_expert','documents.view'),
  ('accreditation_expert','documents.manage'),
  ('accreditation_expert','tasks.manage'),
  ('accreditation_expert','reports.view'),
  ('accreditation_expert','notifications.view')
on conflict do nothing;

-- Експерт по човешки ресурси
insert into public.role_permissions (role_key, permission_key) values
  ('hr_expert','dashboard.view'),
  ('hr_expert','recruitment.manage'),
  ('hr_expert','applications.review'),
  ('hr_expert','documents.view'),
  ('hr_expert','documents.manage'),
  ('hr_expert','staff.view'),
  ('hr_expert','staff.manage'),
  ('hr_expert','committees.manage'),
  ('hr_expert','tasks.manage'),
  ('hr_expert','reports.view'),
  ('hr_expert','notifications.view')
on conflict do nothing;

-- Председател на комисия
insert into public.role_permissions (role_key, permission_key) values
  ('committee_chair','dashboard.view'),
  ('committee_chair','applications.review'),
  ('committee_chair','evaluations.confidential'),
  ('committee_chair','documents.view'),
  ('committee_chair','documents.manage'),
  ('committee_chair','committees.manage'),
  ('committee_chair','tasks.manage'),
  ('committee_chair','notifications.view')
on conflict do nothing;

-- Член на комисия
insert into public.role_permissions (role_key, permission_key) values
  ('committee_member','dashboard.view'),
  ('committee_member','applications.review'),
  ('committee_member','evaluations.confidential'),
  ('committee_member','documents.view'),
  ('committee_member','tasks.manage'),
  ('committee_member','notifications.view')
on conflict do nothing;

-- Отговорник ИКТ — без кадрови досиета и без оценки
insert into public.role_permissions (role_key, permission_key) values
  ('ict_officer','dashboard.view'),
  ('ict_officer','documents.view'),
  ('ict_officer','tasks.manage'),
  ('ict_officer','notifications.view'),
  ('ict_officer','settings.manage'),
  ('ict_officer','audit.view')
on conflict do nothing;

-- Преподавател
insert into public.role_permissions (role_key, permission_key) values
  ('teacher','dashboard.view'),
  ('teacher','documents.view'),
  ('teacher','tasks.manage'),
  ('teacher','notifications.view')
on conflict do nothing;

-- Кандидат — без административни права (достъпът е само до собствени кандидатури)
-- (няма записи)

-- ─── Институционални настройки ─────────────────────────────────────
insert into public.system_settings (key, value) values
  ('institution_name',        'ПИГ „Св. Климент Охридски“'),
  ('institution_director',    'Радослав Якимов'),
  ('institution_director_role','Директор'),
  ('institution_ict',         'Алекс Тодоров'),
  ('institution_ict_role',    'Отговорник ИКТ'),
  ('institution_motto',       'Една институция. Единна система. Пълен контрол.'),
  ('institution_address',     ''),
  ('institution_email',       'info@pig-ohridski.bg'),
  ('application_prefix',      'PIG'),
  ('retention_months',        '60'),
  ('registration_open',       'true')
on conflict (key) do nothing;
