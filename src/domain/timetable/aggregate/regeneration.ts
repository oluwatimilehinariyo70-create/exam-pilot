import { generateAggregateTimetable } from "./engine";
import { generateFlexibleAggregateTimetable } from "./flexible-engine";
import { scheduleCbtEvent } from "./cbt-batching";
import { validateCompleteAggregateTimetable } from "./complete-validation";
import { minutesToTime, timeToMinutes } from "../intervals";
import type { AggregateCandidateTimetable, AggregateSchedulingDataset, AggregateUnavailablePeriod } from "./types";

export type RegenerationScope = "SELECTED" | "UNRESOLVED" | "LATE_COURSES";

export function unresolvedEventIds(candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset) {
  const ids = new Set(candidate.unscheduledEvents.map((e) => e.eventId));
  for (const event of dataset.events) if (!candidate.assignments.some((a) => a.eventId === event.id) && !candidate.sittings?.some((s) => s.eventId === event.id)) ids.add(event.id);
  for (const v of validateCompleteAggregateTimetable(candidate, dataset).violations) for (const key of ["eventId", "eventAId", "eventBId"]) if (typeof v.metadata[key] === "string") ids.add(v.metadata[key] as string);
  return [...ids];
}

/** Treat every unaffected assignment as a reservation; never silently move a pin. */
export function regenerateAggregateEvents(dataset: AggregateSchedulingDataset, previous: AggregateCandidateTimetable, pinnedEventIds: string[], scope: RegenerationScope, selectedIds: string[] = []) {
  const targets = new Set(scope === "SELECTED" ? selectedIds : scope === "LATE_COURSES" ? dataset.events.filter((e) => !previous.assignments.some((a) => a.eventId === e.id) && !previous.sittings?.some((s) => s.eventId === e.id)).map((e) => e.id) : unresolvedEventIds(previous, dataset));
  pinnedEventIds.forEach((id) => targets.delete(id));
  const candidate = structuredClone(previous);
  candidate.assignments = candidate.assignments.filter((a) => !targets.has(a.eventId));
  candidate.sittings = (candidate.sittings ?? []).filter((s) => !targets.has(s.eventId));
  candidate.unscheduledEvents = candidate.unscheduledEvents.filter((e) => !targets.has(e.eventId));
  const initialValidation = validateCompleteAggregateTimetable(candidate, dataset, false);
  if (!initialValidation.valid) return { candidate: previous, changedEventIds: [], diagnostics: initialValidation.violations.map((v) => ({ ...v, code: "PRESERVED_ASSIGNMENT_INVALID", message: "A pinned or unaffected assignment prevents regeneration: " + v.message })) };
  for (const event of dataset.events.filter((e) => targets.has(e.id)).sort((a, b) => b.candidateCount - a.candidateCount || a.id.localeCompare(b.id))) {
    let placed = false;
    if (event.examMode === "CBT") {
      const result = scheduleCbtEvent(event, dataset, candidate, dataset.config);
      if (!result.violation) { candidate.sittings.push(...result.sittings); placed = true; }
    } else {
      const reservedVenues: AggregateUnavailablePeriod[] = [], reservedStaff: AggregateUnavailablePeriod[] = [];
      const rows = [...candidate.assignments.map((a) => ({ ...a, staffIds: a.invigilators.map((i) => i.invigilatorId) })), ...candidate.sittings.map((s) => ({ ...s, staffIds: s.staff.map((i) => i.staffId) }))];
      const daily = new Map<string, number>(), total = new Map<string, number>();
      for (const row of rows) {
        const dayOverride = dataset.calendarDays?.find((d) => d.date === row.date)?.turnaroundMinutesOverride;
        const otherMode = dataset.events.find((e) => e.id === row.eventId)?.examMode;
        const before = dayOverride ?? dataset.timePolicy?.writtenTurnaroundMinutes ?? 30;
        const after = dayOverride ?? (otherMode === "CBT" ? dataset.timePolicy?.cbtTurnaroundMinutes ?? 15 : dataset.timePolicy?.writtenTurnaroundMinutes ?? 30);
        const hardConflict = dataset.conflictGraph.edges.some((e) => e.hard && ((e.eventAId === event.id && e.eventBId === row.eventId) || (e.eventBId === event.id && e.eventAId === row.eventId)));
        for (const venue of row.venues) reservedVenues.push({ resourceId: venue.venueId, date: row.date, startTime: minutesToTime(Math.max(0, timeToMinutes(row.startTime) - (dataset.schedulingMode === "FLEXIBLE_INTERVALS" ? 0 : before)))!, endTime: minutesToTime(Math.min(1439, timeToMinutes(row.endTime) + after))! });
        if (hardConflict) for (const venue of dataset.venues) reservedVenues.push({ resourceId: venue.id, date: row.date, startTime: row.startTime, endTime: row.endTime });
        for (const id of row.staffIds) { reservedStaff.push({ resourceId: id, date: row.date, startTime: row.startTime, endTime: row.endTime }); daily.set(id + "|" + row.date, (daily.get(id + "|" + row.date) ?? 0) + 1); total.set(id, (total.get(id) ?? 0) + 1); }
      }
      for (const person of dataset.invigilators) for (const date of new Set([...dataset.timeSlots.map((s) => s.date), ...(dataset.calendarDays ?? []).map((d) => d.date)])) if ((daily.get(person.id + "|" + date) ?? 0) >= person.maximumDailyAssignments || (person.maximumTotalAssignments != null && (total.get(person.id) ?? 0) >= person.maximumTotalAssignments)) reservedStaff.push({ resourceId: person.id, date, startTime: "00:00", endTime: "23:59" });
      const input = { ...dataset, events: [event], venueUnavailability: [...dataset.venueUnavailability, ...reservedVenues], invigilatorUnavailability: [...dataset.invigilatorUnavailability, ...reservedStaff] };
      const result = dataset.schedulingMode === "FLEXIBLE_INTERVALS" ? generateFlexibleAggregateTimetable(input, dataset.config) : generateAggregateTimetable(input, dataset.config);
      if (result.assignments.length) { candidate.assignments.push(...result.assignments); placed = true; }
    }
    if (!placed) candidate.unscheduledEvents.push({ eventId: event.id, title: event.title, reason: "NO_FEASIBLE_SLOT", diagnostics: { eventId: event.id, title: event.title, candidateCount: event.candidateCount, examMode: event.examMode, durationMinutes: event.durationMinutes, conflictingEvents: [], attemptedSlots: [] } });
  }
  const validation = validateCompleteAggregateTimetable(candidate, dataset);
  candidate.hardViolations = validation.violations;
  const scheduled = new Set([...candidate.assignments.map((a) => a.eventId), ...candidate.sittings.map((s) => s.eventId)]);
  candidate.metrics = { ...candidate.metrics, totalEvents: dataset.events.length, scheduledEvents: scheduled.size, unscheduledEvents: dataset.events.length - scheduled.size, hardViolationCount: validation.violations.length, cbtSittings: candidate.sittings.length };
  return { candidate, changedEventIds: [...targets], diagnostics: validation.violations.map((v) => v.code === "UNSCHEDULED_EVENT" ? { ...v, code: pinnedEventIds.length ? "PINNED_ASSIGNMENTS_BLOCK_PLACEMENT" : "NO_FEASIBLE_SLOT", message: "No feasible placement is available while preserving pinned and unaffected examinations.", metadata: { ...v.metadata, pinnedEventIds } } : v) };
}
