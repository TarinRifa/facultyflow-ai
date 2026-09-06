# FacultyFlow AI — Project Overview

## Product Summary

**FacultyFlow AI** is a faculty-focused task manager with a grounded AI assistant. Faculty members create and maintain academic and administrative tasks in a conventional to-do interface. The assistant answers natural-language questions by calling server-side tools that query the same Supabase PostgreSQL data used by the task UI.

The product should feel useful even without the chatbot: quick task entry, clear deadlines, simple filters, and an at-a-glance workload dashboard. AI adds a conversational way to retrieve, summarize, compare, and prioritize that real task data.

## Problem and Users

University faculty often track teaching, grading, meetings, research, advising, and administrative work in disconnected places. The MVP serves a single primary persona: a faculty member who wants one reliable view of current work and fast answers such as “What should I prioritize today?”

## MVP Goals

- Store tasks durably in Supabase PostgreSQL.
- Let a faculty user add, view, edit, complete, reopen, and delete tasks.
- Support title, description, due date, priority, category/course, and status.
- Provide search, filtering, sorting, and dashboard summaries.
- Let Gemini retrieve current task facts through backend tool/function calls.
- Ensure every chatbot answer is scoped to the signed-in user and grounded in database results.
- Present a professional, responsive interface suitable for a hackathon demo.

## MVP Features

### Task Management

- Create a task with required title and optional description, due date, course/category, priority, and status.
- Edit all task fields.
- Complete or reopen a task in one action.
- Delete a task after confirmation.
- View task list with overdue and due-soon visual cues.
- Search title and description.
- Filter by status, priority, course/category, due-date range, overdue, and upcoming.
- Sort by due date, priority, or recently updated.

### Dashboard

- Pending task count.
- Completed task count.
- Upcoming task count (due in the next seven calendar days).
- Overdue task count.
- Compact “Today and upcoming” list.
- Priority distribution or course/category breakdown if time permits.

### AI Assistant

- Persistent chat panel/page with suggested questions.
- Supports questions such as:
  - What do I have due this week?
  - Summarize my pending tasks.
  - Do I have anything overdue?
  - Show my CSE tasks.
  - What should I prioritize today?
- Retrieves task data using server-side functions rather than relying on prompt-injected sample data.
- Can filter by course/category, status, priority, dates, and overdue state.
- Can aggregate counts and summarize returned records.
- Can recommend priorities using a transparent heuristic based on overdue state, due date, and explicit priority.
- States when no matching tasks exist and does not invent records.

## Explicitly Out of Scope for the MVP

- Student accounts, team workspaces, task assignment, or shared lists.
- Calendar synchronization, email ingestion, or LMS integration.
- Attachments, subtasks, recurring tasks, push notifications, or offline mode.
- Autonomous edits by AI. The MVP chatbot is read-only to reduce risk.
- Vector search or embeddings; structured SQL filtering is sufficient.
- Native mobile apps.

## Product Principles

1. **Database is the source of truth:** dashboard, list, and assistant read the same records.
2. **User isolation:** every query is scoped to the authenticated faculty user.
3. **Grounded answers:** the model sees tool results, not unrestricted database access.
4. **Simple interaction:** common operations should take one or two actions.
5. **Demo reliability:** deterministic fallback messages and seeded demo data are prioritized over extra features.

## Success Criteria

- A signed-in faculty user can complete the entire task lifecycle without errors.
- Dashboard counts update after task changes.
- Search and filters produce correct combinations.
- Each target chatbot question returns an answer based on the latest database state.
- Completing or editing a task changes the next relevant AI response.
- Another user cannot access the first user’s tasks through UI, API, or chatbot tools.
- The core demo can be completed in under four minutes.

