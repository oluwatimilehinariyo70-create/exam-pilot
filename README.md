# Exam Pilot

Exam Pilot is a production-oriented computerized examination timetable management system for BOUESTI College of Science. Phases 1–3 establish the secure application shell, academic setup, examination data, registrations, venues, invigilators, and CSV workflows. The legacy engine adds deterministic registration-based scheduling and protected persistence. Phase E adds a separate deterministic `ExamEvent` fixed-session engine focused on resolving exam hall collisions without requiring student names, hall labels, capacities, invigilator details, or level data in the collision output. Publication, exports, and the month planner remain future work.

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

`npm run build` only generates the Prisma client and builds the application. It does not apply schema changes or seed the database. Run `npm run db:push`, `npm run db:migrate`, or `npm run db:seed` explicitly when setting up a database.

## Phase boundaries

Phase 1 includes the initial database topology, authentication foundation, role helpers, protected application shell, environment guidance, and operational dashboard. Phase 2 includes colleges, departments, programmes, academic sessions, semesters, examination periods, configurable time slots, bulk slot preview, server-side authorization, and audit logging. Phase 3 adds courses, students, registrations, local CSV import preview/confirmation, venues, invigilators, and availability records. Phase 4 adds the in-memory conflict graph, hard/soft constraints, deterministic generation, allocation, validation, readiness diagnostics, generation persistence, and history. Phase 5 adds the generation wizard, review views, diagnostics, history comparison, draft/review/approval workflow, and server-validated manual adjustments. Upgrade Phases A-C add aggregate course offerings, course-load import, same-code aggregation, and event persistence. Upgrade Phase D adds cohort-aware aggregate conflicts, explicit conflict CRUD, optional registration precision, conflict inspection, and aggregate readiness. Phase E adds the separate ExamEvent-based fixed-session generator, additive persistence, secured APIs, diagnostics, and aggregate review history. Publication, public access, PDF/Excel export, and final hardening remain future work.

See [docs/architecture.md](docs/architecture.md), [docs/timetable-engine.md](docs/timetable-engine.md), and [docs/aggregate-timetable-engine.md](docs/aggregate-timetable-engine.md) for the intended boundaries and next implementation phase.
# Exam Pilot

Exam Pilot is a BOUESTI examination planning and timetable workflow. It supports course-load import, logical exam-event aggregation, student/cohort conflict analysis, fixed-session and flexible-interval generation, CBT batching, review, revision control, publication, exports, and a public timetable.

## Production setup

Copy `.env.example` to `.env.local` and provide `DATABASE_URL`, a random `BETTER_AUTH_SECRET` of at least 32 characters, and `BETTER_AUTH_URL`. `SEED_ADMIN_PASSWORD` is required only for the local seed command. Rotate any credentials that may have appeared in older local examples or Git history.

Install dependencies and generate the Prisma client with `npm install` and `npm run db:generate`. Apply migrations with `npx prisma migrate deploy`; never use `prisma db push` or `prisma migrate reset` against production. Check the result with `npx prisma migrate status`.

## Operator workflow

1. Set the academic session and semester.
2. Configure the examination period, fixed slots or calendar days, blackouts, daily hours, turnaround, and CBT policy.
3. Configure written halls, CBT centres, invigilators, and technical-support staff.
4. Import course loads and resolve validation, aggregation, and explicit-conflict diagnostics.
5. Review readiness, preview CBT batches, and generate a fixed-session or flexible timetable.
6. Open timetable review, inspect CBT batches and diagnostics, pin approved assignments, and use selected or unresolved regeneration when required.
7. Add late course offerings and place them without moving pinned or unaffected examinations.
8. Create revisions for changes, submit for review, approve, and publish. Historical revisions remain available with their change reason.
9. Export university, programme, venue, or CBT views as PDF or Excel. Share only the published read-only timetable at `/public/timetable`.

## Scheduling and publication

Exam events are the logical examinations; CBT sittings are deterministic batches with exact candidate totals, venue allocations, sequence numbers, gap rules, and technical-support coverage. Validation runs before persistence and before approval. Publication requires an approved, valid revision and supersedes the prior published revision atomically. Public responses contain no student names, audit data, or private administration metadata.

## Development checks

Use `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`. Lint currently reports only existing React hook dependency warnings. The application uses PostgreSQL through Prisma and server-side PDFKit/ExcelJS exports.
