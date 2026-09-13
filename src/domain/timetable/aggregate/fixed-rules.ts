import { parseClock } from "./allocation";
import type { AggregateConstraintViolation, AggregateSchedulingDataset, AggregateTimeSlot } from "./types";

function violation(code: string, message: string, metadata: Record<string, unknown>): AggregateConstraintViolation {
  return { code, message, metadata };
}

/** Check that a persisted fixed slot is inside the configured calendar day. */
export function fixedSlotCalendarViolation(slot: AggregateTimeSlot, dataset: AggregateSchedulingDataset) {
  if (!dataset.calendarDays) return null;
  const day = dataset.calendarDays.find((candidate) => candidate.date === slot.date);
  if (!day) return violation("INVALID_CALENDAR_WINDOW", "The fixed session has no configured examination day.", { timeSlotId: slot.id, date: slot.date });
  if (!day.enabled) return violation("INVALID_CALENDAR_WINDOW", "The fixed session falls on a disabled examination day.", { timeSlotId: slot.id, date: slot.date });
  if (day.blackoutType) return violation("INVALID_CALENDAR_WINDOW", "The fixed session falls on a blackout day.", { timeSlotId: slot.id, date: slot.date, blackoutType: day.blackoutType });
  const slotStart = parseClock(slot.startTime);
  const slotEnd = parseClock(slot.endTime);
  const dayStart = parseClock(day.startTime);
  const dayEnd = parseClock(day.endTime);
  if (slotStart < dayStart || slotEnd > dayEnd) return violation("INVALID_CALENDAR_WINDOW", "The fixed session falls outside the configured examination-day hours.", { timeSlotId: slot.id, date: slot.date, slotStart: slot.startTime, slotEnd: slot.endTime, dayStart: day.startTime, dayEnd: day.endTime });
  return null;
}

/** Check the gap before a persisted slot against the effective written turnaround. */
export function fixedSlotTurnaroundViolation(slot: AggregateTimeSlot, dataset: AggregateSchedulingDataset) {
  if (!dataset.calendarDays) return null;
  const day = dataset.calendarDays.find((candidate) => candidate.date === slot.date);
  if (!day) return null;
  const turnaround = day.turnaroundMinutesOverride ?? dataset.timePolicy?.writtenTurnaroundMinutes ?? 30;
  const start = parseClock(slot.startTime);
  const previous = dataset.timeSlots
    .filter((candidate) => candidate.id !== slot.id && candidate.date === slot.date && parseClock(candidate.endTime) <= start)
    .sort((left, right) => parseClock(right.endTime) - parseClock(left.endTime) || left.id.localeCompare(right.id))[0];
  if (!previous) return null;
  const gap = start - parseClock(previous.endTime);
  if (gap < turnaround) return violation("FIXED_SESSION_TURNAROUND", `The fixed session starts ${gap} minutes after the previous session; at least ${turnaround} minutes is required.`, { timeSlotId: slot.id, previousTimeSlotId: previous.id, date: slot.date, gapMinutes: gap, requiredMinutes: turnaround });
  return null;
}

