import { canonicalCourseCodeKey, createAggregationIdentity, createCohortKey, createOfferingIdentity } from "./identity";
import { resolveEffectiveDuration } from "./duration";
import type { AggregateOptions, AggregationResult, CourseOffering, ExamEvent, ExamEventSource, ManualMergeResult, MergeDiagnostic, MergeValidationResult } from "./types";

function sortedOfferings(offerings: CourseOffering[]) {
  return offerings.slice().sort((a, b) => createOfferingIdentity(a).localeCompare(createOfferingIdentity(b)) || a.id.localeCompare(b.id));
}

function diagnostic(code: MergeDiagnostic["code"], severity: MergeDiagnostic["severity"], message: string, offeringIds: string[]): MergeDiagnostic {
  return { code, severity, message, offeringIds: offeringIds.slice().sort() };
}

function validCandidateCount(offering: CourseOffering) {
  return Number.isInteger(offering.candidateCount) && offering.candidateCount >= 0;
}

function resolvedMode(offerings: CourseOffering[], defaultExamMode: AggregateOptions["defaultExamMode"]) {
  const modes = [...new Set(offerings.map((offering) => offering.examMode).filter((mode): mode is NonNullable<CourseOffering["examMode"]> => mode !== undefined))];
  return modes.length ? modes[0] : defaultExamMode;
}

function isPositiveDuration(value: number | undefined) {
  return value === undefined || (Number.isInteger(value) && value > 0);
}

function resolvedDuration(offerings: CourseOffering[], mode: NonNullable<ReturnType<typeof resolvedMode>>, options: AggregateOptions) {
  if (offerings.some((offering) => !isPositiveDuration(offering.durationMinutes))) return undefined;
  const durations = offerings.map((offering) => {
    if (offering.durationMinutes !== undefined) return offering.durationMinutes;
    if (!options.durationPolicy) return undefined;
    return resolveEffectiveDuration({ examMode: mode, creditUnits: offering.creditUnits }, options.durationPolicy).durationMinutes;
  });
  return durations.length && durations.every((duration) => duration !== undefined && duration === durations[0]) ? durations[0] : undefined;
}

function buildEvent(offerings: CourseOffering[], source: ExamEventSource, options: AggregateOptions, eventId: string): { event?: ExamEvent; diagnostics: MergeDiagnostic[] } {
  const members = sortedOfferings(offerings);
  const validation = validateExamEventMerge(members, options);
  if (!validation.valid) return { diagnostics: validation.errors };
  const mode = resolvedMode(members, options.defaultExamMode ?? "PEN_ON_PAPER")!;
  const duration = resolvedDuration(members, mode, options);
  if (duration === undefined) return { diagnostics: [diagnostic("DURATION_REQUIRED", "ERROR", "A duration policy is required when an offering does not provide a duration.", members.map((offering) => offering.id))] };
  const uniqueCodes = [...new Set(members.map((offering) => offering.courseCode))];
  const uniqueCanonicalCodes = [...new Set(members.map((offering) => canonicalCourseCodeKey(offering.courseCode)))].sort();
  const uniqueCohorts = [...new Set(members.map((offering) => createCohortKey(offering.programmeId, offering.level)))].sort();
  return {
    event: {
      id: eventId,
      memberOfferings: members,
      courseCodes: uniqueCodes,
      canonicalCourseKeys: uniqueCanonicalCodes,
      title: members[0].courseTitle,
      candidateCount: members.reduce((total, offering) => total + offering.candidateCount, 0),
      cohortKeys: uniqueCohorts,
      examMode: mode,
      durationMinutes: duration,
      source,
    },
    diagnostics: validation.warnings,
  };
}

export function validateExamEventMerge(offerings: CourseOffering[], options: AggregateOptions = {}): MergeValidationResult {
  const members = sortedOfferings(offerings);
  const errors: MergeDiagnostic[] = [];
  const warnings: MergeDiagnostic[] = [];
  if (!members.length) return { valid: false, errors: [diagnostic("EMPTY_SELECTION", "ERROR", "At least one offering must be selected.", [])], warnings };
  const ids = members.map((offering) => offering.id);
  const duplicateKeys = new Map<string, string[]>();
  for (const offering of members) duplicateKeys.set(createOfferingIdentity(offering), [...(duplicateKeys.get(createOfferingIdentity(offering)) ?? []), offering.id]);
  for (const duplicateIds of duplicateKeys.values()) if (duplicateIds.length > 1) errors.push(diagnostic("DUPLICATE_OFFERING", "ERROR", "The same logical offering was selected more than once.", duplicateIds));
  for (const offering of members) if (!validCandidateCount(offering)) errors.push(diagnostic("INVALID_CANDIDATE_COUNT", "ERROR", "Candidate count must be a non-negative whole number.", [offering.id]));
  for (const offering of members) if (!isPositiveDuration(offering.durationMinutes)) errors.push(diagnostic("INVALID_DURATION", "ERROR", "Duration must be a positive whole number of minutes.", [offering.id]));
  if (new Set(members.map((offering) => offering.sessionId)).size > 1) errors.push(diagnostic("SESSION_MISMATCH", "ERROR", "Offerings from different academic sessions cannot share one exam event.", ids));
  if (new Set(members.map((offering) => offering.semesterId)).size > 1) errors.push(diagnostic("SEMESTER_MISMATCH", "ERROR", "Offerings from different semesters cannot share one exam event.", ids));
  const modes = [...new Set(members.map((offering) => offering.examMode).filter((mode): mode is NonNullable<CourseOffering["examMode"]> => mode !== undefined))];
  if (modes.length > 1) errors.push(diagnostic("MODE_MISMATCH", "ERROR", "Offerings with different examination modes cannot share one exam event.", ids));
  const mode = resolvedMode(members, options.defaultExamMode ?? "PEN_ON_PAPER");
  if (!errors.some((item) => item.code === "INVALID_DURATION")) {
    const durations = members.map((offering) => {
      if (offering.durationMinutes !== undefined) return offering.durationMinutes;
      if (!options.durationPolicy || !mode) return undefined;
      return resolveEffectiveDuration({ examMode: mode, creditUnits: offering.creditUnits }, options.durationPolicy).durationMinutes;
    });
    if (durations.some((duration) => duration === undefined)) errors.push(diagnostic("DURATION_REQUIRED", "ERROR", "Provide an offering duration or a duration policy before creating an exam event.", ids));
    else if (new Set(durations).size > 1) errors.push(diagnostic("DURATION_MISMATCH", "ERROR", "Offerings with different effective durations cannot share one exam event.", ids));
  }
  const titles = [...new Set(members.map((offering) => offering.courseTitle.trim().toLowerCase()))];
  if (titles.length > 1) warnings.push(diagnostic("TITLE_MISMATCH", "WARNING", "Course titles differ; confirm that these offerings represent the same paper.", ids));
  return { valid: errors.length === 0, errors, warnings };
}

export function aggregateCourseOfferings(offerings: CourseOffering[], options: AggregateOptions = {}): AggregationResult {
  const groups = new Map<string, CourseOffering[]>();
  for (const offering of offerings) {
    const key = createAggregationIdentity(offering);
    groups.set(key, [...(groups.get(key) ?? []), offering]);
  }
  const events: ExamEvent[] = [];
  const diagnostics: MergeDiagnostic[] = [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const members = sortedOfferings(group);
    const uniqueByIdentity = [...new Map(members.map((offering) => [createOfferingIdentity(offering), offering])).values()];
    const validation = validateExamEventMerge(members, options);
    diagnostics.push(...validation.errors);
    if (validation.errors.length) {
      diagnostics.push(...validation.warnings);
      continue;
    }
    const result = buildEvent(uniqueByIdentity, "AUTO_AGGREGATED", options, options.eventId && groups.size === 1 ? options.eventId : `auto:${key}`);
    diagnostics.push(...result.diagnostics);
    if (result.event) events.push(result.event);
  }
  return { events, diagnostics };
}

export function mergeCourseOfferings(offerings: CourseOffering[], options: AggregateOptions = {}): ManualMergeResult {
  const members = sortedOfferings(offerings);
  const validation = validateExamEventMerge(members, options);
  if (!validation.valid) return { validation };
  const key = members.map(createOfferingIdentity).join("+");
  const result = buildEvent(members, "MANUAL_MERGE", options, options.eventId ?? `manual:${key}`);
  if (!result.event) {
    const errors = result.diagnostics.filter((item) => item.severity === "ERROR");
    const warnings = result.diagnostics.filter((item) => item.severity === "WARNING");
    return { validation: { valid: false, errors: [...validation.errors, ...errors], warnings: [...validation.warnings, ...warnings] } };
  }
  return { event: result.event, validation: { ...validation, warnings: [...validation.warnings, ...result.diagnostics] } };
}

export const aggregateSameCodeOfferings = aggregateCourseOfferings;
export const createManualExamEvent = mergeCourseOfferings;
