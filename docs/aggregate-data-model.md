# Aggregate data model foundation

Phase B introduced additive persistence for aggregate scheduling; Phase C now uses that persistence for course-load imports and aggregate event materialization:

`Course` → `CourseOffering` → `ExamEvent` → future `ExamSitting`

- `CourseOffering` represents one course offered to one programme/level in one session and semester, with a non-negative candidate count and optional mode/duration overrides. The migration adds a database check and services validate the same rule before writes.
- `ExamEvent` is the future logical paper. `ExamEventOffering` preserves every source offering, including manual cross-code merges; candidate totals are calculated from memberships.
- `ExamConflict` stores an ordered pair of original courses with hard/soft severity and an explicit conflict type. It is course-level for now so it can exist before event-level scheduling.
- `Venue` retains its existing capacity and adds editable exam, computer, usable-computer, capability, and grouping fields.
- `TimetableGeneration.inputSnapshot` and `snapshotSchemaVersion` provide an immutable storage seam for future generation inputs.
- `CourseLoadImport` records the validated course-load CSV, preview summary, commit mode, and resulting offering/event counts.

Course registrations and the existing `ExamSchedule`/generation path remain operational. Phase E connects materialized events to the fixed-session aggregate generator. `TimetableGeneration.generationMode` distinguishes `LEGACY_REGISTRATION` from `AGGREGATE_EVENT`; aggregate schedules are persisted additively and retain an immutable input snapshot. Publication, exports, flexible month planning, and interval scheduling remain future work.
