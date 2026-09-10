import type { ExamConflictGraph } from "./../exams";
import type { SchedulingExamEvent, AggregateVenue } from "./aggregate/types";
import { intervalDuration, makeInterval, timeToMinutes, type TimeInterval } from "./intervals";

export type PlannerMode = "WHOLE_MONTH" | "CUSTOM_RANGE" | "SELECTED_DATES";
export type PlannerBlackoutType = "PUBLIC_HOLIDAY" | "UNIVERSITY_EVENT" | "NO_EXAMS" | "OTHER";
export type PlannerDay = { date: string; enabled: boolean; dayType: string; startTime: string; endTime: string; turnaroundMinutesOverride?: number | null; blackoutType?: PlannerBlackoutType | null; reason?: string | null };
export type PlannerPolicy = {
  defaultDayStartTime: string;
  defaultDayEndTime: string;
  defaultTurnaroundMinutes: number;
  writtenTurnaroundMinutes: number;
  cbtTurnaroundMinutes: number;
  timeGranularityMinutes: number;
  weekdays: boolean[];
  cbtBatchingEnabled?: boolean;
  cbtMinimumBatchGapMinutes?: number;
  cbtMaxBatchesPerDay?: number | null;
  cbtRequireSameDay?: boolean;
  cbtAllowMultiDay?: boolean;
  cbtPreferMaximumCapacityPerBatch?: boolean;
  cbtMinimumInvigilatorsPerVenue?: number;
  cbtMinimumTechnicalSupportPerVenue?: number;
  cbtAdditionalSupportPerCandidates?: number | null;
};
export type PlannerCapacitySummary = { calendarDays: number; eligibleExamDays: number; totalDailyOperatingMinutes: number; writtenVenues: number; writtenEffectiveCapacity: number; cbtVenues: number; cbtEffectiveCapacity: number; eventCount: number; penOnPaperEvents: number; cbtEvents: number; totalEventHours: number; candidateWorkload: number; availableVenueHours: number; utilization: number; conflictDensity: number };
export type PlannerFeasibility = { status: "LIKELY_FEASIBLE" | "TIGHT" | "BLOCKED"; blockers: { code: string; message: string; eventId?: string }[]; suggestions: { code: string; message: string }[]; summary: PlannerCapacitySummary };

function parseDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date; }
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function dateRange(startDate: string, endDate: string) { const start = parseDate(startDate); const end = parseDate(endDate); if (!start || !end || start > end) return []; const dates: string[] = []; for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(isoDate(cursor)); return dates; }
export function monthRange(year: number, month: number) { const start = new Date(Date.UTC(year, month - 1, 1)); const end = new Date(Date.UTC(year, month, 0)); return { startDate: isoDate(start), endDate: isoDate(end) }; }

export function generateCalendarProposal(input: { mode: PlannerMode; startDate: string; endDate: string; selectedDates?: string[]; policy: PlannerPolicy }): PlannerDay[] {
  const dates = input.mode === "SELECTED_DATES" ? [...new Set(input.selectedDates ?? [])].sort() : dateRange(input.startDate, input.endDate);
  return dates.map((date) => { const weekday = parseDate(date)?.getUTCDay() ?? 0; const weekend = weekday === 0 || weekday === 6; const enabled = input.policy.weekdays[weekday] ?? !weekend; return { date, enabled, dayType: weekend ? "WEEKEND" : "WEEKDAY", startTime: input.policy.defaultDayStartTime, endTime: input.policy.defaultDayEndTime, turnaroundMinutesOverride: null, blackoutType: null, reason: null }; });
}

export function validatePlannerDay(day: Pick<PlannerDay, "date" | "startTime" | "endTime">, granularity = 30) {
  const start = timeToMinutes(day.startTime); const end = timeToMinutes(day.endTime);
  if (!parseDate(day.date) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "INVALID_CALENDAR_CONFIGURATION";
  if (!Number.isInteger(granularity) || granularity <= 0 || start % granularity !== 0 || end % granularity !== 0) return "INVALID_CALENDAR_CONFIGURATION";
  return null;
}

export function dayInterval(day: PlannerDay): TimeInterval | null { const start = timeToMinutes(day.startTime); const end = timeToMinutes(day.endTime); return makeInterval(day.date, start, end); }

function effectiveCapacity(venue: AggregateVenue, mode: "PEN_ON_PAPER" | "CBT") { return mode === "CBT" ? (venue.usableComputerCapacity ?? 0) : (venue.examCapacity ?? venue.capacity); }

export function summarizePlannerCapacity(days: PlannerDay[], events: SchedulingExamEvent[], venues: AggregateVenue[], graph?: ExamConflictGraph): PlannerCapacitySummary {
  const eligible = days.filter((day) => day.enabled && !day.blackoutType && !validatePlannerDay(day, 1));
  const minutes = eligible.reduce((sum, day) => sum + (dayInterval(day) ? intervalDuration(dayInterval(day)!) : 0), 0);
  const written = venues.filter((venue) => venue.active && (venue.capability === "WRITTEN" || venue.capability === "BOTH")); const cbt = venues.filter((venue) => venue.active && (venue.capability === "CBT" || venue.capability === "BOTH") && (venue.usableComputerCapacity ?? 0) > 0);
  const totalEventHours = events.reduce((sum, event) => sum + event.durationMinutes, 0) / 60;
  return { calendarDays: days.length, eligibleExamDays: eligible.length, totalDailyOperatingMinutes: minutes, writtenVenues: written.length, writtenEffectiveCapacity: written.reduce((sum, venue) => sum + effectiveCapacity(venue, "PEN_ON_PAPER"), 0), cbtVenues: cbt.length, cbtEffectiveCapacity: cbt.reduce((sum, venue) => sum + effectiveCapacity(venue, "CBT"), 0), eventCount: events.length, penOnPaperEvents: events.filter((event) => event.examMode === "PEN_ON_PAPER").length, cbtEvents: events.filter((event) => event.examMode === "CBT").length, totalEventHours, candidateWorkload: events.reduce((sum, event) => sum + event.candidateCount, 0), availableVenueHours: (minutes / 60) * written.length, utilization: minutes && written.length ? totalEventHours / ((minutes / 60) * written.length) : Number.POSITIVE_INFINITY, conflictDensity: graph?.metrics.density ?? 0 };
}

export function assessPlannerFeasibility(days: PlannerDay[], events: SchedulingExamEvent[], venues: AggregateVenue[], graph?: ExamConflictGraph, batchingEnabled = false): PlannerFeasibility {
  const summary = summarizePlannerCapacity(days, events, venues, graph); const blockers: PlannerFeasibility["blockers"] = [];
  if (!summary.eligibleExamDays) blockers.push({ code: "NO_ELIGIBLE_DAYS", message: "No enabled, non-blackout examination days are available." });
  for (const event of events) {
    if (!days.some((day) => day.enabled && !day.blackoutType && (timeToMinutes(day.endTime) - timeToMinutes(day.startTime)) >= event.durationMinutes)) blockers.push({ code: "EVENT_EXCEEDS_ALL_DAY_WINDOWS", message: "The event duration exceeds every eligible daily window.", eventId: event.id });
    const compatible = venues.filter((venue) => venue.active && effectiveCapacity(venue, event.examMode) > 0 && (event.examMode === "CBT" ? venue.capability === "CBT" || venue.capability === "BOTH" : venue.capability === "WRITTEN" || venue.capability === "BOTH"));
    if (!compatible.length) blockers.push({ code: "NO_COMPATIBLE_VENUE", message: "No active venue supports this examination mode.", eventId: event.id });
    if (event.examMode === "CBT" && !batchingEnabled && compatible.reduce((sum, venue) => sum + effectiveCapacity(venue, "CBT"), 0) < event.candidateCount) blockers.push({ code: "INSUFFICIENT_CBT_CAPACITY", message: "CBT capacity is below this event's candidate workload; batching is not enabled.", eventId: event.id });
    if (event.examMode === "PEN_ON_PAPER" && compatible.reduce((sum, venue) => sum + effectiveCapacity(venue, "PEN_ON_PAPER"), 0) < event.candidateCount) blockers.push({ code: "INSUFFICIENT_WRITTEN_CAPACITY", message: "Written venue capacity is below this event's candidate workload.", eventId: event.id });
  }
  const suggestions: PlannerFeasibility["suggestions"] = []; if (blockers.some((item) => item.code === "NO_ELIGIBLE_DAYS")) suggestions.push({ code: "ENABLE_SATURDAYS", message: "Enable Saturday examinations if policy permits." }); if (summary.utilization >= 0.8) suggestions.push({ code: "EXTEND_PERIOD", message: "Extend the examination period or increase daily closing time." }); if (blockers.some((item) => item.code.includes("CAPACITY"))) suggestions.push({ code: "ADD_CAPACITY", message: "Add another compatible hall or increase CBT capacity." }); if (summary.utilization >= 0.8) suggestions.push({ code: "REDUCE_TURNAROUND", message: "Reduce turnaround only if examination policy permits." });
  const tight = !blockers.length && (summary.utilization >= 0.8 || summary.conflictDensity >= 0.5 || summary.totalDailyOperatingMinutes - events.reduce((sum, event) => sum + event.durationMinutes, 0) < 60);
  return { status: blockers.length ? "BLOCKED" : tight ? "TIGHT" : "LIKELY_FEASIBLE", blockers, suggestions, summary };
}
