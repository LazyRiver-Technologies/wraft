# Multi-Agent Architecture & Skill Matrix

This workspace is equipped with a structured multi-agent configuration under the `.agents/` and `.agent/` directories. These rules and skills guide AI coding assistants (such as Antigravity) to maintain high-quality development standards, follow architecture specifications, and enforce code and design consistency.

## Directory Structure

```
wraft/
├── AGENTS.md                   # This document (Architecture overview)
├── .agents/
│   ├── rules/
│   │   └── wraft.md            # Global workspace rules, style guides, and tech stack guidelines
│   └── skills/
│       ├── ai-saas-engineer/
│       │   └── SKILL.md        # Core SaaS development, feature planning, and execution planner
│       ├── supabase-schema/
│       │   └── SKILL.md        # Database schema design, migrations, and Supabase patterns
│       ├── llm-fallback/
│       │   └── SKILL.md        # Intelligence, fallback systems, RAG settings, and notifications
│       ├── code-critic/
│       │   └── SKILL.md        # Code quality, performance, TypeScript/Python linting, and testing
│       └── design-critic/
│           └── SKILL.md        # UI/UX design, design system tokens, Tailwind CSS, and UX polishing
└── .agent/
    └── workflows/              # Workflow definitions and automation triggers (created via UI)
```

## Agent Roles & Skill Definitions

### 1. Global Repository Rules (`rules/wraft.md`)
Enforces project-wide guidelines including:
* **Tech Stack**: Next.js, FastAPI, Supabase (PostgreSQL), Redis, Tailwind CSS.
* **Coding Standards**: Strict typing in TypeScript, clean routing in FastAPI, transactional database practices.
* **Deployment/Environment**: App Runner (backend) and Cloudflare/Vercel (frontend) integration constraints.

### 2. AI SaaS Engineer (`skills/ai-saas-engineer/SKILL.md`)
The master planner and architect for SaaS-level modifications:
* Coordinating between frontend UI changes and backend FastAPI endpoints.
* Managing billing limits (Razorpay integrations), workspace contexts, and user profiles.
* Scaffolding features from database schemas all the way to the frontend views.

### 3. Supabase Schema Specialist (`skills/supabase-schema/SKILL.md`)
Guides schema changes and PostgreSQL migrations:
* Creating SQL migrations under `backend/migrations/` and `backend/database/`.
* Writing robust Row-Level Security (RLS) policies.
* Optimizing queries, indexes, and handling real-time DB triggers.

### 4. LLM Fallback & Intelligence Specialist (`skills/llm-fallback/SKILL.md`)
Manages chatbot intelligence pipelines:
* Customizing fallback message handling, RAG retrieval flow, and bot limits.
* Integrating AI models (Gemini, Groq fallbacks).
* Managing fallback email/web notifications when a chatbot needs human intervention.

### 5. Code Critic (`skills/code-critic/SKILL.md`)
Reviews and optimizes implementations:
* Ensuring type safety, proper imports, and linting compliance.
* Enforcing error handling and robust try-except architectures.
* Reducing code duplication and checking unit test coverage.

### 6. Design Critic (`skills/design-critic/SKILL.md`)
Ensures premium visual aesthetics:
* Polishing layouts using smooth gradients, tailored HSL color systems, and dark/light modes.
* Verifying Tailwind CSS rules, custom component designs, and responsive behavior.
* Eliminating visual bugs, unpolished states, and generic placeholder interfaces.

---

## Usage

When invoking or delegating tasks to agents:
1. Always load `rules/wraft.md` to inherit general workspace constraints.
2. Load the relevant `SKILL.md` file depending on the task area (e.g., loading `supabase-schema/SKILL.md` when designing tables).
3. Follow the planning, execution, and verification phases defined in each skill file.
