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

type VenueUsage = Map<string, number> | Set<string>;

function usageFor(occupied: VenueUsage, venueId: string, capacity: number) {
  return occupied instanceof Map ? Math.max(0, occupied.get(venueId) ?? 0) : occupied.has(venueId) ? capacity : 0;
}

/** Select the smallest deterministic set of halls and pack only the seats this event needs. */
export function packAggregateVenueCapacity(candidateCount: number, options: { venueId: string; code: string; capacity: number; used: number }[], splitPenalty = 0): AggregateVenueAssignment[] | null {
  const usable = options.filter((item) => item.capacity - item.used > 0);
  if (!candidateCount) return [];
  if (usable.reduce((sum, item) => sum + item.capacity - item.used, 0) < candidateCount) return null;
  const sets: typeof usable[] = [];
  const visit = (start: number, selected: typeof usable) => {
    if (selected.length) {
      const total = selected.reduce((sum, item) => sum + item.capacity - item.used, 0);
      if (total >= candidateCount) sets.push(selected);
    }
    for (let index = start; index < usable.length; index += 1) visit(index + 1, [...selected, usable[index]]);
  };
  visit(0, []);
  const best = sets.sort((left, right) => {
    const leftCapacity = left.reduce((sum, item) => sum + item.capacity - item.used, 0);
    const rightCapacity = right.reduce((sum, item) => sum + item.capacity - item.used, 0);
    const leftOpen = left.filter((item) => item.used > 0).length;
    const rightOpen = right.filter((item) => item.used > 0).length;
    return left.length - right.length || rightOpen - leftOpen || (leftCapacity - candidateCount + Math.max(0, left.length - 1) * splitPenalty) - (rightCapacity - candidateCount + Math.max(0, right.length - 1) * splitPenalty) || left.map((item) => item.venueId).sort().join().localeCompare(right.map((item) => item.venueId).sort().join());
  })[0];
  if (!best) return null;
  let remaining = candidateCount;
  return best.slice().sort((left, right) => Number(right.used > 0) - Number(left.used > 0) || (right.capacity - right.used) - (left.capacity - left.used) || left.code.localeCompare(right.code) || left.venueId.localeCompare(right.venueId)).map((item) => {
    const assigned = Math.min(remaining, item.capacity - item.used); remaining -= assigned;
    return { venueId: item.venueId, allocatedCapacity: item.capacity, allocatedCandidates: assigned };
  });
}

export function allocateAggregateVenues(candidateCount: number, mode: AggregateExamMode, slot: AggregateTimeSlot, venues: AggregateVenue[], unavailable: AggregateUnavailablePeriod[], occupied: VenueUsage, splitPenalty: number): AggregateVenueAllocation {
  const compatible = venues.filter((venue) => venue.active && venueSupports(venue, mode) && venueEffectiveCapacity(venue, mode) > 0);
  if (!compatible.length) return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: "VENUE_CAPABILITY_MISMATCH", failureReason: mode === "CBT" ? "No active CBT-capable venue has usable computer capacity." : "No active written-capable venue is available." };
  const available = compatible.filter((venue) => !resourceUnavailable(slot, venue.id, unavailable));
  const options = available.map((venue) => ({ venue, capacity: venueEffectiveCapacity(venue, mode), used: usageFor(occupied, venue.id, venueEffectiveCapacity(venue, mode)) })).filter((item) => item.capacity - item.used > 0);
  if (!available.length) {
    const allOccupied = compatible.every((venue) => usageFor(occupied, venue.id, venueEffectiveCapacity(venue, mode)) >= venueEffectiveCapacity(venue, mode));
    return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: allOccupied ? "VENUE_COLLISION" : "VENUE_UNAVAILABLE", failureReason: allOccupied ? "All compatible venues are occupied in this slot." : "Compatible venues are unavailable in this slot." };
  }
  const selected = packAggregateVenueCapacity(candidateCount, options.map(({ venue, capacity, used }) => ({ venueId: venue.id, code: venue.code, capacity, used })), splitPenalty);
  if (!selected) return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureCode: mode === "CBT" ? "INSUFFICIENT_CBT_CAPACITY" : "INSUFFICIENT_VENUE_CAPACITY", failureReason: "The simultaneously available compatible capacity is insufficient." };
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
