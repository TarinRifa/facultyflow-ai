begin;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.faculty_accounts(id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 2 and 30),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  semester_start date not null,
  semester_end date not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (semester_end > semester_start), unique(user_id,code)
);
create table public.syllabi (
  id uuid primary key default gen_random_uuid(), course_id uuid not null unique references public.courses(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 20 and 100000),
  clos jsonb not null default '[]' check (jsonb_typeof(clos)='array'),
  topics jsonb not null default '[]' check (jsonb_typeof(topics)='array'),
  progress_percent numeric(5,2) not null default 0 check(progress_percent between 0 and 100),
  source_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.class_routines (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6), start_time time not null, end_time time not null,
  room text not null default '' check(char_length(room)<=80), check(end_time>start_time), unique(course_id,weekday,start_time)
);
create table public.assessments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check(kind in ('quiz','midterm','final')), title text not null check(char_length(btrim(title)) between 2 and 160),
  scheduled_on date not null, marks numeric(7,2) not null check(marks>0 and marks<=1000),
  weight_percent numeric(5,2) not null check(weight_percent>0 and weight_percent<=100),
  topics jsonb not null default '[]' check(jsonb_typeof(topics)='array'), clos jsonb not null default '[]' check(jsonb_typeof(clos)='array'),
  rationale text not null default '' check(char_length(rationale)<=2000), status text not null default 'draft' check(status in ('draft','approved')),
  source text not null default 'ai' check(source in ('ai','faculty')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(course_id,kind,title,scheduled_on)
);
create table public.assignment_analyses (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  filename text not null, file_type text not null check(file_type in ('pdf','docx','txt')), text_content text not null check(char_length(text_content)<=120000),
  ai_likelihood numeric(5,2) not null check(ai_likelihood between 0 and 100), similarity_percent numeric(5,2) not null check(similarity_percent between 0 and 100),
  flags jsonb not null default '[]' check(jsonb_typeof(flags)='array'), embedding double precision[], matched_analysis_id uuid references public.assignment_analyses(id) on delete set null,
  disclaimer text not null, created_at timestamptz not null default now(), unique(course_id,filename,created_at)
);
create table public.previous_papers (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  year smallint not null check(year between 1990 and 2100), filename text not null, text_content text not null check(char_length(text_content)<=120000),
  created_at timestamptz not null default now(), unique(course_id,year,filename)
);
create table public.previous_questions (
  id uuid primary key default gen_random_uuid(), paper_id uuid not null references public.previous_papers(id) on delete cascade,
  question_text text not null check(char_length(btrim(question_text)) between 5 and 5000), embedding double precision[], created_at timestamptz not null default now(),
  unique(paper_id,question_text)
);
create table public.generated_questions (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null, question_text text not null check(char_length(btrim(question_text)) between 5 and 5000),
  assessment_type text not null check(assessment_type in ('quiz','midterm','final')), marks numeric(7,2) not null check(marks>0 and marks<=1000),
  difficulty text not null check(difficulty in ('easy','medium','hard')), clo text not null default '', syllabus_relevance numeric(5,2) not null check(syllabus_relevance between 0 and 100),
  previous_similarity numeric(5,2) not null check(previous_similarity between 0 and 100), matched_question_id uuid references public.previous_questions(id) on delete set null,
  status text not null default 'draft' check(status in ('draft','approved')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(course_id,question_text)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.faculty_accounts(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, assessment_id uuid references public.assessments(id) on delete cascade,
  kind text not null check(kind in ('countdown','readiness','coverage','conflict')), title text not null, message text not null,
  severity text not null check(severity in ('info','warning','urgent')), is_read boolean not null default false, fingerprint text not null,
  created_at timestamptz not null default now(), unique(user_id,fingerprint)
);
create table public.roadmap_runs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.faculty_accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.roadmap_runs(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, assessment_id uuid references public.assessments(id) on delete set null,
  recommended_on date not null, score numeric(7,2) not null check(score between 0 and 100), conflicts jsonb not null default '[]' check(jsonb_typeof(conflicts)='array'),
  rationale text not null check(char_length(rationale)<=2000), created_at timestamptz not null default now(), unique(run_id,course_id,assessment_id)
);
create index courses_user on public.courses(user_id);
create index assessments_course_date on public.assessments(course_id,scheduled_on);
create index analyses_course on public.assignment_analyses(course_id,created_at desc);
create index papers_course_year on public.previous_papers(course_id,year desc);
create index generated_course on public.generated_questions(course_id,status);
create index notifications_user_read on public.notifications(user_id,is_read,created_at desc);
create index roadmap_user on public.roadmap_runs(user_id,created_at desc);

create function public.touch_faculty_record() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
create trigger courses_touch before update on public.courses for each row execute function public.touch_faculty_record();
create trigger syllabi_touch before update on public.syllabi for each row execute function public.touch_faculty_record();
create trigger assessments_touch before update on public.assessments for each row execute function public.touch_faculty_record();
create trigger generated_questions_touch before update on public.generated_questions for each row execute function public.touch_faculty_record();

alter table public.courses enable row level security;
alter table public.syllabi enable row level security;
alter table public.class_routines enable row level security;
alter table public.assessments enable row level security;
alter table public.assignment_analyses enable row level security;
alter table public.previous_papers enable row level security;
alter table public.previous_questions enable row level security;
alter table public.generated_questions enable row level security;
alter table public.notifications enable row level security;
alter table public.roadmap_runs enable row level security;
alter table public.roadmap_items enable row level security;
revoke all on public.courses,public.syllabi,public.class_routines,public.assessments,public.assignment_analyses,public.previous_papers,public.previous_questions,public.generated_questions,public.notifications,public.roadmap_runs,public.roadmap_items from anon,authenticated;
commit;
