# Registration CSV import

The registration import is local to the application. No external file-processing service is used.

## Required columns

```text
matric_number,student_name,programme,level,course_code
```

The user selects the academic session and semester before previewing the file. `programme` may contain either the programme code or its exact name. `course_code` is normalized case-insensitively and is matched only against active courses in the selected semester.

## Workflow

1. Select a session and semester.
2. Upload a CSV smaller than 10 MB.
3. Preview the parsed rows.
4. Review missing headers, unknown programmes, unknown courses, invalid levels, and duplicate registrations.
5. Explicitly confirm the preview.
6. Commit new students and registrations in one Prisma transaction.

Preview never writes to PostgreSQL. Existing students are reused by trimmed matric number. Existing registrations are skipped and counted as duplicates. Unknown institutional records are errors; the importer never silently creates programmes or courses.

The `RegistrationImport` model stores metadata and summary counts, not the raw CSV contents.
