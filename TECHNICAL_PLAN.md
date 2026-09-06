# FacultyFlow AI — Technical Plan

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Web application | Next.js with App Router and TypeScript | One deployable project for UI, server routes, and backend logic |
| UI | Tailwind CSS plus a small accessible component set | Fast, consistent hackathon implementation |
| Forms/validation | React Hook Form and Zod | Clear client/server validation with shared schemas |
| Database | Supabase PostgreSQL | Managed Postgres, migrations, dashboard, and row-level security |
| Authentication | Supabase Auth | Simple identity and direct RLS integration |
| Database access | Supabase server client | Minimal infrastructure and typed queries |
| AI | Google Gemini API, server-side only | Native function/tool calling and concise summarization |
| Tests | Vitest, React Testing Library, Playwright | Unit, component, and critical end-to-end coverage |
| Deployment | Vercel for Next.js; Supabase hosted project | Low-setup hackathon deployment |

The exact compatible Gemini SDK and model identifier should be confirmed before implementation. The provided `GEMINI_MODEL` value appears incomplete because it ends in `-`.

## Application Structure

Proposed route-level organization:

```text
app/
  (auth)/login/
  (app)/dashboard/
  (app)/tasks/
  (app)/assistant/
  api/tasks/
  api/dashboard/
  api/chat/
components/
  tasks/
  dashboard/
  assistant/
lib/
  supabase/
  ai/
  validation/
  domain/
supabase/
  migrations/
tests/
```

This is a proposed implementation layout, not a commitment to create every folder.

## Frontend and UI Plan

### Information Architecture

- **Dashboard:** summary cards, urgent work, and quick-add action.
- **Tasks:** searchable/filterable task list with task editor.
- **AI Assistant:** chat history for the current session and suggested prompts.
- **Account menu:** faculty identity and sign out.

### Main Layout

- Desktop: left navigation, header, content area, optional assistant shortcut.
- Mobile/tablet: compact top navigation and stacked content.
- Consistent page width, restrained university-professional palette, readable typography, and accessible contrast.

### Task Experience

- Quick-add button opens a modal or side panel.
- Required title is first; advanced fields remain compact.
- Task cards/rows show title, course/category, due date, priority badge, and status.
- Overdue dates use both color and text/icon so meaning is not color-only.
- Complete/reopen is immediate; delete requires confirmation.
- Filters are reflected in the URL where practical so views are reproducible.
- Empty, loading, error, and no-search-results states are designed explicitly.

### Dashboard Definitions

- **Pending:** status is `pending` or `in_progress`.
- **Completed:** status is `completed`.
- **Upcoming:** not completed, has a due date from now through the next seven calendar days, inclusive.
- **Overdue:** not completed and due date/time is earlier than the current time.

All date calculations should use one documented application timezone. The initial default is the faculty user’s configured timezone; if profiles are deferred, use a single configured timezone.

### Accessibility

- Keyboard-operable forms, filters, dialogs, and chat.
- Proper labels, focus management, error text, and status announcements.
- Do not rely on color alone for priority/status.
- Responsive behavior tested at common mobile and desktop widths.

## Backend and API Plan

Next.js is the backend as well as the frontend host. Route handlers and server-side domain functions validate input, authenticate users, query Supabase, and call Gemini. Secrets never reach browser bundles.

### Proposed Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/tasks` | List/search/filter/sort the current user’s tasks |
| `POST` | `/api/tasks` | Create a validated task |
| `GET` | `/api/tasks/:id` | Retrieve one owned task |
| `PATCH` | `/api/tasks/:id` | Update fields or status |
| `DELETE` | `/api/tasks/:id` | Delete one owned task |
| `GET` | `/api/dashboard` | Return dashboard counts and urgent items |
| `POST` | `/api/chat` | Run the authenticated Gemini tool-calling loop |

Server actions could replace some CRUD endpoints, but route handlers are preferred for a clear API boundary and straightforward testing. Shared service functions will prevent dashboard and AI queries from duplicating business rules.

### API Rules

- Require a valid Supabase session for every data endpoint.
- Validate parameters and bodies with Zod.
- Never accept `user_id` from the browser as authorization.
- Apply ownership in the query and enforce it again with RLS.
- Use stable error responses without leaking SQL, credentials, or internal prompts.
- Cap page sizes, search length, chat message length, tool iterations, and returned task counts.
- Add basic request logging with secrets and task descriptions redacted where appropriate.

## Database Design

### `profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key; references `auth.users(id)` |
| `display_name` | `text` | Faculty display name |
| `timezone` | `text` | IANA timezone, such as `Asia/Dhaka` |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated automatically/application-side |

### `tasks`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key, generated UUID |
| `user_id` | `uuid` | Required; references `auth.users(id)` with cascade delete |
| `title` | `text` | Required, trimmed, bounded length |
| `description` | `text` | Optional, bounded length |
| `due_at` | `timestamptz` | Optional |
| `priority` | enum/text | `low`, `medium`, `high`, `urgent` |
| `category` | `text` | Optional faculty category, e.g. Research |
| `course_code` | `text` | Optional normalized code, e.g. CSE101 |
| `status` | enum/text | `pending`, `in_progress`, `completed` |
| `completed_at` | `timestamptz` | Set only while completed |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated on each mutation |

Category and course code are separate: a task may be “Teaching” and belong to “CSE101.” The UI may label these compactly, but separating them enables accurate AI filtering.

### Constraints and Indexes

- Check allowed priority and status values.
- Ensure title is non-empty after trimming.
- Composite indexes on `(user_id, status)`, `(user_id, due_at)`, and `(user_id, course_code)`.
- Search may begin with case-insensitive matching; add Postgres trigram/full-text indexing only if needed.
- Trigger or application logic keeps `updated_at` current.

### Row-Level Security

- Enable RLS on `profiles` and `tasks`.
- Users can select/update only their own profile.
- Users can select/insert/update/delete only tasks where `user_id = auth.uid()`.
- The browser receives only the public Supabase URL and anon/publishable key.
- A service-role key is unnecessary for normal user task flows and should not be used unless a specific server-only administrative requirement appears.

## AI Chatbot and Tool-Calling Architecture

### Request Flow

1. Browser sends the current user message and limited recent chat context to `/api/chat`.
2. Server authenticates the Supabase session and derives the user ID.
3. Server sends Gemini a concise system instruction plus read-only tool definitions.
4. Gemini chooses a tool and structured arguments.
5. Server validates arguments, executes a scoped domain query, and returns normalized JSON to Gemini.
6. Gemini may request another tool within a small iteration limit.
7. Gemini produces a faculty-friendly answer grounded in tool results.
8. Server returns the answer and optional structured task references for UI display.

Gemini never receives database credentials and never generates or executes SQL. The server owns all query construction.

### Proposed Read-Only Tools

#### `search_tasks`

Arguments: search text, statuses, priorities, category, course code, due-from, due-to, overdue-only, limit, and sort. Returns matching task fields needed for an answer.

#### `get_task_summary`

Arguments: optional date range and course/category filters. Returns counts by status, priority, overdue state, and course/category.

#### `get_priority_recommendations`

Arguments: target date and optional course/category. Server ranks active tasks using a documented score; Gemini explains the returned ordering.

Suggested deterministic score:

- Overdue: +100.
- Due today: +60.
- Due within three days: +35.
- Priority: urgent +40, high +25, medium +10, low +0.
- In progress: +5.
- No due date: no urgency bonus.

Tie-break by earliest due date, then oldest creation date. The answer should identify that recommendations are based on due dates and declared priority, not an objective measure of importance.

### Grounding and Safety Rules

- System prompt requires tools for any claim about the user’s tasks.
- Tool functions inject the authenticated user ID internally.
- Validate all function arguments before querying.
- Return only necessary fields and enforce record limits.
- If a tool fails, give a clear retry message rather than guessing.
- If the user asks the assistant to edit/delete tasks, explain that the MVP assistant is read-only and direct them to the task UI.
- Treat task text as untrusted data; it must not override system/tool instructions.
- Do not expose tool internals, secrets, or raw database errors.

### Conversation Storage

For the MVP, chat can remain session-local in the browser and send only a bounded recent history with each request. Persisted conversations are a post-MVP feature; avoiding them reduces schema, privacy, and deletion work.

## Security and Configuration

- Store `GEMINI_API_KEY`, Supabase URL, and relevant server credentials in local `.env.local` and deployment secret settings.
- Commit only `.env.example` with placeholder values.
- Rotate any credential shared in chat or otherwise exposed.
- Keep Gemini calls in server-only modules.
- Use Supabase RLS as the final authorization boundary.
- Add secure headers and avoid rendering task text as raw HTML.
- Apply a small per-user chat rate limit if deployment infrastructure permits.

## Performance and Reliability

- Fetch dashboard counts with efficient aggregate queries.
- Use optimistic UI only for low-risk task status toggles; reconcile failures visibly.
- Abort or time out slow AI calls and provide a retry action.
- Limit tool results and summarize larger result sets deterministically before model use.
- Avoid caching private API responses across users.

