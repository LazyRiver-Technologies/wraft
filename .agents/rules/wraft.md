# Wraft Repository Rules & Style Guide

These guidelines apply repository-wide for all changes in the Wraft codebase.

## 1. Stack & Architecture

Wraft is an AI-powered chatbot SaaS platform that allows users to train chatbots on custom data sources and embed them on websites.

### Frontend
* **Framework**: Next.js (App Router, React, TypeScript).
* **Styling**: Tailwind CSS for responsive and premium layout designs.
* **Component Library**: Tailored UI elements (Shadcn-like custom UI in `frontend/src/components/ui/`).
* **State & Fetching**: React Hooks, local state, standard HTTP client integrations.

### Backend
* **Framework**: FastAPI (Python 3.x).
* **Database**: Supabase (PostgreSQL) using Postgrest Python Client.
* **Caching & Limits**: Redis (caching, rate limiting, and daily/weekly jobs processing).
* **AI Engine**: Gemini API with Groq as fallback for chat operations, RAG retrieval with vector embedding calculations.

---

## 2. Directory Layout Constraints

* **Do not place files outside of their designated directory contexts**:
  * FastAPI logic, routers, migrations, and services belong in `backend/`.
  * Pages, components, hooks, styles, and typescript utils belong in `frontend/`.
  * Temporary verification scripts belong in `scratch/` or `<appDataDir>/brain/<conversation-id>/scratch/`.

---

## 3. Backend Coding Standards (Python/FastAPI)

* **Exception Handling**: Wrap database queries and external service integrations in strict try-except blocks. Handle `postgrest.exceptions.APIError` and handle standard error codes cleanly (e.g., `22P02` for UUID errors, `23505` for duplicates, `23503` for foreign key errors).
* **Imports**: Use explicit absolute imports where possible. Keep `backend/config.py` as the single source of truth for settings.
* **Logging**: Use `logging` instead of `print` inside application services. Use the `"uvicorn.error"` logger for routing-level logs.
* **Type Hinting**: Provide proper python type hints for route request bodies (`Pydantic` models) and return values.

---

## 4. Frontend Coding Standards (Next.js/TypeScript)

* **Tailwind CSS**: Use semantic Tailwind classes (e.g. `bg-bg-primary`, `text-text-primary`, `border-border-default`) rather than hardcoded hex colors to support dark/light modes.
* **Clean Components**: Place reusable components in `src/components/` and page-specific views inside `src/app/`.
* **Path Aliases**: Use `@/` path aliases for cleaner imports (e.g., `import { Button } from "@/components/ui/button"`).
* **No `any`**: Strictly define TypeScript interfaces and types in `src/lib/types.ts` or local types files. Avoid using the `any` type.

---

## 5. Database & Migrations Rules

* Database schema changes must be written as SQL migration files under `backend/migrations/` or documented in `backend/database/`.
* Include comments in your SQL migration scripts explaining the purpose of tables, indexes, or row-level security (RLS) policies.
* Ensure all tables have Row-Level Security enabled and correct policies to restrict tenant data leaks.

---

## 6. Execution & Verification Flow

1. **Lint/Check**: Before completing any tasks, check that the backend is syntax-valid and the frontend runs without compiler/TypeScript errors.
2. **Build**: Run local build checks on the frontend (`npm run build` from `frontend`) if editing React code, to make sure static types compile successfully.
3. **Environment**: Never expose credentials or API keys. Always use configuration variables via `.env` and read them from `backend/config.py` or `.env.local` for the frontend.
