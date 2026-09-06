begin;
create table public.faculty_accounts (
  id uuid primary key default gen_random_uuid(), email text not null unique check (email = lower(btrim(email)) and char_length(email) between 5 and 254),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100), password_hash text not null check (char_length(password_hash) between 40 and 100),
  timezone text not null default 'Asia/Dhaka' check (timezone = 'Asia/Dhaka'), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.faculty_sessions (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.faculty_accounts(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64), expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index faculty_sessions_account on public.faculty_sessions(account_id);
create index faculty_sessions_expiry on public.faculty_sessions(expires_at);
drop trigger if exists faculty_profile_created on auth.users;
drop function if exists public.create_faculty_profile();
drop table if exists public.profiles cascade;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
revoke all on public.tasks from anon, authenticated;
alter table public.tasks alter column user_id drop default;
alter table public.tasks drop constraint if exists tasks_user_id_fkey;
alter table public.tasks add constraint tasks_faculty_account_fkey foreign key(user_id) references public.faculty_accounts(id) on delete cascade;
alter table public.faculty_accounts enable row level security;
alter table public.faculty_sessions enable row level security;
revoke all on public.faculty_accounts, public.faculty_sessions from anon, authenticated;
commit;
