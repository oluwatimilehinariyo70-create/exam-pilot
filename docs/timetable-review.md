# Timetable review workflow

Phase 5 provides a protected generation wizard and review workspace. Officers select a compatible session, semester, and examination period, inspect the server-generated readiness summary, choose only the safe `attempts` and `seed` controls, and start generation. The same dataset and seed are reproducible.

Review pages expose the candidate as a compact date/grid view, dense table, course view, venue view, invigilator view, and diagnostics view. Lower score means fewer soft-constraint penalties; hard violations and unscheduled courses remain separate validity checks.

Manual changes are operation-specific: move an examination to a configured time slot, replace venue assignments, or replace invigilators. The server reconstructs the candidate, runs the complete Phase 4 validator, recalculates score/metrics, persists the change transactionally, increments the revision, and writes an audit event. Hard violations are rejected. Approved generations cannot be edited.

Lifecycle transitions are `DRAFT` → `UNDER_REVIEW` → `APPROVED`. Approval requires a valid timetable with no hard violations and no unscheduled courses. Earlier generations are preserved and can be compared for validity, scheduled/unscheduled counts, score, workload, and assignment changes.

Publication, public access, PDF/Excel export, and final hardening are Phase 6.
