import type { ConflictGraphMetrics } from "./conflicts";

export type AggregateReadinessStatus = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";
export type AggregateReadinessIssue = { code: string; severity: "BLOCKER" | "WARNING"; message: string };

/** Pure policy used by server readiness and future engine preflight checks. */
export function evaluateAggregateReadiness(input: {
  offeringCount: number;
  eventCount: number;
  missingCandidateCount: number;
  unresolvedModeCount: number;
  unresolvedDurationCount: number;
  incompatibleAggregationCount: number;
  invalidExplicitConflictCount: number;
  graph?: ConflictGraphMetrics;
  studentPrecisionAvailable: boolean;
  manualMergeCount: number;
  highDensityThreshold?: number;
}) {
  const blockers: AggregateReadinessIssue[] = [];
  const warnings: AggregateReadinessIssue[] = [];
  if (input.offeringCount === 0) blockers.push({ code: "NO_COURSE_OFFERINGS", severity: "BLOCKER", message: "Load at least one active course offering before generating an aggregate timetable." });
  if (input.missingCandidateCount) blockers.push({ code: "MISSING_CANDIDATE_COUNT", severity: "BLOCKER", message: "Every offering needs a positive candidate count for final timetable readiness." });
  if (input.unresolvedModeCount) blockers.push({ code: "UNRESOLVED_EXAM_MODE", severity: "BLOCKER", message: "Every offering needs an examination mode or a course default." });
  if (input.unresolvedDurationCount) blockers.push({ code: "UNRESOLVED_DURATION", severity: "BLOCKER", message: "Every offering needs a duration or a course default before aggregate events can be scheduled." });
  if (input.incompatibleAggregationCount) blockers.push({ code: "INCOMPATIBLE_AUTO_AGGREGATION", severity: "BLOCKER", message: "One or more same-code groups cannot be materialized as compatible events." });
  if (input.eventCount === 0 && input.offeringCount > 0) blockers.push({ code: "NO_EXAM_EVENTS", severity: "BLOCKER", message: "Confirm compatible course loads so exam events can be materialized." });
  if (input.invalidExplicitConflictCount) blockers.push({ code: "INVALID_EXPLICIT_CONFLICT", severity: "BLOCKER", message: "One or more explicit conflicts cannot be resolved to the selected exam events." });
  if (!input.studentPrecisionAvailable) warnings.push({ code: "NO_STUDENT_PRECISION_DATA", severity: "WARNING", message: "No student registrations are available; aggregate cohort conflicts remain valid without them." });
  if (input.manualMergeCount) warnings.push({ code: "MANUAL_MERGE_PRESENT", severity: "WARNING", message: "Manual exam-event merges are present and should be reviewed before scheduling." });
  if (input.graph && input.graph.events >= 4 && input.graph.density >= (input.highDensityThreshold ?? 0.5)) warnings.push({ code: "HIGH_CONFLICT_DENSITY", severity: "WARNING", message: "Many exam-event pairs conflict; this is a planning warning, not proof that scheduling is impossible." });
  const status: AggregateReadinessStatus = blockers.length ? "BLOCKED" : warnings.length ? "READY_WITH_WARNINGS" : "READY";
  return { status, blockers, warnings };
}
