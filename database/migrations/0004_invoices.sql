-- 0004_invoices.sql
-- Модул „Фактури“: фактури, проформа фактури, дебитни и кредитни известия,
-- сторно, контрагенти и редове на документите.
-- Изпълнява се след 0001_schema.sql, 0002_rls.sql и 0003_protected_superadmin.sql.

create table if not exists public.invoice_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 200),
  eik text,
  vat_number text,
  mol text,
  address text,
  city text,
  country text not null default 'България',
  email text,
  phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  doc_type text not null check (doc_type in ('invoice','proforma','debit_note','credit_note','storno')),
  status text not null default 'draft' check (status in ('draft','issued','paid','cancelled')),
  issue_date date not null default current_date,
  due_date date,

  client_id uuid references public.invoice_clients(id) on delete set null,
  -- Снимка на получателя към момента на издаване (документът не се променя
  -- при по-късна редакция на контрагента).
  client_name text not null,
  client_eik text,
  client_vat text,
  client_mol text,
  client_address text,
  client_city text,
  client_country text not null default 'България',
  client_email text,

  -- Снимка на издателя от системните настройки.
  supplier_name text not null,
  supplier_eik text,
  supplier_vat text,
  supplier_address text,
  supplier_iban text,
  supplier_bank text,
  supplier_mol text,

  currency text not null default 'EUR' check (currency in ('EUR','BGN')),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),

  payment_method text not null default 'bank' check (payment_method in ('bank','cash','card','other')),
  basis text,
  note text,
  related_invoice_id uuid references public.invoices(id) on delete set null,

  created_by uuid references public.users(id) on delete set null,
  issued_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Номерът е уникален в рамките на вида документ (отделни серии).
  unique (doc_type, number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 1,
  name text not null,
  unit text not null default 'бр.',
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  line_subtotal numeric(14,2) not null default 0,
  line_vat numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_issue_date on public.invoices (issue_date desc);
create index if not exists idx_invoices_status on public.invoices (status);
create index if not exists idx_invoices_client on public.invoices (client_id);
create index if not exists idx_invoice_items_invoice on public.invoice_items (invoice_id, position);
create index if not exists idx_invoice_clients_name on public.invoice_clients (lower(name));

-- updated_at се поддържа автоматично.
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_touch on public.invoices;
create trigger trg_invoices_touch
  before update on public.invoices
  for each row execute function public.tg_touch_updated_at();

drop trigger if exists trg_invoice_clients_touch on public.invoice_clients;
create trigger trg_invoice_clients_touch
  before update on public.invoice_clients
  for each row execute function public.tg_touch_updated_at();

-- ─────────────────────────── RLS ───────────────────────────
-- Достъпът е само за служебни профили с право invoices.view / invoices.manage.
-- Приложението работи със service роля от сървъра, затова тези правила пазят
-- главно от директен достъп с anon ключа.

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_clients enable row level security;

drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_staff_read on public.invoices
  for select using (
    exists (
      select 1 from public.user_roles r
       where r.user_id = auth.uid()
         and r.role_key in ('superadmin','director','deputy_director')
    )
  );

drop policy if exists invoice_items_staff_read on public.invoice_items;
create policy invoice_items_staff_read on public.invoice_items
  for select using (
    exists (
      select 1 from public.user_roles r
       where r.user_id = auth.uid()
         and r.role_key in ('superadmin','director','deputy_director')
    )
  );

drop policy if exists invoice_clients_staff_read on public.invoice_clients;
create policy invoice_clients_staff_read on public.invoice_clients
  for select using (
    exists (
      select 1 from public.user_roles r
       where r.user_id = auth.uid()
         and r.role_key in ('superadmin','director','deputy_director')
    )
  );

-- ─────────────── Права в RBAC (огледало на lib/permissions/roles.ts) ───────────────

insert into public.permissions (key, description)
values
  ('invoices.view', 'Преглед на фактури'),
  ('invoices.manage', 'Издаване на фактури')
on conflict (key) do nothing;

insert into public.role_permissions (role_key, permission_key)
select r, p
  from (values ('superadmin'), ('director'), ('deputy_director')) as roles(r)
 cross join (values ('invoices.view'), ('invoices.manage')) as perms(p)
on conflict do nothing;
