# FacultyFlow AI — Testing and Hackathon Demo Plan

## Testing Strategy

Testing focuses on the highest-risk promise: the chatbot and UI must agree because both use the same current, user-scoped task data.

### Unit Tests

- Task validation: required title, allowed statuses/priorities, length limits, optional dates.
- Date rules: today, this week, seven-day upcoming window, overdue boundary, completed exclusions, and timezone changes.
- Priority scoring: overdue, today, soon, explicit priority, ties, and no due date.
- Filter normalization: course code casing, empty filters, combined filters.
- Tool argument validation and result normalization.

### API and Integration Tests

- Unauthenticated calls receive an authorization error.
- User A cannot read, edit, complete, or delete User B’s task.
- CRUD writes persist and return validated shapes.
- Completing a task sets `completed_at`; reopening clears it.
- Search and every filter work alone and in combination.
- Dashboard totals match the database fixtures.
- AI tools apply the authenticated user ID internally and ignore any attempted user-ID override.
- Tool errors and timeouts return safe, actionable responses.

RLS should also be tested directly against Supabase with two users, not only mocked at the Next.js layer.

### Component Tests

- Task form validation and edit prepopulation.
- Task complete/reopen interaction.
- Delete confirmation.
- Filter controls and clear-all behavior.
- Dashboard cards for counts, zero states, and overdue state.
- Chat suggested prompts, loading, answer, empty, and error states.

### End-to-End Tests

1. Sign in, create a task, refresh, edit it, complete it, reopen it, and delete it.
2. Create tasks across courses/priorities/dates and verify search/filter results.
3. Verify all four dashboard counts from known fixtures.
4. Ask “What do I have due this week?” and verify referenced tasks.
5. Complete one returned task and ask again; verify it no longer appears as pending.
6. Ask “Show my CSE tasks” and verify no unrelated course tasks appear.
7. Ask for today’s priorities and verify the explanation agrees with the deterministic ranking.
8. Test a task description containing instruction-like text; verify it is treated only as data.

### Manual Quality Checks

- Keyboard-only navigation and visible focus.
- Screen-reader labels for forms, buttons, status, and chat updates.
- Mobile and desktop layouts.
- Slow network and Gemini failure behavior.
- Long titles/descriptions and empty optional fields.
- Browser console and server logs contain no secrets.

## Demo Dataset

Prepare one fictional faculty account with about eight tasks:

- One overdue urgent grading task for `CSE101`.
- One high-priority `CSE101` lecture task due today.
- Two tasks due later this week across different courses.
- One research task without a due date.
- One administrative meeting task.
- Two completed tasks.

Dates should be generated relative to demo day so “today,” “this week,” and “overdue” always work.

## Four-Minute Demo Script

### 1. Context and Dashboard — 30 seconds

Introduce FacultyFlow AI as a single task hub for teaching, research, and administration. Show pending, completed, upcoming, and overdue counts.

### 2. Task Workflow — 60 seconds

Create a high-priority course task, find it with search/filtering, edit its due date, and mark it complete. Point out that the dashboard updates from the stored data.

### 3. Grounded AI — 100 seconds

Ask:

1. “What do I have due this week?”
2. “Do I have anything overdue?”
3. “Show my CSE tasks.”
4. “What should I prioritize today?”

Briefly explain that Gemini selects structured backend tools; the server validates the request and queries Supabase under the signed-in user before Gemini writes the answer.

### 4. Live Consistency Proof — 30 seconds

Complete or change an overdue task in the task UI, then repeat the related AI question. The changed answer proves the assistant uses current database state rather than canned responses.

### 5. Close — 20 seconds

Reinforce faculty focus, safe user isolation, and the path to calendar/LMS integrations after the MVP.

## Demo Reliability Checklist

- [ ] Use a dedicated demo account with no sensitive information.
- [ ] Generate relative demo dates shortly before presenting.
- [ ] Confirm deployment environment variables and Supabase RLS.
- [ ] Warm the deployment and run all demo prompts once.
- [ ] Keep a second browser session or backup account ready.
- [ ] Prepare screenshots or a short recording for network/API failure.
- [ ] Keep the tool architecture diagram or explanation available.
- [ ] Avoid editing production schema immediately before judging.
- [ ] Have a concise answer for privacy, hallucination, and scalability questions.

## Likely Judge Questions

- **How is this different from a normal chatbot?** It performs validated function calls against the user’s live task data.
- **Can it hallucinate tasks?** The prompt requires tools for task facts, and the UI can show structured references; failures return an error instead of guessed data.
- **How is data isolated?** Supabase RLS plus server-side ownership filters scope every query to the authenticated user.
- **Why not let AI edit tasks?** Read-only tools keep the MVP safe and demonstrable; confirmed write tools can be added later.
- **How does prioritization work?** A deterministic server score ranks urgency and explicit priority; Gemini explains rather than invents the ordering.
- **What scales next?** Pagination, caching of non-sensitive aggregates, rate limiting, richer database indexes, and integrations.

