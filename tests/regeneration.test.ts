import { regenerateAggregateEvents } from "@/domain/timetable/aggregate/regeneration";
import { describe, expect, it } from "vitest";
import { buildConflictGraph, type ExamEvent } from "@/domain/exams";
import { assessPlannerFeasibility, generateCalendarProposal, monthRange, type PlannerDay } from "@/domain/timetable/planner";
import { intervalContains, intervalDuration, intervalsAdjacent, intervalsOverlap, makeInterval, minutesToTime, timeToMinutes } from "@/domain/timetable/intervals";
import { generateFlexibleAggregateTimetable, validateAggregateTimetable, type AggregateSchedulingDataset, type SchedulingExamEvent } from "@/domain/timetable";
import { resolveAggregateGenerationConfig } from "@/domain/timetable";

const policy = { defaultDayStartTime: "08:00", defaultDayEndTime: "18:00", defaultTurnaroundMinutes: 30, writtenTurnaroundMinutes: 30, cbtTurnaroundMinutes: 15, timeGranularityMinutes: 30, weekdays: [false, true, true, true, true, true, false] };
function event(id: string, durationMinutes = 180): SchedulingExamEvent { return { id, title: id, memberCourseCodes: [id], candidateCount: 50, cohortKeys: [`cohort-${id}`], examMode: "PEN_ON_PAPER", durationMinutes, source: "AUTO_AGGREGATED", offeringIds: [id] }; }
function dataset(events: SchedulingExamEvent[]): AggregateSchedulingDataset { const graphEvents = events.map((item) => ({ id: item.id, title: item.title, memberOfferings: [], courseCodes: item.memberCourseCodes, canonicalCourseKeys: item.memberCourseCodes, candidateCount: item.candidateCount, cohortKeys: item.cohortKeys, examMode: item.examMode, durationMinutes: item.durationMinutes, source: item.source } as unknown as ExamEvent)); return { session: { id: "s", name: "Session", active: true }, semester: { id: "sem", sessionId: "s", name: "Semester", active: true }, examPeriod: { id: "p", sessionId: "s", semesterId: "sem", name: "Period", startDate: "2026-01-01", endDate: "2026-01-31", active: true }, events, timeSlots: [], calendarDays: [{ examPeriodId: "p", date: "2026-01-05", enabled: true, dayType: "WEEKDAY", startTime: "08:00", endTime: "18:00" }], timePolicy: policy, schedulingMode: "FLEXIBLE_INTERVALS", conflictGraph: buildConflictGraph(graphEvents), venues: [{ id: "v", code: "V", name: "Hall", capacity: 100, examCapacity: 100, capability: "WRITTEN", active: true }], venueUnavailability: [], invigilators: [{ id: "i", staffId: "I", name: "Invigilator", active: true, maximumDailyAssignments: 10 }], invigilatorUnavailability: [], config: resolveAggregateGenerationConfig({ maxGenerationAttempts: 1, seed: 4 }) }; }


describe("partial regeneration", () => {
  it("preserves pins and unaffected assignments", () => {
    const input = dataset([event("A",60), event("B",60), event("C",60)]);
    const before = generateFlexibleAggregateTimetable(input);
    const result = regenerateAggregateEvents(input,before,["A"],"SELECTED",["A","B"]);
    expect(result.candidate.assignments.find((a)=>a.eventId==="A")).toEqual(before.assignments.find((a)=>a.eventId==="A"));
    expect(result.candidate.assignments.find((a)=>a.eventId==="C")).toEqual(before.assignments.find((a)=>a.eventId==="C"));
    expect(result.changedEventIds).toEqual(["B"]);
  });
  it("places a late course without moving the prior timetable", () => {
    const before = generateFlexibleAggregateTimetable(dataset([event("A",60)]));
    const result = regenerateAggregateEvents(dataset([event("A",60),event("B",60)]),before,["A"],"LATE_COURSES");
    expect(result.candidate.assignments[0]).toEqual(before.assignments[0]);
    expect(result.candidate.assignments).toHaveLength(2);
    expect(result.diagnostics).toEqual([]);
  });
  it("reports impossible placement while retaining pinned exams", () => {
    const input=dataset([event("A",600)]); const before=generateFlexibleAggregateTimetable(input);
    const next=dataset([event("A",600),event("B",60)]);
    const result=regenerateAggregateEvents(next,before,["A"],"UNRESOLVED");
    expect(result.candidate.assignments).toEqual(before.assignments);
    expect(result.diagnostics.some((d)=>d.code==="PINNED_ASSIGNMENTS_BLOCK_PLACEMENT")).toBe(true);
  });
  it("diagnoses an invalid pin instead of moving it", () => {
    const input=dataset([event("A",60)]); const before=generateFlexibleAggregateTimetable(input);
    before.assignments[0].startTime="01:00"; before.assignments[0].endTime="02:00";
    const result=regenerateAggregateEvents(input,before,["A"],"UNRESOLVED");
    expect(result.candidate).toEqual(before);
    expect(result.diagnostics[0].code).toBe("PRESERVED_ASSIGNMENT_INVALID");
  });
});
