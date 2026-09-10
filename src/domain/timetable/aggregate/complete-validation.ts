import { intervalsOverlap, makeInterval, timeToMinutes } from "../intervals";
import { validateAggregateTimetable } from "./validation";
import { validateCbtSittings } from "./cbt-validation";
import type { AggregateCandidateTimetable, AggregateSchedulingDataset } from "./types";

/** Validate the whole schedule, including boundaries between written exams and CBT. */
export function validateCompleteAggregateTimetable(candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset, requireComplete = true) {
  const sittings = candidate.sittings ?? [];
  const scheduled = new Set([...candidate.assignments.map((a) => a.eventId), ...sittings.map((s) => s.eventId)]);
  const cbtDataset = requireComplete ? dataset : { ...dataset, events: dataset.events.filter((e) => scheduled.has(e.id)) };
  const violations = [...validateAggregateTimetable(candidate, dataset), ...validateCbtSittings(sittings, cbtDataset)];
  const rows = [
    ...candidate.assignments.map((a) => {
      const slot = dataset.timeSlots.find((s) => s.id === a.timeSlotId);
      return { ...a, date: slot?.date ?? a.date, startTime: slot?.startTime ?? a.startTime, endTime: slot?.endTime ?? a.endTime, staffIds: a.invigilators.map((i) => i.invigilatorId) };
    }),
    ...sittings.map((s) => ({ ...s, staffIds: s.staff.map((i) => i.staffId) })),
  ];
  for (const event of dataset.events) {
    if (requireComplete && !scheduled.has(event.id)) violations.push({ code: "UNSCHEDULED_EVENT", message: "An examination has no assignment.", metadata: { eventId: event.id } });
    if (event.examMode === "CBT" && candidate.assignments.some((a) => a.eventId === event.id)) violations.push({ code: "INVALID_CBT_SITTING", message: "CBT examinations must be represented by sittings.", metadata: { eventId: event.id } });
  }
  for (const row of rows) {
    const day = dataset.calendarDays?.find((d) => d.date === row.date);
    if (row.date < dataset.examPeriod.startDate || row.date > dataset.examPeriod.endDate || (dataset.schedulingMode === "FLEXIBLE_INTERVALS" && (!day || !day.enabled || day.blackoutType || row.startTime < day.startTime || row.endTime > day.endTime))) violations.push({ code: "INVALID_CALENDAR_WINDOW", message: "An examination falls outside an eligible examination window.", metadata: { eventId: row.eventId } });
    if (dataset.schedulingMode !== "FLEXIBLE_INTERVALS" && !dataset.timeSlots.some((s) => s.examPeriodId === dataset.examPeriod.id && s.date === row.date && s.startTime === row.startTime && s.endTime >= row.endTime)) violations.push({ code: "INVALID_TIME_SLOT", message: "An examination falls outside the fixed sessions.", metadata: { eventId: row.eventId } });
    const event = dataset.events.find((e) => e.id === row.eventId);
    if (event?.examMode !== "CBT") {
      for (const venue of row.venues) if (candidate.assignments.find((a) => a.eventId === row.eventId)?.invigilators.filter((i) => i.venueId === venue.venueId).length! < dataset.config.minimumInvigilatorsPerVenue) violations.push({ code: "INSUFFICIENT_INVIGILATORS", message: "Every venue needs invigilator coverage.", metadata: { eventId: row.eventId, venueId: venue.venueId } });
    }
  }
  const turnaround = (row: typeof rows[number]) => dataset.calendarDays?.find((d) => d.date === row.date)?.turnaroundMinutesOverride ?? (dataset.events.find((e) => e.id === row.eventId)?.examMode === "CBT" ? dataset.timePolicy?.cbtTurnaroundMinutes ?? 15 : dataset.timePolicy?.writtenTurnaroundMinutes ?? 30);
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j];
    const ai = makeInterval(a.date, timeToMinutes(a.startTime), timeToMinutes(a.endTime));
    const bi = makeInterval(b.date, timeToMinutes(b.startTime), timeToMinutes(b.endTime));
    if (!ai || !bi) continue;
    const metadata = { eventAId: a.eventId, eventBId: b.eventId };
    if (a.venues.some((v) => b.venues.some((w) => v.venueId === w.venueId)) && intervalsOverlap({ ...ai, endMinutes: ai.endMinutes + turnaround(a) }, { ...bi, endMinutes: bi.endMinutes + turnaround(b) })) violations.push({ code: "VENUE_TURNAROUND", message: "Venue examinations must allow the configured turnaround.", metadata });
    if (!intervalsOverlap(ai, bi)) continue;
    if (a.staffIds.some((id) => b.staffIds.includes(id))) violations.push({ code: "INVIGILATOR_COLLISION", message: "Staff cannot cover overlapping examinations.", metadata });
    if (dataset.conflictGraph.edges.some((e) => e.hard && ((e.eventAId === a.eventId && e.eventBId === b.eventId) || (e.eventBId === a.eventId && e.eventAId === b.eventId)))) violations.push({ code: "EVENT_CONFLICT", message: "Hard-conflicting examinations overlap.", metadata });
  }
  return { valid: violations.length === 0, violations };
}
