# Requirements From the Project Owner

No implementation should begin until this list is answered and the plan is approved. Secrets must be supplied through local/deployment environment settings, never committed to Markdown or source control.

## Required Before Implementation

### 1. Plan Approval

- [ ] Approve the project name **FacultyFlow AI**, or provide the final name.
- [ ] Approve the MVP boundaries, especially that the AI assistant is read-only.
- [ ] Approve Next.js App Router as both the frontend and backend/API layer.

### 2. Gemini Configuration

- [ ] **Rotate the Gemini API key shared in the prompt.** Treat it as exposed because it appeared in conversation text. Do not reuse it in the repository.
- [ ] Place the replacement key locally as `GEMINI_API_KEY` in `.env.local` when implementation starts.
- [ ] Confirm the exact model identifier. The supplied value `gemini-3.5-flash-` appears incomplete due to its trailing hyphen.
- [ ] Confirm the Google AI environment/account has access to that model and function calling.
- [ ] State any usage/budget limits required for the demo.

Do not paste the replacement secret into a planning document or commit. If sharing through chat is unavoidable, it should still be rotated afterward; entering it directly into the local environment is preferred.

### 3. Supabase Project

- [ ] Say whether an existing Supabase project should be used or a new one should be created.
- [ ] Provide/configure `NEXT_PUBLIC_SUPABASE_URL` locally.
- [ ] Provide/configure the Supabase anon/publishable key locally as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the current recommended variable name for the selected Supabase setup).
- [ ] Confirm permission to create migrations, tables, indexes, triggers, and RLS policies.
- [ ] Confirm whether Supabase CLI is already installed/logged in, or whether SQL will be applied through the Supabase dashboard.
- [ ] Do not provide a service-role key unless a later server-only feature specifically requires it.

### 4. Authentication Decision

Choose one MVP option:

- [ ] Email/password login with one prepared demo faculty account (recommended for reliability).
- [ ] Magic-link login (requires reliable email during the demo).
- [ ] Google OAuth (requires provider and redirect configuration).

Also confirm whether public sign-up is enabled or accounts are pre-created.

### 5. Product Decisions

- [ ] Confirm the primary timezone (suggested default: `Asia/Dhaka`) and whether users may change it.
- [ ] Confirm whether tasks need date-only deadlines or exact date-and-time deadlines (recommended: optional exact date/time, displayed clearly in the chosen timezone).
- [ ] Approve priority values: `low`, `medium`, `high`, `urgent`.
- [ ] Approve status values: `pending`, `in_progress`, `completed`.
- [ ] Confirm that category and course code should be separate fields.
- [ ] Provide any university name, logo, colors, or branding rules; otherwise a neutral academic theme will be used.

### 6. Local and Deployment Setup

- [ ] Confirm the preferred package manager: npm, pnpm, yarn, or bun (default: npm).
- [ ] Confirm the supported Node.js version (recommended: current supported LTS compatible with the chosen Next.js release).
- [ ] Confirm deployment target (recommended: Vercel) and whether a project already exists.
- [ ] Provide access/configuration for deployment environment variables when deployment begins.
- [ ] Confirm whether Git should be initialized in this currently blank, non-Git workspace.

## Helpful but Not Blocking

- [ ] Hackathon deadline and expected demo duration.
- [ ] Team size and who will work on design, backend, or presentation.
- [ ] Any judging criteria or mandatory technologies.
- [ ] Sample real-world faculty task categories/course-code formats, without sensitive data.
- [ ] Whether you want a light theme, dark theme, or both.
- [ ] Accessibility or university policy requirements beyond standard good practice.

## Proposed Environment Variable Template

When implementation is approved, an `.env.example` containing placeholders—not real values—should document:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
APP_TIMEZONE=Asia/Dhaka
```

## Approval Reply Template

You can reply with:

```text
Plan approved.
Project name: FacultyFlow AI / [replacement]
Auth: email-password / magic link / Google
Sign-up: enabled / pre-created accounts only
Timezone: Asia/Dhaka / [replacement]
Deadlines: date only / date and time
Category and course code: separate / combined
Package manager: npm / [replacement]
Deployment: Vercel / [replacement]
Git initialization: yes / no
Supabase project: existing / create new
Supabase configuration has been added locally: yes / no
New Gemini configuration has been added locally: yes / no
Confirmed Gemini model ID: [exact ID]
Hackathon deadline/demo length: [details]
Branding: [details or neutral academic theme]
```

