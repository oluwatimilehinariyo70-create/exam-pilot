import type { AggregateExamMode, AggregateGenerationConfig, AggregateInvigilator, AggregateInvigilatorAssignment, AggregateInvigilatorAllocation, AggregateTimeSlot, AggregateUnavailablePeriod, AggregateVenue, AggregateVenueAllocation, AggregateVenueAssignment } from "./types";

export function parseClock(value: string) { const [hours, minutes] = value.split(":").map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN; }
export function slotDurationMinutes(slot: AggregateTimeSlot) { const start = parseClock(slot.startTime); const end = parseClock(slot.endTime); return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0; }
export function slotsOverlap(first: AggregateTimeSlot, second: AggregateTimeSlot) { return first.date === second.date && first.startTime < second.endTime && second.startTime < first.endTime; }
export function resourceUnavailable(slot: AggregateTimeSlot, resourceId: string, unavailable: AggregateUnavailablePeriod[]) { return unavailable.some((period) => period.resourceId === resourceId && period.date === slot.date && period.startTime < slot.endTime && slot.startTime < period.endTime); }

export function venueEffectiveCapacity(venue: AggregateVenue, mode: AggregateExamMode) {
  return mode === "CBT" ? (venue.usableComputerCapacity ?? 0) : (venue.examCapacity ?? venue.capacity);
}

export function venueSupports(venue: AggregateVenue, mode: AggregateExamMode) {
  return mode === "CBT" ? venue.capability === "CBT" || venue.capability === "BOTH" : venue.capability === "WRITTEN" || venue.capability === "BOTH";
}

export function allocateAggregateVenues(candidateCount: number, mode: AggregateExamMode, slot: AggregateTimeSlot, venues: AggregateVenue[], unavailable: AggregateUnavailablePeriod[], occupied: Set<string>, splitPenalty: number): AggregateVenueAllocation {
  const compatible = venues.filter((venue) => venue.active && venueSupports(venue, mode) && venueEffectiveCapacity(venue, mode) > 0);
  if (!compatible.length) return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: "VENUE_CAPABILITY_MISMATCH", failureReason: mode === "CBT" ? "No active CBT-capable venue has usable computer capacity." : "No active written-capable venue is available." };
  const available = compatible.filter((venue) => !occupied.has(venue.id) && !resourceUnavailable(slot, venue.id, unavailable));
  if (!available.length) {
    const allOccupied = compatible.every((venue) => occupied.has(venue.id));
    return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: allOccupied ? "VENUE_COLLISION" : "VENUE_UNAVAILABLE", failureReason: allOccupied ? "All compatible venues are occupied in this slot." : "Compatible venues are unavailable in this slot." };
  }
  if (available.reduce((sum, venue) => sum + venueEffectiveCapacity(venue, mode), 0) < candidateCount) return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: mode === "CBT" ? "INSUFFICIENT_CBT_CAPACITY" : "INSUFFICIENT_VENUE_CAPACITY", failureReason: "The simultaneously available compatible capacity is insufficient." };
  const capacity = (venue: AggregateVenue) => venueEffectiveCapacity(venue, mode);
  const candidates: AggregateVenueAssignment[][] = [];
  const single = available.find((venue) => capacity(venue) >= candidateCount); if (single) candidates.push([{ venueId: single.id, allocatedCapacity: capacity(single) }]);
  const greedy: AggregateVenueAssignment[] = []; let greedyCapacity = 0;
  for (const venue of [...available].sort((a, b) => capacity(b) - capacity(a) || a.code.localeCompare(b.code))) { if (greedyCapacity >= candidateCount) break; greedy.push({ venueId: venue.id, allocatedCapacity: capacity(venue) }); greedyCapacity += capacity(venue); }
  candidates.push(greedy);
  for (let left = 0; left < available.length; left += 1) for (let right = left + 1; right < available.length; right += 1) if (capacity(available[left]) + capacity(available[right]) >= candidateCount) candidates.push([{ venueId: available[left].id, allocatedCapacity: capacity(available[left]) }, { venueId: available[right].id, allocatedCapacity: capacity(available[right]) }]);
  const selected = candidates.filter((set) => set.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) >= candidateCount).sort((a, b) => (a.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) - candidateCount + (a.length - 1) * splitPenalty) - (b.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) - candidateCount + (b.length - 1) * splitPenalty) || a.map((venue) => venue.venueId).join().localeCompare(b.map((venue) => venue.venueId).join()))[0];
  const totalCapacity = selected.reduce((sum, venue) => sum + venue.allocatedCapacity, 0);
  return { success: true, venueAssignments: selected, totalCapacity, candidateCount, unusedCapacity: totalCapacity - candidateCount };
}

export function allocateAggregateInvigilators(slot: AggregateTimeSlot, venueIds: string[], invigilators: AggregateInvigilator[], unavailable: AggregateUnavailablePeriod[], occupied: Set<string>, dailyAssignments: Map<string, number>, totalAssignments: Map<string, number>, config: AggregateGenerationConfig): AggregateInvigilatorAllocation {
  const required = venueIds.length * config.minimumInvigilatorsPerVenue;
  const activeCompatible = invigilators.filter((item) => item.active);
  const available = activeCompatible.filter((item) => !occupied.has(item.id) && !resourceUnavailable(slot, item.id, unavailable) && (item.maximumTotalAssignments == null || (totalAssignments.get(item.id) ?? 0) < item.maximumTotalAssignments)).sort((a, b) => { const aDaily = dailyAssignments.get(`${a.id}|${slot.date}`) ?? 0; const bDaily = dailyAssignments.get(`${b.id}|${slot.date}`) ?? 0; return Number(aDaily >= a.maximumDailyAssignments) - Number(bDaily >= b.maximumDailyAssignments) || aDaily - bDaily || a.name.localeCompare(b.name) || a.id.localeCompare(b.id); });
  if (available.length < required) {
    const availableWithoutBusy = activeCompatible.filter((item) => !resourceUnavailable(slot, item.id, unavailable));
    const code = availableWithoutBusy.length < required ? "INSUFFICIENT_INVIGILATORS" : "INVIGILATOR_COLLISION";
    return { success: false, invigilators: [], attempted: available.length, failureCode: code, failureReason: code === "INVIGILATOR_COLLISION" ? "Available invigilators are already assigned in this slot." : "Not enough active invigilators can cover the selected venues." };
  }
  return { success: true, invigilators: available.slice(0, required).map((item, index) => ({ invigilatorId: item.id, venueId: venueIds[index % Math.max(1, venueIds.length)] })), attempted: available.length };
}
