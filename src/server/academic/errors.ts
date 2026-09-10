export type AcademicErrorCode =
  | "COLLEGE_CODE_EXISTS"
  | "DEPARTMENT_CODE_EXISTS"
  | "PROGRAMME_CODE_EXISTS"
  | "SESSION_ALREADY_EXISTS"
  | "INVALID_ACADEMIC_YEAR_RANGE"
  | "SEMESTER_ALREADY_EXISTS"
  | "INVALID_EXAM_PERIOD_RANGE"
  | "EXAM_PERIOD_ALREADY_EXISTS"
  | "INVALID_SESSION_SEMESTER"
  | "TIMESLOT_OUTSIDE_EXAM_PERIOD"
  | "TIMESLOT_OVERLAP"
  | "TIMESLOT_DUPLICATE"
  | "INVALID_TIME_RANGE"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "COURSE_CODE_EXISTS"
  | "COURSE_NOT_FOUND"
  | "INVALID_COURSE_LEVEL"
  | "COURSE_INACTIVE"
  | "STUDENT_MATRIC_EXISTS"
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "REGISTRATION_ALREADY_EXISTS"
  | "REGISTRATION_NOT_FOUND"
  | "CSV_INVALID_HEADERS"
  | "CSV_INVALID_ROW"
  | "CSV_TOO_LARGE"
  | "CSV_UNKNOWN_PROGRAMME"
  | "CSV_UNKNOWN_COURSE"
  | "CSV_CONFIRMATION_REQUIRED"
  | "VENUE_CODE_EXISTS"
  | "INVALID_VENUE_CAPACITY"
  | "INVIGILATOR_STAFF_ID_EXISTS"
  | "INVALID_AVAILABILITY_RANGE"
  | "GENERATION_ALREADY_RUNNING"
  | "GENERATION_NOT_READY"
  | "GENERATION_FAILED"
  | "TIMETABLE_NOT_EDITABLE"
  | "TIMETABLE_INVALID"
  | "WORKFLOW_TRANSITION_INVALID"
  | "APPROVAL_BLOCKED"
  | "INVALID_CANDIDATE_COUNT"
  | "INVALID_DURATION"
  | "INVALID_COURSE_SEMESTER"
  | "PROGRAMME_COURSE_REQUIRED"
  | "INACTIVE_DEPENDENCY"
  | "INVALID_LEVEL"
  | "COURSE_OFFERING_EXISTS"
  | "COURSE_OFFERING_NOT_FOUND"
  | "EMPTY_SELECTION"
  | "INVALID_EXAM_EVENT"
  | "EXAM_EVENT_LOCKED"
  | "EXAM_EVENT_NOT_FOUND"
  | "MEMBERSHIP_NOT_FOUND"
  | "INVALID_CONFLICT_PAIR"
  | "EXAM_CONFLICT_EXISTS"
  | "EXAM_CONFLICT_NOT_FOUND"
  | "INVALID_SNAPSHOT"
  | "GENERATION_NOT_FOUND"
  | "SNAPSHOT_ALREADY_EXISTS"
  | "CSV_UNKNOWN_DEPARTMENT"
  | "CSV_DUPLICATE_OFFERING_ROW"
  | "CSV_INVALID_MODE"
  | "CSV_INVALID_LEVEL"
  | "CSV_INVALID_CANDIDATE_COUNT"
  | "CSV_INVALID_CREDIT_UNITS"
  | "CSV_INVALID_DURATION"
  | "CSV_UNKNOWN_OFFERING"
  | "CSV_PREVIEW_MISMATCH"
  | "CSV_EXISTING_OFFERING"
  | "COURSE_LOAD_IMPORT_FAILED"
  | "COURSE_LOAD_IMPORT_NOT_FOUND"
  | "EXAM_EVENT_UNMERGE_UNAVAILABLE"
  | "AGGREGATE_GENERATION_NOT_READY"
  | "AGGREGATE_GENERATION_FAILED"
  | "INVALID_CALENDAR_CONFIGURATION"
  | "CALENDAR_DATE_OUTSIDE_PERIOD"
  | "CALENDAR_ALREADY_REFERENCED";

export class AcademicError extends Error {
  constructor(
    public readonly code: AcademicErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AcademicError";
  }
}

export function isPrismaUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function toAcademicError(error: unknown): AcademicError {
  if (error instanceof AcademicError) return error;
  if (error instanceof SyntaxError) return new AcademicError("VALIDATION_ERROR", "The request body is not valid JSON.", {}, 400);
  if (error instanceof Error && error.name === "AuthorizationError") {
    return new AcademicError("UNAUTHORIZED", error.message, {}, 403);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return new AcademicError("TIMETABLE_NOT_EDITABLE", "Another request changed these records. Reload and retry.", {}, 409);
  if (isPrismaUniqueError(error)) {
    return new AcademicError("DATABASE_ERROR", "That record already exists.", {}, 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return new AcademicError("NOT_FOUND", "The requested academic record was not found.", {}, 404);
  }
  return new AcademicError("DATABASE_ERROR", "The academic record could not be saved.", {}, 500);
}
