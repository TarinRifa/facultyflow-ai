begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=100),
 timezone text not null default 'Asia/Dhaka' check(timezone = 'Asia/Dhaka'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 description text not null default '' check(char_length(description)<=4000),
 due_at timestamptz,
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 category text not null default '' check(char_length(category)<=60),
 course_code text not null default '' check(char_length(course_code)<=30),
 status text not null default 'pending' check(status in ('pending','in_progress','completed')),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 priority_rank integer generated always as (case priority when 'urgent' then 4 when 'high' then 3 when 'medium' then 2 else 1 end) stored,
 constraint completion_consistent check ((status='completed') = (completed_at is not null))
);
create index tasks_user_status on public.tasks(user_id,status);
create index tasks_user_due on public.tasks(user_id,due_at);
create index tasks_user_course on public.tasks(user_id,course_code);
create function public.maintain_task() returns trigger language plpgsql set search_path = '' as $$
begin
 new.title := btrim(new.title);
 new.course_code := upper(btrim(new.course_code));
 new.updated_at := now();
 if TG_OP='UPDATE' then
  new.user_id := old.user_id;
  new.created_at := old.created_at;
 end if;
 if new.status='completed' then
  if TG_OP='UPDATE' and old.status='completed' then new.completed_at:=old.completed_at;
  else new.completed_at:=now(); end if;
 else new.completed_at:=null; end if;
 return new;
end $$;
create trigger tasks_maintain before insert or update on public.tasks for each row execute function public.maintain_task();
create function public.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at:=now(); new.created_at:=old.created_at; return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_profile();
create function public.create_faculty_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name','Faculty member'),100));
 return new;
end $$;
create trigger faculty_profile_created after insert on auth.users for each row execute function public.create_faculty_profile();
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data->>'display_name','Faculty member'),100) from auth.users on conflict do nothing;
alter table public.tasks enable row level security;
alter table public.profiles enable row level security;
revoke all on public.tasks, public.profiles from anon;
grant select,insert,update,delete on public.tasks to authenticated;
grant select,update on public.profiles to authenticated;
create policy tasks_select on public.tasks for select to authenticated using ((select auth.uid())=user_id);
create policy tasks_insert on public.tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy tasks_update on public.tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy tasks_delete on public.tasks for delete to authenticated using ((select auth.uid())=user_id);
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
commit;
