# FacultyFlow AI

FacultyFlow AI is a faculty-focused task manager built with Next.js 16, React 19, Tailwind CSS, Supabase Auth, and Supabase PostgreSQL.

## Implemented

- Email/password registration, login, logout, and protected routes
- Per-user task storage protected by PostgreSQL row-level security
- Create, view, edit, complete, reopen, and delete tasks
- Task title, description, deadline, priority, category, course code, and status
- Debounced search, combined filters, sorting, pagination, and URL-backed task views
- Dashboard counts for pending, completed, upcoming, and overdue work
- Responsive desktop/mobile UI and Asia/Dhaka deadline handling
- Next.js route-handler backend under `/api/tasks` and `/api/dashboard`

Gemini tool calling is Phase 4 and has not been implemented yet.

## Run locally

1. Copy `.env.example` to `.env.local` and add the current Supabase project values.
2. Install packages with `npm install`.
3. Apply `supabase/migrations/202609060001_facultyflow.sql` through Supabase SQL Editor, or configure `DATABASE_URL` plus `SUPABASE_DB_CA_PATH` and run `npm run db:migrate`.
4. Start the app with `npm run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

The migration has already been applied to the configured development Supabase project. `.env.local`, database certificates, build output, and test artifacts are excluded from Git.

## Checks

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The end-to-end suite creates temporary accounts in the configured development project, verifies task persistence and cross-user isolation, and removes those accounts afterward.

## Demo data

Set `DEMO_EMAIL` and `DEMO_PASSWORD` in your local environment for a dedicated empty demo account, then run:

```text
node --env-file=.env.local scripts/seed-demo.mjs --confirm-demo
```

The seed command refuses to overwrite an account that already has tasks.

## Planning documents

- [Overview and MVP](PROJECT_OVERVIEW.md)
- [UI, API, database, and AI architecture](TECHNICAL_PLAN.md)
- [Implementation phases and checklist](IMPLEMENTATION_PLAN.md)
- [Testing and hackathon demo](TESTING_AND_DEMO_PLAN.md)
- [Owner requirements](REQUIREMENTS_FROM_ME.md)
