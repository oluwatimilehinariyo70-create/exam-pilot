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
  | "APPROVAL_BLOCKED";

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
  if (isPrismaUniqueError(error)) {
    return new AcademicError("DATABASE_ERROR", "That record already exists.", {}, 409);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return new AcademicError("NOT_FOUND", "The requested academic record was not found.", {}, 404);
  }
  return new AcademicError("DATABASE_ERROR", "The academic record could not be saved.", {}, 500);
}
