import { describe, expect, it } from "vitest";

import { buildConflictGraph, type ExamEvent } from "@/domain/exams";
import { generateAggregateTimetable, resolveAggregateGenerationConfig, validateAggregateTimetable, type AggregateCalendarDay, type AggregateSchedulingDataset, type SchedulingExamEvent } from "@/domain/timetable";

function event(id: string, overrides: Partial<SchedulingExamEvent> = {}): ExamEvent {
  const cohort = overrides.cohortKeys?.[0] ?? `p-${id}|100`;
  const [programmeId, levelValue] = cohort.split("|");
  const level = Number(levelValue ?? 100);
  return {
    id,
    title: overrides.title ?? `Event ${id}`,
    memberOfferings: [{ id: `offering-${id}`, sessionId: "session", semesterId: "semester", courseId: `course-${id}`, courseCode: id, courseTitle: `Course ${id}`, programmeId, programmeName: programmeId, level, candidateCount: overrides.candidateCount ?? 50, examMode: overrides.examMode ?? "PEN_ON_PAPER", durationMinutes: overrides.durationMinutes ?? 120 }],
    courseCodes: [id],
    canonicalCourseKeys: [id],
    candidateCount: overrides.candidateCount ?? 50,
    cohortKeys: overrides.cohortKeys ?? [cohort],
    examMode: overrides.examMode ?? "PEN_ON_PAPER",
    durationMinutes: overrides.durationMinutes ?? 120,
    source: "AUTO_AGGREGATED",
    ...overrides,
  } as ExamEvent;
}

function dataset(events: SchedulingExamEvent[], options: Parameters<typeof buildConflictGraph>[1] = {}, overrides: Partial<AggregateSchedulingDataset> = {}): AggregateSchedulingDataset {
  const graphEvents = events.map((item) => event(item.id, item));
  return {
    session: { id: "session", name: "Session", active: true },
    semester: { id: "semester", sessionId: "session", name: "Semester", active: true },
    examPeriod: { id: "period", sessionId: "session", semesterId: "semester", name: "Period", startDate: "2026-01-01", endDate: "2026-01-31", active: true },
    events,
    timeSlots: [{ id: "slot-1", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "11:00" }, { id: "slot-2", examPeriodId: "period", date: "2026-01-10", startTime: "11:30", endTime: "13:30" }],
    conflictGraph: buildConflictGraph(graphEvents, options),
    venues: [{ id: "venue-1", code: "V1", name: "Venue 1", capacity: 200, examCapacity: 200, usableComputerCapacity: 0, capability: "WRITTEN", active: true }],
    venueUnavailability: [],
    invigilators: [{ id: "inv-1", staffId: "I1", name: "Invigilator 1", active: true, maximumDailyAssignments: 10, maximumTotalAssignments: 20 }],
    invigilatorUnavailability: [],
    config: resolveAggregateGenerationConfig({ maxGenerationAttempts: 4, seed: 11 }),
    ...overrides,
  };
}

describe("aggregate fixed-slot timetable engine", () => {
  const bouestiDay = (overrides: Partial<AggregateCalendarDay> = {}): AggregateCalendarDay => ({ examPeriodId: "period", date: "2026-01-10", enabled: true, dayType: "WEEKDAY", startTime: "08:30", endTime: "17:30", ...overrides });

  it("schedules event units without student or hall identity data", () => {
    const input = dataset([event("A", { candidateCount: 80 }) as unknown as SchedulingExamEvent]);
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.assignments).toHaveLength(1);
    expect(result.unscheduledEvents).toHaveLength(0);
  });

  it("rejects a duration that does not fit a fixed slot", () => {
    const input = dataset([event("LONG", { durationMinutes: 180 }) as unknown as SchedulingExamEvent], {}, { timeSlots: [{ id: "short", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "11:00" }] });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.unscheduledEvents[0]?.diagnostics.attemptedSlots[0]?.hardViolations.some((item) => item.code === "EVENT_DURATION_EXCEEDS_SLOT")).toBe(true);
  });

  it("uses written capability and multi-venue allocation", () => {
    const input = dataset([event("LARGE", { candidateCount: 300 }) as unknown as SchedulingExamEvent], {}, { venues: [{ id: "v1", code: "V1", name: "V1", capacity: 170, examCapacity: 170, capability: "WRITTEN", active: true }, { id: "v2", code: "V2", name: "V2", capacity: 150, examCapacity: 150, capability: "WRITTEN", active: true }], invigilators: [{ id: "i1", staffId: "I1", name: "I1", active: true, maximumDailyAssignments: 10 }, { id: "i2", staffId: "I2", name: "I2", active: true, maximumDailyAssignments: 10 }] });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.assignments[0]?.venues).toHaveLength(2);
    expect(result.assignments[0]?.venues.reduce((sum, item) => sum + item.allocatedCapacity, 0)).toBeGreaterThanOrEqual(300);
  });

  it("uses CBT computer capacity and reports CBT capacity failure without batching", () => {
    const cbt = event("CBT", { examMode: "CBT", candidateCount: 250 }) as unknown as SchedulingExamEvent;
    const input = dataset([cbt], {}, { venues: [{ id: "cbt-v", code: "CBT", name: "CBT", capacity: 400, examCapacity: 400, usableComputerCapacity: 100, capability: "CBT", active: true }] });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.assignments).toHaveLength(0);
    expect(result.unscheduledEvents[0]?.diagnostics.attemptedSlots.flatMap((slot) => slot.hardViolations).some((item) => item.code === "INSUFFICIENT_CBT_CAPACITY")).toBe(true);
  });

  it("keeps hard cohort and explicit conflicts out of one slot while scoring soft conflicts", () => {
    const first = event("A", { cohortKeys: ["p-1|100"] }) as unknown as SchedulingExamEvent;
    const second = event("B", { cohortKeys: ["p-1|100"] }) as unknown as SchedulingExamEvent;
    const hardInput = dataset([first, second], {}, { timeSlots: [{ id: "only", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "11:00" }] });
    const hardResult = generateAggregateTimetable(hardInput, { maxGenerationAttempts: 1 });
    expect(hardResult.unscheduledEvents).toHaveLength(1);
    const softFirst = event("C", { cohortKeys: ["p-1|100"] }) as unknown as SchedulingExamEvent;
    const softSecond = event("D", { cohortKeys: ["p-2|100"] }) as unknown as SchedulingExamEvent;
    const softInput = dataset([softFirst, softSecond], { explicitConflicts: [{ id: "soft", eventAId: "C", eventBId: "D", hard: false, conflictType: "MANUAL" }] }, { timeSlots: [{ id: "same", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "11:00" }], venues: [{ id: "v1", code: "V1", name: "V1", capacity: 100, examCapacity: 100, capability: "WRITTEN", active: true }, { id: "v2", code: "V2", name: "V2", capacity: 100, examCapacity: 100, capability: "WRITTEN", active: true }], invigilators: [{ id: "i1", staffId: "I1", name: "I1", active: true, maximumDailyAssignments: 10 }, { id: "i2", staffId: "I2", name: "I2", active: true, maximumDailyAssignments: 10 }] });
    const softResult = generateAggregateTimetable(softInput, { maxGenerationAttempts: 1 });
    expect(softResult.metrics.softConflictOverlapCount).toBe(1);
  });

  it("records cohort back-to-back and daily overload penalties", () => {
    const events = ["A", "B", "C"].map((id) => event(id, { cohortKeys: ["p-1|100"] }) as unknown as SchedulingExamEvent);
    const input = dataset(events, {}, { timeSlots: [{ id: "s1", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "11:00" }, { id: "s2", examPeriodId: "period", date: "2026-01-10", startTime: "11:00", endTime: "13:00" }, { id: "s3", examPeriodId: "period", date: "2026-01-10", startTime: "13:00", endTime: "15:00" }], invigilators: [{ id: "i1", staffId: "I1", name: "I1", active: true, maximumDailyAssignments: 10 }, { id: "i2", staffId: "I2", name: "I2", active: true, maximumDailyAssignments: 10 }, { id: "i3", staffId: "I3", name: "I3", active: true, maximumDailyAssignments: 10 }] });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1, maxCohortExamsPerDay: 2 });
    expect(result.metrics.cohortBackToBackCount).toBeGreaterThan(0);
    expect(result.metrics.cohortDailyOverloadCount).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed and validates its output", () => {
    const input = dataset([event("A") as unknown as SchedulingExamEvent, event("B", { cohortKeys: ["p-2|100"] }) as unknown as SchedulingExamEvent]);
    const first = generateAggregateTimetable(input, { maxGenerationAttempts: 3, seed: 99 });
    const second = generateAggregateTimetable(input, { maxGenerationAttempts: 3, seed: 99 });
    expect(second.assignments).toEqual(first.assignments);
    expect(validateAggregateTimetable(first, input)).toEqual([]);
  });

  it("prefers the smallest BOUESTI session that fits the exam", () => {
    const input = dataset([event("TWO_HOUR", { durationMinutes: 120 }) as unknown as SchedulingExamEvent], {}, {
      calendarDays: [bouestiDay()],
      timeSlots: [
        { id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" },
        { id: "midday", examPeriodId: "period", date: "2026-01-10", startTime: "12:00", endTime: "14:00" },
        { id: "afternoon", examPeriodId: "period", date: "2026-01-10", startTime: "14:30", endTime: "17:30" },
      ],
    });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.assignments[0]?.timeSlotId).toBe("midday");
  });

  it("falls back to a longer session when the preferred duration is unavailable", () => {
    const input = dataset([event("TWO_HOUR", { durationMinutes: 120 }) as unknown as SchedulingExamEvent], {}, {
      calendarDays: [bouestiDay()],
      timeSlots: [
        { id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" },
        { id: "afternoon", examPeriodId: "period", date: "2026-01-10", startTime: "14:30", endTime: "17:30" },
      ],
    });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(["morning", "afternoon"]).toContain(result.assignments[0]?.timeSlotId);
  });

  it("rejects a three-hour exam from the two-hour BOUESTI session", () => {
    const input = dataset([event("THREE_HOUR", { durationMinutes: 180 }) as unknown as SchedulingExamEvent], {}, {
      calendarDays: [bouestiDay()],
      timeSlots: [{ id: "midday", examPeriodId: "period", date: "2026-01-10", startTime: "12:00", endTime: "14:00" }],
    });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.unscheduledEvents[0]?.diagnostics.attemptedSlots[0]?.hardViolations.some((item) => item.code === "EVENT_DURATION_EXCEEDS_SLOT")).toBe(true);
  });

  it("skips fixed sessions on disabled or blackout days", () => {
    for (const day of [bouestiDay({ enabled: false }), bouestiDay({ blackoutType: "PUBLIC_HOLIDAY" })]) {
      const input = dataset([event("A") as unknown as SchedulingExamEvent], {}, { calendarDays: [day], timeSlots: [{ id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" }] });
      const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
      expect(result.assignments).toHaveLength(0);
      expect(result.unscheduledEvents[0]?.diagnostics.attemptedSlots[0]?.hardViolations.some((item) => item.code === "INVALID_CALENDAR_WINDOW")).toBe(true);
    }
  });

  it("skips fixed sessions outside configured daily hours", () => {
    const input = dataset([event("A") as unknown as SchedulingExamEvent], {}, { calendarDays: [bouestiDay({ startTime: "09:00" })], timeSlots: [{ id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" }] });
    const result = generateAggregateTimetable(input, { maxGenerationAttempts: 1 });
    expect(result.assignments).toHaveLength(0);
    expect(result.unscheduledEvents[0]?.diagnostics.attemptedSlots[0]?.hardViolations.some((item) => item.code === "INVALID_CALENDAR_WINDOW")).toBe(true);
  });

  it("enforces fixed-session turnaround while allowing the BOUESTI thirty-minute gap", () => {
    const valid = dataset([event("A", { durationMinutes: 120 }) as unknown as SchedulingExamEvent], {}, { calendarDays: [bouestiDay()], timeSlots: [{ id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" }, { id: "midday", examPeriodId: "period", date: "2026-01-10", startTime: "12:00", endTime: "14:00" }] });
    const validResult = generateAggregateTimetable(valid, { maxGenerationAttempts: 1 });
    expect(validateAggregateTimetable(validResult, valid)).toEqual([]);

    const invalid = dataset([event("A", { durationMinutes: 120 }) as unknown as SchedulingExamEvent], {}, { calendarDays: [bouestiDay()], venueUnavailability: [{ resourceId: "venue-1", date: "2026-01-10", startTime: "08:30", endTime: "11:30" }], timeSlots: [{ id: "morning", examPeriodId: "period", date: "2026-01-10", startTime: "08:30", endTime: "11:30" }, { id: "tight", examPeriodId: "period", date: "2026-01-10", startTime: "11:45", endTime: "13:45" }] });
    const invalidResult = generateAggregateTimetable(invalid, { maxGenerationAttempts: 1 });
    expect(invalidResult.hardViolations.some((item) => item.code === "FIXED_SESSION_TURNAROUND") || invalidResult.unscheduledEvents[0]?.diagnostics.attemptedSlots.some((slot) => slot.hardViolations.some((item) => item.code === "FIXED_SESSION_TURNAROUND"))).toBe(true);
  });
});
