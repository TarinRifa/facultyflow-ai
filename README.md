# FacultyFlow AI

FacultyFlow AI is a faculty-focused task manager built with Next.js 16, React 19, Tailwind CSS, custom database-backed email/password authentication, and Supabase PostgreSQL.

## Implemented

- Email/password registration, login, logout, and protected routes
- Per-user task storage protected by PostgreSQL row-level security
- Create, view, edit, complete, reopen, and delete tasks
- Task title, description, deadline, priority, category, course code, and status
- Debounced search, combined filters, sorting, pagination, and URL-backed task views
- Dashboard counts for pending, completed, upcoming, and overdue work
- Responsive desktop/mobile UI and Asia/Dhaka deadline handling
- Next.js route-handler backend under `/api/tasks` and `/api/dashboard`

Phase 4 adds the AI Assistant at `/assistant`: live task search, workload summaries, deterministic priority recommendations, task links, and retry states. The authenticated `/api/chat` endpoint uses the official server-only `@google/genai` SDK.

## Run locally

1. Copy `.env.example` to `.env.local` and add the current database connection values.
2. Install packages with `npm install`.
3. Configure `DATABASE_URL`, then run `npm run db:migrate` followed by `npm run db:migrate:auth`.
4. Start the app with `npm run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

The migrations have already been applied to the configured development Supabase project. `.env.local`, build output, and test artifacts are excluded from Git. The committed certificate is Supabase's public CA certificate and contains no private credentials.

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

## Gemini assistant

Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite` in ignored `.env.local`, then restart the server. Configure the same server-side secrets in your deployment environment. Never prefix these values with `NEXT_PUBLIC_`.

The assistant is read-only. Every response requires a successful fresh, user-scoped lookup. Conversation history stays in the current page session; only six recent messages are sent for context. SQL is parameterized and built by the server, and neither database credentials nor user IDs are sent to Gemini. Task titles/descriptions and labels are untrusted data. Tool results include at most 20 task records, with descriptions truncated to 1,000 characters. Summary totals are exact; course/category breakdowns show at most 50 groups each.

Priority scores use overdue +100, otherwise today +60 or the next three calendar days +35; urgent +40, high +25, medium +10, low +0; in-progress +5. Completed tasks are excluded. Ties use earliest deadline, oldest creation, then ID. A supplied target date means midnight in Asia/Dhaka; the default is the current instant. “This week” means Monday through Sunday.

Requests allow four model rounds and six tool calls, with a 45-second overall response deadline and 20-second provider timeout. Invalid arguments can be corrected within that budget; database/provider failures return sanitized retry messages. There is no distributed rate limiter in this MVP.

Run `npx playwright test tests/e2e/assistant.spec.ts` for the live Phase 4 check. It requires working database/Gemini settings, makes billable Gemini calls, creates two temporary accounts, and removes them afterward. It checks the five suggested questions, cross-account isolation, edited/completed tasks, task-text injection, mobile layout, and UI retry. Unit tests use mocked providers and run without external services.

## Faculty assessment workflow

The authenticated `/faculty` workspace connects six features in one faculty-controlled journey: assignment indicators, syllabus assessment planning, previous-paper semantic matching, question generation and quality checks, persisted quiz alerts, and a multi-course roadmap. All UI actions call `/api/faculty` or `/api/faculty/[resource]`; those handlers derive the faculty ID from the signed session and enforce course ownership in every query.

Apply its additive PostgreSQL migrations after the authentication migration:

```text
npm run db:migrate:faculty
```

Uploads accept PDF, DOCX, and UTF-8 TXT files up to 8 MB. Extracted content is capped at 120,000 characters, duplicate content is rejected by SHA-256-backed unique indexes, and uploaded binaries are not retained. Configure `GEMINI_EMBEDDING_MODEL=gemini-embedding-001` to override the default semantic embedding model.

Gemini produces analysis and recommendations only. The server validates structured results and never accepts ownership IDs from AI output. Assessment dates must remain within the owned course semester, course weights cannot exceed 100%, marks and percentages are bounded, roadmap labels are mapped back to owned database records, and faculty edits reset a question to draft while recalculating its relevance and previous-question similarity. AI-writing likelihood is always displayed as an indicator rather than proof.

Run the live six-feature journey with:

```text
npx playwright test tests/e2e/faculty-workflow.spec.ts
```

This test uses temporary faculty accounts and real PostgreSQL/Gemini calls, covers cross-account denial, uploads and duplicate protection, assessment drafting and approval, semantic matching, question quality checks and editing, notification read state, roadmap generation, and responsive rendering. The accounts and their related records are deleted afterward.

## Assistant-managed records and demo data

The AI Assistant can propose creating or deleting owned tasks, courses, and quizzes with the `manage_task`, `manage_course`, and `manage_quiz` tools. Tool calls do not mutate data. They save a short-lived action proposal in `assistant_actions`, resolve deletion targets under the authenticated faculty account, and show an Approve/Cancel card. `/api/chat/actions` rechecks ownership and executes an approved action once inside a database transaction. Proposals expire after 15 minutes and cannot be replayed. Deleting a course warns that its related faculty-workflow records cascade.

Seed the connected faculty demo data with:

```text
SEED_FACULTY_EMAIL=tarinrifa@gmail.com npm run db:seed:faculty
```

On PowerShell, set `$env:SEED_FACULTY_EMAIL` first or omit it to use `tarinrifa@gmail.com`. The repeatable seed creates curriculum design, assessment, grading, course management, academic quality, research, course-planning, and quiz tasks plus three courses, syllabi, progress data, and approved quizzes.
