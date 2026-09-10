# Aggregate examination domain

Phase A introduces pure TypeScript contracts for the future aggregate scheduling model. These contracts are intentionally independent of Prisma, React, Next.js, HTTP, and browser APIs.

## Terminology

- **Course** is the catalogue identity: code, title, credit units, and future defaults such as mode or duration.
- **CourseOffering** is one programme/level offering a course with a candidate count for a session and semester.
- **Cohort** is identified by stable `programmeId + level`, not by student names.
- **ExamEvent** is one logical examination paper that can contain one or more offerings.
- **Same-code aggregation** groups compatible offerings by session, semester, and canonical course-code key.
- **Manual merge** creates one event from selected offerings even when their display/course codes differ, while preserving every original offering.
- **Explicit conflict** records a known hard or soft clash such as a carryover or departmental restriction.
- **Exam mode** is currently `PEN_ON_PAPER` or `CBT`.
- **Duration resolution** follows event override, offering override, course default, credit-unit policy, and mode default.

Course-code display values are preserved. Canonical identity removes case, spaces, and punctuation, so `PHY202`, `PHY 202`, `PHY-202`, and `phy202` share one identity key.

These contracts are not yet connected to timetable generation. Phase B adds persistence around them without switching the existing generation path; Phase C adds the course-load import, preview, and aggregate-event materialization workflow.

## Phase B persistence foundation

The additive model is:

`Course` → `CourseOffering` → `ExamEvent` → future `ExamSitting`

`CourseOffering` stores one programme/level/course/session/semester candidate count. Its database identity excludes candidate count, so changing a count updates the same logical offering. `ExamEventOffering` preserves every original offering when papers are auto-aggregated or manually merged; candidate totals are calculated from memberships rather than stored twice.

`ExamConflict` currently stores canonical ordered course pairs. This keeps explicit conflicts useful before event-level scheduling exists and prevents reverse-direction duplicates. `Venue` has additive written/CBT capability and capacity fields, while `TimetableGeneration` has an immutable input-snapshot storage seam. `CourseLoadImport` records the server-validated CSV history, preview summary, and committed offering counts.

Course registrations remain optional legacy precision data. The current timetable generator and its APIs still use the existing student/registration models; Phase C does not switch generation to aggregate events.
