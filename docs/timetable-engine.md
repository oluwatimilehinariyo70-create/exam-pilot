# Phase 4 timetable engine

The timetable engine is a pure TypeScript domain module under `src/domain/timetable`. It receives a fully loaded `SchedulingDataset`; it does not import React, Next.js, Prisma, HTTP, or browser APIs. `src/server/timetable/dataset-builder.ts` is the database boundary that maps the current session, semester, examination period, registrations, time slots, venues, and invigilators into that DTO.

## Generation strategy

Version `1.0.0` uses a deterministic greedy heuristic. Courses are ordered with a DSATUR-inspired ranking: saturation/conflict degree, candidate count, a seeded stable tie-break, then course code and ID. Each course evaluates every configured slot, rejects hard violations, allocates the best available venue combination and invigilators, and chooses the lowest incremental penalty. Additional attempts vary only the controlled tie-break seed; the candidate with fewer hard violations and then lower penalty wins.

## Conflict graph and constraints

The conflict graph is built from each student's registered course list, producing weighted edges by shared-student count. Hard validation covers student clashes, venue collisions/capacity/availability, invigilator collisions/availability, inactive resources, and invalid examination slots. Soft scoring covers student back-to-back exams, daily student overload, venue waste/splitting, exam distribution, and invigilator workload balance/daily overload.

## Diagnostics and scoring

Lower penalty is better. An impossible course is not forced into an invalid assignment: it is returned as `NO_FEASIBLE_SLOT` with candidate count, conflict weights, attempted slots, and rejection reasons. Final validation runs independently after generation. Metrics include scheduled/unscheduled counts, hard violations, venue utilization/waste, student overload, venue splits, and invigilator workload distribution.

## Persistence and limitations

Protected server integration persists each generation separately, keeps a generation lock for the selected session/semester/period, stores engine version/seed/configuration/metrics in metadata, and records audit events. Generation history is read-only at this stage. The heuristic does not guarantee mathematical optimality; course duration is assumed to match configured slots, and invigilation uses one staff member per allocated venue by default. Publication, review UI, manual editing, and exports belong to Phase 5.
