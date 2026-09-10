# Exam-period planner (Phase F)

The planner stores eligible exam days, daily opening/closing hours, blackout reasons, and turnaround policy. It intentionally does not expose student names, hall labels, capacities, invigilator names, levels, exports, pinning, partial regeneration, or CBT batching.

Planner modes are `WHOLE_MONTH`, `CUSTOM_RANGE`, and `SELECTED_DATES`. Weekdays default to Monday–Friday; weekends are opt-in. Blackouts are `PUBLIC_HOLIDAY`, `UNIVERSITY_EVENT`, `NO_EXAMS`, or `OTHER`.

Aggregate generation supports `FIXED_SESSIONS` (existing time slots) and `FLEXIBLE_INTERVALS`. Flexible placements use `{ date, startMinutes, endMinutes }`, exact event duration, calendar windows, mode-specific turnaround, resource availability, capacity, and hard/soft conflicts. Review output is limited to event, date/time, and collision diagnostics.

Planner endpoints: `GET/PUT/POST /api/exam-planning/period` and `GET /api/exam-planning/period/capacity`.
