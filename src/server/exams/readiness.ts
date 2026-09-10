import { aggregateCourseOfferings, summarizeHighConflictEvents } from "@/domain/exams";
import { prisma } from "@/lib/prisma";
import { courseOfferingToDomain } from "./mappers";
import { buildAggregateConflictDataset } from "./conflict-graph-service";

export type AggregateReadinessStatus = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";

export type ReadinessDiagnostic = { code: string; severity: "BLOCKER" | "WARNING"; message: string; count?: number; ids?: string[] };

const highDensityThreshold = 0.5;

export async function getAggregateDataReadiness(academicSessionId?: string, semesterId?: string) {
  const session = academicSessionId ? await prisma.academicSession.findUnique({ where: { id: academicSessionId }, select: { id: true, name: true, active: true } }) : null;
  const semester = semesterId ? await prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true, name: true, academicSessionId: true, active: true } }) : null;
  const offerings = await prisma.courseOffering.findMany({ where: { active: true, ...(academicSessionId ? { academicSessionId } : {}), ...(semesterId ? { semesterId } : {}) }, include: { course: { include: { department: true } }, programme: true } });
  const domainOfferings = offerings.map(courseOfferingToDomain);
  const aggregation = aggregateCourseOfferings(domainOfferings);
  const blockers: ReadinessDiagnostic[] = [];
  const warnings: ReadinessDiagnostic[] = [];

  if (academicSessionId && !session) blockers.push({ code: "ACADEMIC_SESSION_NOT_FOUND", severity: "BLOCKER", message: "The selected academic session does not exist." });
  if (semesterId && !semester) blockers.push({ code: "SEMESTER_NOT_FOUND", severity: "BLOCKER", message: "The selected semester does not exist." });
  if (session && semester && semester.academicSessionId !== session.id) blockers.push({ code: "INVALID_SESSION_SEMESTER", severity: "BLOCKER", message: "The selected semester does not belong to the academic session." });
  if (!offerings.length) blockers.push({ code: "NO_COURSE_OFFERINGS", severity: "BLOCKER", message: "Load at least one active course offering before generating an aggregate timetable." });

  const missingCandidateIds = offerings.filter((offering) => !Number.isInteger(offering.candidateCount) || offering.candidateCount <= 0).map((offering) => offering.id);
  if (missingCandidateIds.length) blockers.push({ code: "MISSING_CANDIDATE_COUNT", severity: "BLOCKER", message: "Every offering needs a positive candidate count for final timetable readiness.", count: missingCandidateIds.length, ids: missingCandidateIds });
  const unresolvedModeIds = offerings.filter((offering) => !offering.examModeOverride && !offering.course.defaultExamMode).map((offering) => offering.id);
  if (unresolvedModeIds.length) blockers.push({ code: "UNRESOLVED_EXAM_MODE", severity: "BLOCKER", message: "Every offering needs an examination mode or a course default.", count: unresolvedModeIds.length, ids: unresolvedModeIds });
  const unresolvedDurationIds = offerings.filter((offering) => !offering.durationMinutesOverride && !offering.course.defaultDurationMinutes).map((offering) => offering.id);
  if (unresolvedDurationIds.length) blockers.push({ code: "UNRESOLVED_DURATION", severity: "BLOCKER", message: "Every offering needs a duration or a course default before aggregate events can be scheduled.", count: unresolvedDurationIds.length, ids: unresolvedDurationIds });

  const aggregationIssues = aggregation.diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR");
  if (aggregationIssues.length) blockers.push({ code: "INCOMPATIBLE_AUTO_AGGREGATION", severity: "BLOCKER", message: "One or more same-code groups cannot be materialized as compatible events.", count: aggregationIssues.length, ids: aggregationIssues.flatMap((issue) => issue.offeringIds) });

  let dataset: Awaited<ReturnType<typeof buildAggregateConflictDataset>> | null = null;
  if (academicSessionId && semesterId) dataset = await buildAggregateConflictDataset(academicSessionId, semesterId);
  const logicalExamCount = dataset?.events.length ?? aggregation.events.length;
  const graph = dataset?.graph;
  if (offerings.length && logicalExamCount === 0) blockers.push({ code: "NO_EXAM_EVENTS", severity: "BLOCKER", message: "Confirm compatible course loads so exam events can be materialized." });
  if (dataset?.issues.length) blockers.push({ code: "INVALID_EXPLICIT_CONFLICT", severity: "BLOCKER", message: "One or more explicit conflicts cannot be resolved to the selected exam events.", count: dataset.issues.length, ids: dataset.issues.map((issue) => issue.conflictId) });

  const eventMembershipIds = new Set(dataset?.events.flatMap((event) => event.memberOfferings.map((offering) => offering.id)) ?? []);
  if (dataset && offerings.some((offering) => !eventMembershipIds.has(offering.id))) blockers.push({ code: "UNMATERIALIZED_OFFERING", severity: "BLOCKER", message: "Every active course offering must belong to a materialized exam event." });

  const eventCount = dataset?.events.length ?? 0;
  const explicitConflictCount = dataset?.explicitConflicts.length ?? 0;
  const manualMergeCount = dataset?.events.filter((event) => event.source === "MANUAL_MERGE").length ?? 0;
  const candidateVolume = offerings.reduce((sum, offering) => sum + offering.candidateCount, 0);
  const modeCounts = offerings.reduce((counts, offering) => { const mode = offering.examModeOverride ?? offering.course.defaultExamMode; if (mode === "CBT") counts.cbt += 1; else if (mode === "PEN_ON_PAPER") counts.penOnPaper += 1; return counts; }, { penOnPaper: 0, cbt: 0 });

  if (offerings.some((offering) => !offering.course.defaultDurationMinutes && Boolean(offering.durationMinutesOverride))) warnings.push({ code: "COURSE_WITHOUT_EXPLICIT_DURATION", severity: "WARNING", message: "Some courses rely on an offering-specific duration rather than a course default." });
  const lowCount = offerings.filter((offering) => offering.candidateCount > 0 && offering.candidateCount < 10).length;
  if (lowCount) warnings.push({ code: "LOW_CANDIDATE_COUNT", severity: "WARNING", message: "Some offerings have a low candidate count; confirm that they are intentional.", count: lowCount });
  if (manualMergeCount) warnings.push({ code: "MANUAL_MERGE_PRESENT", severity: "WARNING", message: "Manual exam-event merges are present and should be reviewed before scheduling.", count: manualMergeCount });
  if (dataset && !dataset.studentPrecisionAvailable) warnings.push({ code: "NO_STUDENT_PRECISION_DATA", severity: "WARNING", message: "No student registrations are available; aggregate cohort conflicts remain valid without them." });
  if (graph && graph.metrics.density >= highDensityThreshold && graph.metrics.events >= 4) warnings.push({ code: "HIGH_CONFLICT_DENSITY", severity: "WARNING", message: "Many exam-event pairs conflict; this is a planning warning, not proof that scheduling is impossible." });
  const manyCohortEvents = dataset?.events.filter((event) => event.cohortKeys.length >= 4).length ?? 0;
  if (manyCohortEvents) warnings.push({ code: "EVENT_WITH_MANY_COHORTS", severity: "WARNING", message: "Some logical exams include many programme/level cohorts.", count: manyCohortEvents });

  const status: AggregateReadinessStatus = blockers.length ? "BLOCKED" : warnings.length ? "READY_WITH_WARNINGS" : "READY";
  const issues = [...blockers, ...warnings];
  return {
    academicSessionId: academicSessionId ?? null,
    semesterId: semesterId ?? null,
    status,
    blockers,
    warnings,
    issues,
    sessionExists: !academicSessionId || Boolean(session),
    semesterExists: !semesterId || Boolean(semester),
    courseOfferingsLoaded: offerings.length > 0,
    offeringCount: offerings.length,
    candidateCountsComplete: missingCandidateIds.length === 0,
    incompleteCandidateCount: missingCandidateIds.length,
    aggregateEventsResolvable: logicalExamCount > 0 && !aggregationIssues.length,
    logicalExamCount,
    modeConflictCount: aggregation.diagnostics.filter((issue) => issue.code === "MODE_MISMATCH").length,
    durationConflictCount: aggregation.diagnostics.filter((issue) => issue.code === "DURATION_MISMATCH" || issue.code === "DURATION_REQUIRED").length,
    unresolvedAggregationIssues: aggregation.diagnostics,
    metrics: {
      candidateVolume,
      penOnPaper: modeCounts.penOnPaper,
      cbt: modeCounts.cbt,
      events: graph?.metrics.events ?? eventCount,
      edges: graph?.metrics.edges ?? 0,
      maximumPossibleEdges: graph?.metrics.maximumPossibleEdges ?? 0,
      density: graph?.metrics.density ?? 0,
      averageDegree: graph?.metrics.averageDegree ?? 0,
      maximumDegree: graph?.metrics.maximumDegree ?? 0,
      weightedConflictTotal: graph?.metrics.weightedConflictTotal ?? 0,
      maximumWeightedDegree: graph?.metrics.maximumWeightedDegree ?? 0,
      explicitConflicts: explicitConflictCount,
      studentPrecisionAvailable: dataset?.studentPrecisionAvailable ?? false,
      registrationCount: dataset?.registrationCount ?? 0,
    },
    highConflictEvents: graph ? summarizeHighConflictEvents(graph) : [],
    conflictGraph: graph ?? null,
  };
}

export async function getAggregateDataSummary(academicSessionId?: string, semesterId?: string) {
  return getAggregateDataReadiness(academicSessionId, semesterId);
}
