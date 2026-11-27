-- 0003_protected_superadmin.sql
-- Защитени профили: суперадминистраторските акаунти не могат да бъдат
-- изтривани, деактивирани, понижавани или лишавани от роля през API.
-- Изпълнява се след 0001_schema.sql и 0002_rls.sql.

alter table public.users
  add column if not exists is_protected boolean not null default false;

comment on column public.users.is_protected is
  'Защитен профил — не се изтрива, деактивира или понижава. Задава се на суперадминистраторите.';

-- Всеки, който има роля superadmin, се заключва автоматично.
create or replace function public.tg_lock_superadmins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role_key = 'superadmin' then
    update public.users set is_protected = true where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_superadmins on public.user_roles;
create trigger trg_lock_superadmins
  after insert on public.user_roles
  for each row execute function public.tg_lock_superadmins();

-- Съществуващите суперадминистратори се заключват веднага.
update public.users u
   set is_protected = true
 where exists (
   select 1 from public.user_roles r
    where r.user_id = u.id and r.role_key = 'superadmin'
 );

-- Забрана за изтриване на защитен профил.
create or replace function public.tg_block_protected_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_protected then
    raise exception 'Защитен профил не може да бъде изтрит.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_block_protected_delete on public.users;
create trigger trg_block_protected_delete
  before delete on public.users
  for each row execute function public.tg_block_protected_delete();

-- Забрана за деактивиране и за смяна на защитата от друг профил.
create or replace function public.tg_block_protected_update()
returns trigger
language plpgsql
as $$
begin
  if old.is_protected then
    if new.is_active = false then
      raise exception 'Защитен профил не може да бъде деактивиран.';
    end if;
    if new.is_protected = false then
      raise exception 'Защитата на профила не може да бъде премахната.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_protected_update on public.users;
create trigger trg_block_protected_update
  before update on public.users
  for each row execute function public.tg_block_protected_update();

-- Забрана за премахване на ролята superadmin на защитен профил.
create or replace function public.tg_block_protected_role()
returns trigger
language plpgsql
as $$
declare
  is_locked boolean;
begin
  select is_protected into is_locked from public.users where id = old.user_id;
  if coalesce(is_locked, false) and old.role_key = 'superadmin' then
    raise exception 'Ролята на защитен суперадминистратор не може да бъде променяна.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_block_protected_role on public.user_roles;
create trigger trg_block_protected_role
  before delete on public.user_roles
  for each row execute function public.tg_block_protected_role();
