# Aggregate conflicts and readiness

Phase D adds a pre-generation conflict layer for aggregate `ExamEvent` records. It does not replace the existing student-based timetable generator.

## Unified graph

`buildConflictGraph` emits one deterministic edge per unordered event pair. An edge preserves all applicable structured reasons:

- `COHORT_OVERLAP` — the events contain the same programme + level cohort.
- `EXPLICIT_HARD_CONFLICT` / `EXPLICIT_SOFT_CONFLICT` — a persisted course-level exception resolves to the two events.
- `INDIVIDUAL_REGISTRATION_OVERLAP` — optional legacy registrations identify shared students.

The edge is hard if any reason is hard. Reasons are merged rather than emitted as duplicate edges, which lets Phase E apply hard rejection and soft penalties independently.

## Cohort populations and weights

Each event builds an effective population map keyed by `programmeId:level`. If a manually merged event contains the same cohort through multiple offerings, the maximum candidate count is retained once. For two events sharing a cohort, the edge weight uses the smaller of their effective populations as a conservative overlap estimate. Multiple shared cohorts are summed.

Registration precision is used only when present. If a cohort edge already has weight, shared registration counts add a reason but do not inflate the primary weight. Registration-only edges use the shared student count.

## Readiness

Aggregate readiness is independent of student names, matric numbers, and registrations. Blockers include missing offerings, non-positive candidate counts, unresolved mode/duration, unmaterialized events, incompatible aggregation, and invalid explicit conflicts. Warnings include absent student precision, low candidate counts, manual merges, high graph density, and events with many cohorts.

Density is `edges / (events * (events - 1) / 2)` and is zero for fewer than two events. High density is a warning, not a claim that scheduling is impossible.

## Explicit conflicts

The Explicit Conflicts screen is for known exceptions such as carryovers, elective overlap, department rules, and manual restrictions. Cohort conflicts are automatic and should not be entered manually. Explicit conflict pairs are canonicalized at persistence so `A ↔ B` and `B ↔ A` share one record.

## Compatibility

The graph is pure-domain output with a server-side Prisma dataset builder. The existing legacy registration conflict graph and timetable generation endpoints remain unchanged until Upgrade Phase E.
