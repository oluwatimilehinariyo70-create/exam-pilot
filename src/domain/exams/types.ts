export type ExamMode = "PEN_ON_PAPER" | "CBT";

export type CourseOffering = {
  id: string;
  sessionId: string;
  semesterId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  programmeId: string;
  programmeName: string;
  departmentId?: string;
  level: number;
  candidateCount: number;
  creditUnits?: number;
  examMode?: ExamMode;
  durationMinutes?: number;
};

export type ExamEventSource = "AUTO_AGGREGATED" | "MANUAL_MERGE";

export type ExamEvent = {
  id: string;
  memberOfferings: CourseOffering[];
  courseCodes: string[];
  canonicalCourseKeys: string[];
  title: string;
  candidateCount: number;
  cohortKeys: string[];
  examMode: ExamMode;
  durationMinutes: number;
  source: ExamEventSource;
  mergeMetadata?: {
    reason?: string;
    mergedBy?: string;
  };
};

export type ExplicitConflictSeverity = "HARD" | "SOFT";
export type ExplicitConflictType = "CARRYOVER" | "ELECTIVE_OVERLAP" | "DEPARTMENT_RULE" | "MANUAL";

export type ExplicitExamConflict = {
  id: string;
  eventOrCourseA: string;
  eventOrCourseB: string;
  severity: ExplicitConflictSeverity;
  type: ExplicitConflictType;
  estimatedSharedCandidates?: number;
  reason?: string;
};

export type DurationPolicy = {
  penOnPaperByCreditUnits?: Record<number, number>;
  cbtByCreditUnits?: Record<number, number>;
  defaultPenOnPaperMinutes: number;
  defaultCbtMinutes: number;
};

export type DurationResolutionSource =
  | "EVENT_OVERRIDE"
  | "OFFERING_OVERRIDE"
  | "COURSE_DEFAULT"
  | "CREDIT_UNIT_POLICY"
  | "MODE_DEFAULT";

export type DurationResolution = {
  durationMinutes: number;
  source: DurationResolutionSource;
};

export type DurationResolutionInput = {
  eventDurationMinutes?: number;
  offeringDurationMinutes?: number;
  courseDefaultDurationMinutes?: number;
  creditUnits?: number;
  examMode: ExamMode;
};

export type MergeDiagnosticCode =
  | "EMPTY_SELECTION"
  | "DUPLICATE_OFFERING"
  | "INVALID_CANDIDATE_COUNT"
  | "SESSION_MISMATCH"
  | "SEMESTER_MISMATCH"
  | "MODE_MISMATCH"
  | "INVALID_DURATION"
  | "DURATION_MISMATCH"
  | "DURATION_REQUIRED"
  | "TITLE_MISMATCH";

export type MergeDiagnosticSeverity = "ERROR" | "WARNING";

export type MergeDiagnostic = {
  code: MergeDiagnosticCode;
  severity: MergeDiagnosticSeverity;
  message: string;
  offeringIds: string[];
};

export type MergeValidationResult = {
  valid: boolean;
  errors: MergeDiagnostic[];
  warnings: MergeDiagnostic[];
};

export type AggregateOptions = {
  durationPolicy?: DurationPolicy;
  defaultExamMode?: ExamMode;
  eventId?: string;
};

export type AggregationResult = {
  events: ExamEvent[];
  diagnostics: MergeDiagnostic[];
};

export type ManualMergeResult = {
  event?: ExamEvent;
  validation: MergeValidationResult;
};
