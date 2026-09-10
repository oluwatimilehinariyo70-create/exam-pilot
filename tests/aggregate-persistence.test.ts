import { describe, expect, it } from "vitest";

import { createCohortKey } from "@/domain/exams";
import { createCourseOffering, normalizeConflictPair } from "@/server/exams/aggregate-services";
import { courseOfferingToDomain, examEventToDomain, type PersistedCourseOffering, type PersistedExamEvent } from "@/server/exams/mappers";

function persistedOffering(overrides: Partial<PersistedCourseOffering> = {}): PersistedCourseOffering {
  return {
    id: "offering-1",
    academicSessionId: "session-1",
    semesterId: "semester-1",
    courseId: "course-1",
    programmeId: "programme-1",
    level: 200,
    candidateCount: 150,
    examModeOverride: null,
    durationMinutesOverride: null,
    active: true,
    source: "MANUAL",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    course: {
      id: "course-1",
      code: "PHY 202",
      normalizedCode: "PHY202",
      title: "General Physics II",
      creditUnits: 3,
      level: 200,
      departmentId: "department-1",
      semesterId: "semester-1",
      estimatedStudentCount: 150,
      defaultExamMode: "PEN_ON_PAPER",
      defaultDurationMinutes: 180,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      department: {
        id: "department-1",
        collegeId: "college-1",
        name: "Physics",
        code: "PHY",
        active: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
    programme: {
      id: "programme-1",
      departmentId: "department-1",
      name: "B.Sc. Computer Science",
      code: "BSC-CS",
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("aggregate persistence foundation", () => {
  it("maps a persisted offering to the pure domain contract", () => {
    const domain = courseOfferingToDomain(persistedOffering());
    expect(domain).toMatchObject({
      id: "offering-1",
      courseCode: "PHY 202",
      candidateCount: 150,
      examMode: "PEN_ON_PAPER",
      durationMinutes: 180,
    });
    expect(createCohortKey(domain.programmeId, domain.level)).toBe("programme-1:200");
  });

  it("maps event memberships and derives candidate totals from offerings", () => {
    const first = persistedOffering();
    const second = persistedOffering({ id: "offering-2", programmeId: "programme-2", candidateCount: 50, programme: { ...first.programme, id: "programme-2", code: "BSC-MTH", name: "B.Sc. Mathematics" } });
    const record = {
      id: "event-1",
      academicSessionId: "session-1",
      semesterId: "semester-1",
      examPeriodId: null,
      title: "General Physics II",
      examMode: "PEN_ON_PAPER" as const,
      durationMinutes: 180,
      source: "AUTO_AGGREGATED" as const,
      status: "DRAFT" as const,
      manualMergeReason: null,
      createdById: null,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      offerings: [
        { id: "membership-1", examEventId: "event-1", courseOfferingId: first.id, createdAt: first.createdAt, courseOffering: first },
        { id: "membership-2", examEventId: "event-1", courseOfferingId: second.id, createdAt: second.createdAt, courseOffering: second },
      ],
    } as PersistedExamEvent;
    const domain = examEventToDomain(record);
    expect(domain.candidateCount).toBe(200);
    expect(domain.memberOfferings).toHaveLength(2);
    expect(domain.cohortKeys).toEqual(["programme-1:200", "programme-2:200"]);
  });

  it("normalizes reversed conflict pairs to one identity", () => {
    expect(normalizeConflictPair("course-b", "course-a")).toEqual(["course-a", "course-b"]);
    expect(normalizeConflictPair("course-a", "course-b")).toEqual(["course-a", "course-b"]);
  });

  it("rejects invalid candidate counts before any database call", async () => {
    await expect(createCourseOffering({ academicSessionId: "s", semesterId: "m", courseId: "c", programmeId: "p", level: 200, candidateCount: -1 })).rejects.toMatchObject({ code: "INVALID_CANDIDATE_COUNT" });
  });
});
