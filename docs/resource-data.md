# Examination resource data

Phase 3 stores only scheduling-relevant data:

```text
Course → Department, Semester, ProgrammeCourse relationships
Student → Programme, level, active status
CourseRegistration → Student, Course, Session, Semester
Venue → capacity, location, active status, unavailable periods
Invigilator → department, workload limit, unavailable periods
```

Course codes have a display value and a normalized identity key. For example, `csc401`, `CSC401`, and `CSC 401` resolve to the same normalized key for uniqueness checks while the stored display code is kept readable.

Registration uniqueness is enforced by the database across student, course, session, and semester. Courses and students are archived with `active = false` rather than destructively deleted once operational history exists.
