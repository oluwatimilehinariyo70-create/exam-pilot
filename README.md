# Exam Pilot

Exam Pilot is a production-oriented computerized examination timetable management system for BOUESTI College of Science. Phases 1–3 establish the secure application shell, academic setup, examination data, registrations, venues, invigilators, and CSV workflows. Phase 4 adds a deterministic, framework-independent timetable engine and protected generation persistence. Phase 5 adds generation/review, diagnostics, history, comparison, and validated draft adjustments. Publication and exports remain in Phase 6.

## Free-only stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui-compatible primitives, PostgreSQL, Prisma, Better Auth, Zod, Vitest, and Playwright are all open-source or have free usage paths. The application does not depend on Firebase, Supabase, Clerk, Auth0, MongoDB, MySQL, paid AI, or a proprietary scheduling API. Vercel Hobby and Neon Free are optional deployment choices; the core app remains portable to any PostgreSQL host and Node-compatible deployment.

## Local setup

1. Install Node.js 20+ and PostgreSQL, or create a free Neon PostgreSQL database.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and a local-only `SEED_ADMIN_PASSWORD` with at least 12 characters.
3. Install dependencies with `npm ci`.
4. Generate the Prisma client with `npm run db:generate`.
5. Apply the schema with `npm run db:migrate` for a persistent development database. If this is a disposable local database with no migration history yet, use `npm run db:push` instead.
6. Seed the sample institution and the idempotent development administrator with `npm run db:seed`.
7. Start the application with `npm run dev`.

### Development login

The seed creates or updates one administrator account; it does not print or store the plaintext password. Set the password in `.env.local` before seeding:

```env
SEED_ADMIN_PASSWORD="your-local-password-of-at-least-12-characters"
```

Then open [http://localhost:3000/sign-in](http://localhost:3000/sign-in) and use:

```text
Email: admin@exampilot.local
Password: the value configured in SEED_ADMIN_PASSWORD
```

Email/password authentication is enabled through Better Auth, while public email/password self-registration is disabled. Running `npm run db:seed` again updates the same administrator and credential account instead of creating duplicates.

The sample seed is fictional and includes College of Science departments, a programme, courses, venues, and invigilators. It does not create real student personal data.

React Hook Form, TanStack Table, ExcelJS, PDF tooling, and Playwright are intentionally staged for the academic-data, timetable, export, and hardening phases. Phase 1 only installs dependencies needed by the secure foundation, avoiding duplicate or premature packages.

## Quality checks

```text
npm run lint
npm run typecheck
npm test
npm run build
```

## Phase boundaries

Phase 1 includes the initial database topology, authentication foundation, role helpers, protected application shell, environment guidance, and operational dashboard. Phase 2 includes colleges, departments, programmes, academic sessions, semesters, examination periods, configurable time slots, bulk slot preview, server-side authorization, and audit logging. Phase 3 adds courses, students, registrations, local CSV import preview/confirmation, venues, invigilators, and availability records. Phase 4 adds the in-memory conflict graph, hard/soft constraints, deterministic generation, allocation, validation, readiness diagnostics, generation persistence, and history. Phase 5 adds the generation wizard, review views, diagnostics, history comparison, draft/review/approval workflow, and server-validated manual adjustments. Publication, public access, PDF/Excel export, and final hardening remain Phase 6.

See [docs/architecture.md](docs/architecture.md) and [docs/timetable-engine.md](docs/timetable-engine.md) for the intended boundaries and next implementation phase.
