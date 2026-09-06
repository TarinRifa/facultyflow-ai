begin;
alter table public.generated_questions
  add column question_type text not null default 'short_answer' check(question_type in ('short_answer','essay','multiple_choice','true_false')),
  add column options jsonb not null default '[]' check(jsonb_typeof(options)='array'),
  add column answer text not null default '' check(char_length(answer)<=5000),
  add column position integer not null default 0 check(position>=0),
  add column quality_pending boolean not null default false;
commit;
