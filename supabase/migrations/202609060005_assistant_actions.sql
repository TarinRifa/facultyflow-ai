begin;
create table public.assistant_actions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.faculty_accounts(id) on delete cascade,
 kind text not null check(kind in ('task.create','task.delete','course.create','course.delete','quiz.create','quiz.delete')),
 payload jsonb not null check(jsonb_typeof(payload)='object'), summary text not null check(char_length(summary) between 3 and 500),
 status text not null default 'pending' check(status in ('pending','approved','cancelled','expired','failed')),
 expires_at timestamptz not null default (now()+interval '15 minutes'), created_at timestamptz not null default now(), executed_at timestamptz
);
create index assistant_actions_user_pending on public.assistant_actions(user_id,status,expires_at);
alter table public.assistant_actions enable row level security;
revoke all on public.assistant_actions from anon,authenticated;
commit;
