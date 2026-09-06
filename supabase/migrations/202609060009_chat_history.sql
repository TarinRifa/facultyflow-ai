begin;
create table public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.faculty_accounts(id) on delete cascade,
  role text not null check(role in ('user','assistant')),
  text text not null,
  tasks jsonb not null default '[]',
  actions jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index chat_messages_user_history on public.chat_messages(user_id,id desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon,authenticated;
commit;
