import type { InvigilatorAllocationResult, SchedulingInvigilator, SchedulingTimeSlot, SchedulingUnavailablePeriod } from "../types";

function overlaps(slot: SchedulingTimeSlot, period: SchedulingUnavailablePeriod) { return slot.date === period.date && slot.startTime < period.endTime && period.startTime < slot.endTime; }

export function allocateInvigilators(slot: SchedulingTimeSlot, venueIds: string[], invigilators: SchedulingInvigilator[], unavailable: SchedulingUnavailablePeriod[], occupied: Set<string>, dailyAssignments: Map<string, number>, minimumPerVenue: number): InvigilatorAllocationResult {
  const required = venueIds.length * minimumPerVenue;
  const available = invigilators.filter((invigilator) => invigilator.active && !occupied.has(invigilator.id) && !unavailable.some((period) => period.resourceId === invigilator.id && overlaps(slot, period))).sort((a, b) => { const aDaily = dailyAssignments.get(`${a.id}|${slot.date}`) ?? 0; const bDaily = dailyAssignments.get(`${b.id}|${slot.date}`) ?? 0; return Number(aDaily >= a.maximumDailyAssignments) - Number(bDaily >= b.maximumDailyAssignments) || aDaily - bDaily || a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
  if (available.length < required) return { success: false, invigilators: [], attempted: available.length, failureReason: "INSUFFICIENT_INVIGILATORS" };
  return { success: true, invigilators: available.slice(0, required).map((invigilator, index) => ({ invigilatorId: invigilator.id, venueId: venueIds[index % venueIds.length] })), attempted: available.length };
}
