import { describe, expect, it } from "vitest";

import {
  buildCohortConflictGraph,
  buildConflictGraph,
  getConflictReasons,
  getConflictWeight,
  getEventConflictDegree,
  getWeightedConflictDegree,
  hasConflict,
  summarizeHighConflictEvents,
  type ExamEvent,
  evaluateAggregateReadiness,
} from "@/domain/exams";

function event(id: string, offerings: { courseId: string; courseCode: string; programmeId: string; programmeName: string; level: number; candidateCount: number }[]): ExamEvent {
  const memberOfferings = offerings.map((offering, index) => ({ id: `${id}-offering-${index}`, sessionId: "session", semesterId: "semester", ...offering, courseTitle: offering.courseCode, creditUnits: 3, examMode: "PEN_ON_PAPER" as const, durationMinutes: 120 }));
  return { id, memberOfferings, courseCodes: [...new Set(memberOfferings.map((item) => item.courseCode))], canonicalCourseKeys: [...new Set(memberOfferings.map((item) => item.courseCode))], title: memberOfferings[0]?.courseCode ?? id, candidateCount: memberOfferings.reduce((sum, item) => sum + item.candidateCount, 0), cohortKeys: [...new Set(memberOfferings.map((item) => `${item.programmeId}:${item.level}`))], examMode: "PEN_ON_PAPER", durationMinutes: 120, source: "AUTO_AGGREGATED" };
}

describe("aggregate conflict graph", () => {
  it("creates a cohort edge for the same programme and level", () => {
    const graph = buildCohortConflictGraph([event("a", [{ courseId: "phy", courseCode: "PHY202", programmeId: "cs", programmeName: "Computer Science", level: 200, candidateCount: 150 }]), event("b", [{ courseId: "csc", courseCode: "CSC204", programmeId: "cs", programmeName: "Computer Science", level: 200, candidateCount: 180 }])]);
    expect(graph.edges).toHaveLength(1); expect(graph.edges[0].weight).toBe(150); expect(graph.edges[0].reasons[0].type).toBe("COHORT_OVERLAP");
  });

  it("does not connect different levels or programmes", () => {
    const graph = buildCohortConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 20 }]), event("b", [{ courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 300, candidateCount: 20 }]), event("c", [{ courseId: "c", courseCode: "C", programmeId: "math", programmeName: "Math", level: 200, candidateCount: 20 }])]);
    expect(graph.edges).toHaveLength(0);
  });

  it("sums multiple shared cohorts using effective minimum population", () => {
    const graph = buildCohortConflictGraph([event("a", [{ courseId: "a1", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 150 }, { courseId: "a2", courseCode: "A", programmeId: "math", programmeName: "Math", level: 200, candidateCount: 50 }]), event("b", [{ courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 120 }, { courseId: "b2", courseCode: "B", programmeId: "math", programmeName: "Math", level: 200, candidateCount: 70 }])]);
    expect(graph.edges[0].weight).toBe(170); expect(graph.edges[0].reasons).toHaveLength(2);
  });

  it("deduplicates a cohort inside a manually merged event", () => {
    const graph = buildCohortConflictGraph([event("merged", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 150 }, { courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 90 }]), event("other", [{ courseId: "c", courseCode: "C", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 140 }])]);
    expect(graph.edges[0].weight).toBe(140); expect(graph.cohortPopulations.merged).toHaveLength(1); expect(graph.cohortPopulations.merged[0].candidateCount).toBe(150);
  });

  it("never creates self edges", () => {
    const graph = buildCohortConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 100 }, { courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 90 }])]);
    expect(graph.edges).toHaveLength(0);
  });

  it("merges hard explicit, cohort, and student reasons into one edge", () => {
    const graph = buildConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 100 }]), event("b", [{ courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 80 }])], { explicitConflicts: [{ id: "x", eventAId: "a", eventBId: "b", hard: true, conflictType: "CARRYOVER", estimatedSharedCandidates: 5 }], studentOverlaps: [{ eventAId: "b", eventBId: "a", sharedStudentCount: 3 }] });
    expect(graph.edges).toHaveLength(1); expect(graph.edges[0].hard).toBe(true); expect(graph.edges[0].weight).toBe(80); expect(graph.edges[0].reasons.map((reason) => reason.type)).toEqual(["COHORT_OVERLAP", "EXPLICIT_HARD_CONFLICT", "INDIVIDUAL_REGISTRATION_OVERLAP"]);
  });

  it("creates weighted explicit and student-only edges without cohort overlap", () => {
    const graph = buildConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 20 }]), event("b", [{ courseId: "b", courseCode: "B", programmeId: "math", programmeName: "Math", level: 200, candidateCount: 20 }])], { explicitConflicts: [{ id: "x", eventAId: "a", eventBId: "b", hard: false, conflictType: "MANUAL", estimatedSharedCandidates: 12 }], studentOverlaps: [{ eventAId: "a", eventBId: "b", sharedStudentCount: 4 }] });
    expect(graph.edges[0].weight).toBe(12); expect(graph.edges[0].hard).toBe(false); expect(getConflictReasons(graph, "b", "a")).toHaveLength(2);
  });

  it("exposes deterministic graph APIs and metrics", () => {
    const graph = buildCohortConflictGraph([event("b", [{ courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 5 }]), event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 6 }]), event("c", [{ courseId: "c", courseCode: "C", programmeId: "math", programmeName: "Math", level: 200, candidateCount: 6 }])]);
    expect(graph.eventIds).toEqual(["a", "b", "c"]); expect(hasConflict(graph, "b", "a")).toBe(true); expect(getConflictWeight(graph, "a", "b")).toBe(5); expect(getEventConflictDegree(graph, "a")).toBe(1); expect(getWeightedConflictDegree(graph, "a")).toBe(5); expect(graph.metrics.density).toBeCloseTo(1 / 3);
  });

  it("handles empty and single-node density safely", () => {
    expect(buildConflictGraph([]).metrics).toMatchObject({ events: 0, edges: 0, density: 0 });
    expect(buildCohortConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 1 }])]).metrics).toMatchObject({ events: 1, maximumPossibleEdges: 0, density: 0 });
  });

  it("orders high-conflict events by degree, weight, then id", () => {
    const graph = buildCohortConflictGraph([event("a", [{ courseId: "a", courseCode: "A", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 10 }]), event("b", [{ courseId: "b", courseCode: "B", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 9 }]), event("c", [{ courseId: "c", courseCode: "C", programmeId: "cs", programmeName: "CS", level: 200, candidateCount: 8 }])]);
    expect(summarizeHighConflictEvents(graph, 2).map((item) => item.eventId)).toEqual(["a", "b"]);
  });

  it("keeps missing student precision non-blocking while candidate blockers remain hard", () => {
    const result = evaluateAggregateReadiness({ offeringCount: 2, eventCount: 2, missingCandidateCount: 1, unresolvedModeCount: 0, unresolvedDurationCount: 0, incompatibleAggregationCount: 0, invalidExplicitConflictCount: 0, studentPrecisionAvailable: false, manualMergeCount: 0 });
    expect(result.status).toBe("BLOCKED"); expect(result.blockers.map((issue) => issue.code)).toContain("MISSING_CANDIDATE_COUNT"); expect(result.warnings.map((issue) => issue.code)).toContain("NO_STUDENT_PRECISION_DATA");
  });

  it("treats high conflict density as a warning rather than impossibility", () => {
    const result = evaluateAggregateReadiness({ offeringCount: 4, eventCount: 4, missingCandidateCount: 0, unresolvedModeCount: 0, unresolvedDurationCount: 0, incompatibleAggregationCount: 0, invalidExplicitConflictCount: 0, studentPrecisionAvailable: true, manualMergeCount: 0, graph: { events: 4, edges: 4, maximumPossibleEdges: 6, density: 0.66, averageDegree: 2, maximumDegree: 3, weightedConflictTotal: 100, maximumWeightedDegree: 60 } });
    expect(result.status).toBe("READY_WITH_WARNINGS"); expect(result.warnings[0].code).toBe("HIGH_CONFLICT_DENSITY");
  });
});
