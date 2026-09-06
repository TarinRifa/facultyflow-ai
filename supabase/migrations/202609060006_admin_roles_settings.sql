begin;

alter table public.faculty_accounts
  add column if not exists role text not null default 'faculty'
  check (role in ('admin','faculty'));

insert into public.faculty_accounts(email,password_hash,display_name,role)
values(
  'tarinrifa@gmail.com',
  '$2b$12$YazvLxgaoZJjSKdT.mbPU.s2n66DgO4Z9VQj9G84CXKyjmv9y8HvO',
  'Tarin',
  'admin'
)
on conflict(email) do update set role='admin';

create table if not exists public.academic_settings (
  id boolean primary key default true check (id),
  semester_start date not null,
  semester_end date not null,
  assessment_rules text not null default '' check (char_length(assessment_rules) <= 10000),
  academic_rules text not null default '' check (char_length(academic_rules) <= 10000),
  updated_by uuid references public.faculty_accounts(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (semester_end > semester_start)
);

insert into public.academic_settings(
  id,semester_start,semester_end,assessment_rules,academic_rules
)
values(
  true,
  '2026-01-01',
  '2026-12-31',
  'Assessment weights for a course must total no more than 100%. Avoid overlapping major assessments and allow reasonable preparation time.',
  'Assessments must align with the approved syllabus, course learning outcomes, completed topics, and the institutional semester calendar.'
)
on conflict(id) do nothing;

alter table public.academic_settings enable row level security;
revoke all on public.academic_settings from anon,authenticated;

commit;
