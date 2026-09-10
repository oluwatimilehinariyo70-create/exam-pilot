import { describe, expect, it } from "vitest";

import {
  aggregateCourseOfferings,
  canonicalCourseCodeKey,
  createCohortKey,
  eventsShareCohort,
  getSharedCohorts,
  mergeCourseOfferings,
  resolveEffectiveDuration,
  type CourseOffering,
  type DurationPolicy,
} from "@/domain/exams";

const policy: DurationPolicy = {
  penOnPaperByCreditUnits: { 3: 180 },
  cbtByCreditUnits: { 3: 120 },
  defaultPenOnPaperMinutes: 120,
  defaultCbtMinutes: 90,
};

function offering(overrides: Partial<CourseOffering> = {}): CourseOffering {
  return {
    id: "offering-1",
    sessionId: "session-1",
    semesterId: "semester-1",
    courseId: "course-1",
    courseCode: "PHY202",
    courseTitle: "Physics II",
    programmeId: "programme-cs",
    programmeName: "Computer Science",
    departmentId: "department-cs",
    level: 200,
    candidateCount: 150,
    creditUnits: 3,
    examMode: "PEN_ON_PAPER",
    ...overrides,
  };
}

function aggregate(input: CourseOffering[]) {
  return aggregateCourseOfferings(input, { durationPolicy: policy });
}

describe("aggregate exam domain", () => {
  it("canonicalizes equivalent course codes without changing display values", () => {
    expect(new Set(["PHY202", "PHY 202", "PHY-202", "phy202"].map(canonicalCourseCodeKey)).size).toBe(1);
    expect(offering({ courseCode: "PHY 202" }).courseCode).toBe("PHY 202");
  });

  it("creates stable cohort keys", () => {
    expect(createCohortKey("programme-cs", 200)).toBe("programme-cs:200");
    expect(createCohortKey("programme-cs", 200)).toBe(createCohortKey("programme-cs", 200));
    expect(createCohortKey("programme-cs", 200)).not.toBe(createCohortKey("programme-cs", 300));
    expect(createCohortKey("programme-cs", 200)).not.toBe(createCohortKey("programme-mth", 200));
  });

  it("aggregates same-code offerings within one session and semester", () => {
    const result = aggregate([
      offering({ id: "cs-phy", candidateCount: 150 }),
      offering({ id: "mth-phy", courseCode: "PHY 202", programmeId: "programme-mth", programmeName: "Mathematics", departmentId: "department-mth", candidateCount: 50 }),
    ]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ candidateCount: 200, courseCodes: ["PHY202", "PHY 202"], examMode: "PEN_ON_PAPER", source: "AUTO_AGGREGATED" });
    expect(result.events[0].memberOfferings).toHaveLength(2);
    expect(result.events[0].cohortKeys).toEqual(["programme-cs:200", "programme-mth:200"]);
  });

  it("does not aggregate across sessions or semesters", () => {
    const result = aggregate([
      offering({ id: "session-one", candidateCount: 150 }),
      offering({ id: "session-two", sessionId: "session-2", candidateCount: 50 }),
      offering({ id: "semester-two", semesterId: "semester-2", candidateCount: 25 }),
    ]);
    expect(result.events).toHaveLength(3);
    expect(result.events.map((event) => event.candidateCount)).toEqual([150, 25, 50]);
  });

  it("flags duplicate logical offerings without double-counting them", () => {
    const result = aggregate([offering({ id: "duplicate-a" }), offering({ id: "duplicate-b" })]);
    expect(result.events).toHaveLength(0);
    expect(result.diagnostics.some((item) => item.code === "DUPLICATE_OFFERING")).toBe(true);
  });

  it("does not silently aggregate mode mismatches", () => {
    const result = aggregate([offering({ id: "paper" }), offering({ id: "cbt", programmeId: "programme-mth", examMode: "CBT" })]);
    expect(result.events).toHaveLength(0);
    expect(result.diagnostics.some((item) => item.code === "MODE_MISMATCH" && item.severity === "ERROR")).toBe(true);
  });

  it("surfaces title mismatch as a warning when other compatibility checks pass", () => {
    const result = aggregate([offering({ id: "first" }), offering({ id: "second", programmeId: "programme-mth", courseTitle: "Physics II (Alternative Title)" })]);
    expect(result.events).toHaveLength(1);
    expect(result.diagnostics.some((item) => item.code === "TITLE_MISMATCH" && item.severity === "WARNING")).toBe(true);
  });

  it("creates a manual cross-code merge while retaining members and codes", () => {
    const result = mergeCourseOfferings([
      offering({ id: "csc-202", courseId: "course-csc", courseCode: "CSC202", candidateCount: 180 }),
      offering({ id: "mth-202", courseId: "course-mth", courseCode: "MTH202", programmeId: "programme-mth", programmeName: "Mathematics", departmentId: "department-mth", candidateCount: 120 }),
    ], { durationPolicy: policy });
    expect(result.validation.valid).toBe(true);
    expect(result.event).toMatchObject({ candidateCount: 300, courseCodes: ["CSC202", "MTH202"], source: "MANUAL_MERGE" });
    expect(result.event?.memberOfferings).toHaveLength(2);
  });

  it("rejects manual merges across sessions and semesters", () => {
    const result = mergeCourseOfferings([offering({ id: "first" }), offering({ id: "second", courseCode: "MTH202", sessionId: "session-2" })], { durationPolicy: policy });
    expect(result.event).toBeUndefined();
    expect(result.validation.errors.map((item) => item.code)).toContain("SESSION_MISMATCH");
  });

  it("rejects manual merges across examination modes", () => {
    const result = mergeCourseOfferings([offering({ id: "paper" }), offering({ id: "cbt", courseCode: "MTH202", examMode: "CBT" })], { durationPolicy: policy });
    expect(result.validation.errors.map((item) => item.code)).toContain("MODE_MISMATCH");
  });

  it("rejects manual merges with different effective durations", () => {
    const result = mergeCourseOfferings([offering({ id: "three-units" }), offering({ id: "custom-duration", courseCode: "MTH202", durationMinutes: 150 })], { durationPolicy: policy });
    expect(result.validation.errors.map((item) => item.code)).toContain("DURATION_MISMATCH");
  });

  it("resolves duration using event, offering, course, credit-unit, then mode defaults", () => {
    expect(resolveEffectiveDuration({ examMode: "PEN_ON_PAPER", creditUnits: 3, eventDurationMinutes: 210 }, policy)).toEqual({ durationMinutes: 210, source: "EVENT_OVERRIDE" });
    expect(resolveEffectiveDuration({ examMode: "PEN_ON_PAPER", creditUnits: 3, offeringDurationMinutes: 150 }, policy)).toEqual({ durationMinutes: 150, source: "OFFERING_OVERRIDE" });
    expect(resolveEffectiveDuration({ examMode: "PEN_ON_PAPER", creditUnits: 3, courseDefaultDurationMinutes: 140 }, policy)).toEqual({ durationMinutes: 140, source: "COURSE_DEFAULT" });
    expect(resolveEffectiveDuration({ examMode: "PEN_ON_PAPER", creditUnits: 3 }, policy)).toEqual({ durationMinutes: 180, source: "CREDIT_UNIT_POLICY" });
    expect(resolveEffectiveDuration({ examMode: "CBT", creditUnits: 1 }, policy)).toEqual({ durationMinutes: 90, source: "MODE_DEFAULT" });
  });

  it("detects shared and non-shared cohorts", () => {
    const first = aggregate([offering({ id: "first" })]).events[0];
    const shared = aggregate([offering({ id: "shared", courseCode: "MTH201" })]).events[0];
    const differentLevel = aggregate([offering({ id: "different-level", courseCode: "MTH201", level: 300 })]).events[0];
    expect(eventsShareCohort(first, shared)).toBe(true);
    expect(getSharedCohorts(first, shared)).toEqual(["programme-cs:200"]);
    expect(eventsShareCohort(first, differentLevel)).toBe(false);
  });

  it("is deterministic for the same offerings in a different input order", () => {
    const first = aggregate([offering({ id: "cs" }), offering({ id: "mth", programmeId: "programme-mth", courseCode: "PHY 202", candidateCount: 50 })]);
    const second = aggregate([offering({ id: "mth", programmeId: "programme-mth", courseCode: "PHY 202", candidateCount: 50 }), offering({ id: "cs" })]);
    expect(second).toEqual(first);
  });

  it("supports explicit conflict semantics without persistence", () => {
    const conflict = { id: "conflict-1", eventOrCourseA: "event-a", eventOrCourseB: "event-b", severity: "HARD", type: "CARRYOVER", estimatedSharedCandidates: 12, reason: "Known carryover overlap" } as const;
    expect(conflict.severity).toBe("HARD");
    expect(conflict.type).toBe("CARRYOVER");
  });
});
