# Architecture

## Boundaries

The application is organized into four boundaries:

- **Presentation:** Next.js App Router pages, React components, and Tailwind/shadcn-compatible UI primitives.
- **Application:** route handlers, server-side authentication, authorization, input validation, and future use-case services.
- **Domain:** timetable data structures, constraints, scoring, and generation algorithms. This boundary must remain independent of React and Next.js.
- **Data access:** Prisma repositories and PostgreSQL.

The Phase 1 schema already models the institutional hierarchy (`College` → `Department` → `Programme` → `Course`) and the resources needed by future scheduling work. The `ProgrammeCourse` join table intentionally allows one course to be shared by multiple programmes.

## Authentication and authorization

Better Auth owns credential and session persistence through the standard `User`, `Session`, `Account`, and `Verification` models. Role and active status are stored on `User`. Protected layouts and server actions must use `requireUser` or `requireRole`; client-side visibility is only a usability aid and never an authorization boundary.

The initial roles are `SUPER_ADMIN`, `ADMIN`, `EXAM_OFFICER`, and `VIEWER`. Role policy is kept in `src/lib/roles.ts` so new permissions can be introduced without coupling them to UI components.

## Portability

Only the PostgreSQL connection string is provider-specific. Prisma keeps persistence behind a typed data-access boundary, while Better Auth uses its Prisma adapter. No core scheduling behavior should depend on Vercel, Neon, or a hosted API.

## Auditability

`AuditLog` is part of the initial schema. Future mutations should write an actor, action, entity, entity ID, timestamp, and structured metadata in the same transaction as the critical change where practical.

## Academic setup flow

Phase 2 exposes academic setup through authenticated route handlers under `/api/academic/*` and a reusable administrative UI under `/academic-setup/*`. Mutations are authorized before parsing and persisted by services in `src/server/academic/services.ts`. The service checks foreign-key relationships, session/semester compatibility, academic year rules, examination date windows, duplicate slots, and overlapping slots before writing. Each significant mutation writes an `AuditLog` record in the same Prisma transaction.

Institutional changes (`College`, `Department`, `Programme`, `AcademicSession`, and `Semester`) are restricted to `SUPER_ADMIN` and `ADMIN`. Examination-period and time-slot changes additionally allow `EXAM_OFFICER`. `VIEWER` can read configuration only. These rules are enforced server-side; UI controls are only a convenience.
