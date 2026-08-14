import type { SchedulingCourse, SchedulingTimeSlot, SchedulingUnavailablePeriod, SchedulingVenue, VenueAllocationResult, VenueAssignment } from "../types";

function overlaps(slot: SchedulingTimeSlot, period: SchedulingUnavailablePeriod) { return slot.date === period.date && slot.startTime < period.endTime && period.startTime < slot.endTime; }

export function allocateVenues(candidateCount: number, slot: SchedulingTimeSlot, venues: SchedulingVenue[], unavailable: SchedulingUnavailablePeriod[], occupied: Set<string>, splitPenalty: number): VenueAllocationResult {
  const available = venues.filter((venue) => venue.active && !occupied.has(venue.id) && !unavailable.some((period) => period.resourceId === venue.id && overlaps(slot, period))).sort((a, b) => a.capacity - b.capacity || a.code.localeCompare(b.code));
  if (available.reduce((sum, venue) => sum + venue.capacity, 0) < candidateCount) return { success: false, venueAssignments: [], totalCapacity: 0, candidateCount, unusedCapacity: 0, failureReason: "NO_VENUE_CAPACITY" };
  const candidates: VenueAssignment[][] = [];
  const single = available.find((venue) => venue.capacity >= candidateCount); if (single) candidates.push([{ venueId: single.id, allocatedCapacity: single.capacity }]);
  const greedy: VenueAssignment[] = []; let capacity = 0;
  for (const venue of [...available].sort((a, b) => b.capacity - a.capacity || a.code.localeCompare(b.code))) { if (capacity >= candidateCount) break; greedy.push({ venueId: venue.id, allocatedCapacity: venue.capacity }); capacity += venue.capacity; }
  candidates.push(greedy);
  for (let i = 0; i < available.length; i += 1) for (let j = i + 1; j < available.length; j += 1) if (available[i].capacity + available[j].capacity >= candidateCount) candidates.push([{ venueId: available[i].id, allocatedCapacity: available[i].capacity }, { venueId: available[j].id, allocatedCapacity: available[j].capacity }]);
  const selected = candidates.filter((set) => set.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) >= candidateCount).sort((a, b) => (a.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) - candidateCount + (a.length - 1) * splitPenalty) - (b.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) - candidateCount + (b.length - 1) * splitPenalty) || a.map((venue) => venue.venueId).join().localeCompare(b.map((venue) => venue.venueId).join()))[0];
  const totalCapacity = selected.reduce((sum, venue) => sum + venue.allocatedCapacity, 0);
  return { success: true, venueAssignments: selected, totalCapacity, candidateCount, unusedCapacity: totalCapacity - candidateCount };
}
