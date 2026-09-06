# FacultyFlow AI

A planned AI-powered task manager for university faculty, using Next.js, Supabase PostgreSQL, and Gemini function calling.

## Current status

Planning and connection setup only. Application implementation has not started.

## Planning documents

- [Overview and MVP](PROJECT_OVERVIEW.md)
- [UI, API, database, and AI architecture](TECHNICAL_PLAN.md)
- [Implementation phases and checklist](IMPLEMENTATION_PLAN.md)
- [Testing and hackathon demo](TESTING_AND_DEMO_PLAN.md)
- [Owner requirements](REQUIREMENTS_FROM_ME.md)

## Local configuration

Use `.env.example` as the configuration reference. Actual credentials belong in `.env.local`, which is excluded from Git. Gemini configuration still requires a confirmed model identifier.

The supplied public Supabase key is a legacy anon key stored under `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use that environment variable consistently when implementing the Supabase client. The service-role key is server-only and must not be used for ordinary user-scoped task queries.

The `ALLOW_UNVERIFIED_SIGNUPS` environment variable is saved as requested; it does not configure Supabase authentication by itself. Authentication policies and database migrations remain pending implementation approval.
