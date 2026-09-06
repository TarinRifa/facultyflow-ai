# FacultyFlow AI — Implementation Phases and TODO Checklist

## Phase 0 — Decisions and Setup

- [x] Receive plan approval.
- [ ] Confirm the exact Gemini model identifier and supported SDK/tool-calling interface.
- [ ] Rotate the Gemini key that was shared and supply the replacement through local environment configuration only.
- [x] Receive Supabase project URL and anon/publishable key.
- [x] Use email/password authentication and a guarded demo-data script.
- [x] Use Asia/Dhaka and optional date-and-time deadlines for the MVP.
- [x] Use the approved project name “FacultyFlow AI.”
- [x] Initialize Git and scaffold the Next.js TypeScript project.
- [x] Add `.env.example`, `.gitignore`, linting, formatting, and test scripts.

**Exit criterion:** the project starts locally, environment variables validate, and no secrets are tracked.

## Phase 1 — Database and Authentication

- [x] Create validated text constraints for priority and status.
- [x] Create `profiles` and `tasks` migrations.
- [x] Add foreign keys, checks, timestamps, and indexes.
- [x] Enable and test RLS policies.
- [x] Configure Supabase Auth integration.
- [x] Build login/logout and protected route handling.
- [x] Create typed Supabase browser and server clients.
- [x] Create a guarded repeatable demo-data seed path.

**Exit criterion:** two test users can sign in and cannot see or mutate each other’s tasks.

## Phase 2 — Task CRUD

- [x] Define shared task types and Zod schemas.
- [x] Implement authenticated task query service.
- [x] Implement list endpoint with pagination, sorting, search, and combined filters.
- [x] Implement create endpoint.
- [x] Implement retrieve/update endpoint.
- [x] Implement complete/reopen behavior and `completed_at` consistency.
- [x] Implement delete endpoint with ownership checks.
- [x] Build task list and responsive card view.
- [x] Build create/edit form with validation.
- [x] Add complete/reopen and delete confirmation interactions.
- [x] Add loading, empty, success, and error states.

**Exit criterion:** the full task lifecycle works and persists across refreshes.

## Phase 3 — Search, Filters, and Dashboard

- [x] Add debounced text search.
- [x] Add status, priority, course/category, overdue, and date filters.
- [x] Add sorting and clear-all behavior.
- [x] Make filter combinations deterministic and shareable through the URL.
- [x] Implement shared date-range helpers with timezone tests.
- [x] Implement dashboard aggregate service and endpoint.
- [x] Build pending, completed, upcoming, and overdue cards.
- [x] Build today/upcoming list and quick-add action.
- [x] Verify dashboard changes after CRUD operations.

**Exit criterion:** all dashboard numbers agree with equivalent filtered task views.

## Phase 4 — Gemini Tool-Calling Assistant

- [ ] Install and configure the selected official Gemini SDK server-side.
- [ ] Define the assistant system instruction and response style.
- [ ] Implement validated `search_tasks` tool.
- [ ] Implement validated `get_task_summary` tool.
- [ ] Implement deterministic priority scoring and `get_priority_recommendations` tool.
- [ ] Implement bounded tool-calling loop in `/api/chat`.
- [ ] Require at least one tool result for task-specific factual answers.
- [ ] Handle empty results, invalid arguments, API failures, and timeouts.
- [ ] Build chat interface, suggested prompts, loading state, and retry state.
- [ ] Optionally render returned task references as clickable cards.
- [ ] Test that edited/completed tasks change subsequent answers.
- [ ] Test prompt injection contained inside task titles/descriptions.

**Exit criterion:** the five target questions produce current, accurate, user-scoped answers without exposing database access to the model.

## Phase 5 — Quality and Demo Readiness

- [ ] Run automated unit, API, component, and end-to-end tests.
- [ ] Perform accessibility and responsive checks.
- [ ] Review secret handling and confirm RLS in the hosted project.
- [ ] Add friendly error boundaries and fallback states.
- [ ] Seed a polished faculty demo scenario.
- [ ] Deploy preview/production builds.
- [ ] Run the complete demo script on deployed infrastructure.
- [ ] Capture backup screenshots/video and prepare a non-AI fallback explanation.
- [ ] Freeze nonessential features before presentation.

**Exit criterion:** the demo passes twice from a clean session and recovery paths are understood.

## Prioritization if Time Is Tight

### Must Have

- Authentication and user isolation.
- Task CRUD and completion.
- Required fields, search, core filters.
- Four dashboard counts.
- Three read-only AI tools and target prompts.
- Deployed, seeded demo.

### Should Have

- Responsive polish, URL-backed filters, clickable task references in chat.
- Strong automated coverage for date boundaries and RLS behavior.
- Priority/category visual breakdown.

### Could Have

- Streaming chat responses.
- Dark mode.
- Persisted chat history.
- CSV export or calendar links.

### Won’t Have in MVP

- AI task mutations, integrations, notifications, collaboration, recurring tasks, and attachments.

## Definition of Done

- [ ] Behavior matches the approved plan.
- [ ] Type checking, linting, and tests pass.
- [ ] No secret appears in Git, client bundles, logs, screenshots, or fixtures.
- [ ] RLS and server ownership checks are verified.
- [ ] Loading, empty, error, and success states exist for critical flows.
- [ ] Date behavior is consistent with the chosen timezone.
- [ ] README contains setup, migration, run, test, and deployment instructions.
- [ ] The demo story is repeatable and fits the presentation window.
