# Phase E/F aggregate timetable engine

Phase F adds a persisted exam-period calendar and `FLEXIBLE_INTERVALS` scheduling mode. In flexible mode events receive exact date/start/end ranges inside enabled calendar windows, with mode-specific turnaround, resource availability, capacity, and conflict validation. The output remains intentionally collision-focused: event, date/time, and diagnostics only. CBT batching, pinning, partial regeneration, publication, and exports remain out of scope.

Phase E adds a separate `ExamEvent` generator under `src/domain/timetable/aggregate`. The legacy registration/course generator remains available and is not changed by this engine.

## Scheduling unit

The unit of work is one materialized `ExamEvent`. An event carries its title, member course codes, candidate workload, cohort keys, exam mode, and resolved duration. The engine schedules events into existing `ExamTimeSlot` records; it does not create flexible intervals, month plans, CBT batches, partial runs, pinned assignments, or publications.

## Feasibility and allocation

Every candidate slot must fit the event duration. Written events use `examCapacity` (falling back to `capacity`) and `WRITTEN`/`BOTH` venues. CBT events use `usableComputerCapacity` and `CBT`/`BOTH` venues. Capacity can be satisfied by a deterministic least-waste combination of venues, including a multi-venue assignment. CBT overflow is a hard diagnostic; the engine never silently batches an event. Invigilators are allocated from active, available staff with slot and daily/total workload limits.

## Conflicts and penalties

The Phase D unified event conflict graph is consumed directly. Cohort overlap and hard explicit conflicts block the same slot; soft explicit edges remain schedulable and add a penalty. Cohort back-to-back and daily overload penalties, venue waste/splits, and invigilator imbalance are included in the candidate score. Event ordering is deterministic and prioritizes saturation, hard/weighted conflict degree, workload, venue/slot scarcity, mode scarcity, and a seeded tie-break.

## Diagnostics and persistence

Events that cannot be placed are returned as `NO_FEASIBLE_SLOT` diagnostics with every attempted slot and machine-readable reasons such as `EVENT_DURATION_EXCEEDS_SLOT`, `EVENT_CONFLICT`, `INSUFFICIENT_CBT_CAPACITY`, and `INSUFFICIENT_VENUE_CAPACITY`. Final validation independently rechecks slot, duration, conflict, venue, and invigilator invariants.

Aggregate generations use `generationMode = AGGREGATE_EVENT`, a unique RUNNING lock, engine/snapshot versions, and additive `AggregateExamSchedule`, `AggregateExamVenueAssignment`, and `AggregateInvigilationAssignment` records. The input snapshot contains events, fixed slots, the conflict graph, resources, unavailability, and configuration. History and review are supported; manual edits, pinning, partial regeneration, publication, and exports remain out of scope.
