import type { CourseOffering } from "./types";

/** Preserve a readable display form while making spacing/case consistent. */
export function normalizeCourseDisplayCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Canonical identity used for matching codes such as PHY202, PHY 202, and PHY-202. */
export function canonicalCourseCodeKey(value: string) {
  return normalizeCourseDisplayCode(value).replace(/[^A-Z0-9]/g, "");
}

export function createCohortKey(programmeId: string, level: number) {
  const programme = programmeId.trim();
  if (!programme) throw new Error("A programme ID is required to create a cohort key.");
  if (!Number.isInteger(level)) throw new Error("A whole-number level is required to create a cohort key.");
  return `${programme}:${level}`;
}

export function createOfferingIdentity(offering: CourseOffering) {
  return [offering.sessionId, offering.semesterId, offering.programmeId, offering.level, canonicalCourseCodeKey(offering.courseCode)].join("|");
}

export function createAggregationIdentity(offering: CourseOffering) {
  return [offering.sessionId, offering.semesterId, canonicalCourseCodeKey(offering.courseCode)].join("|");
}
