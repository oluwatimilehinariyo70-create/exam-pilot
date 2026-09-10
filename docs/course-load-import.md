# Course-load import

Course Loads is the primary aggregate planning workflow. It does not require student names or matric numbers.

## CSV format

Required headers:

```text
programme,department,level,course_code,course_title,credit_units,candidate_count,exam_mode,duration_minutes
```

`level` accepts values such as `200`, `200L`, and `200 Level`. `exam_mode` accepts canonical `PEN_ON_PAPER` or `CBT`, plus safe aliases `written`, `pen on paper`, and `cbt`. `duration_minutes` may be blank when the course default can resolve it later.

Files are limited to 5 MB and 20,000 data rows. Unknown programmes, departments, or courses are validation errors; the importer never creates institutional records from text.

## Preview and confirmation

Upload parses and resolves rows without writing. The preview reports row errors, duplicate logical offerings, new/existing offerings, candidate volume, same-code aggregation groups, compatibility diagnostics, and conservative possible cross-code merge suggestions.

Confirmation sends the original CSV and server-issued preview hash again. The server recomputes the preview and rejects stale or changed payloads. Commit is transactional and supports `UPDATE_EXISTING` or `CREATE_NEW`; candidate counts are never summed accidentally.

## Aggregation and merge

Compatible `PHY202` offerings such as 150 and 50 candidates preview as one 200-candidate logical exam. Events are materialized only after confirmation and derive totals from memberships. Cross-code pairs such as `CSC202 + MTH202` are suggestions only until an authorized user explicitly requests a manual merge with a reason. Mode and duration mismatches are rejected by the Phase A domain validator.

Legacy student-registration CSV import remains available as a secondary precision workflow. The current timetable generator still uses that legacy path.
