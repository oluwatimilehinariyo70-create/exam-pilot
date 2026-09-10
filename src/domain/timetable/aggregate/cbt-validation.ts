import { intervalsOverlap, makeInterval, timeToMinutes, type TimeInterval } from "../intervals";
import type { AggregateConstraintViolation, AggregateSchedulingDataset, CbtSitting } from "./types";

const defaultBatchGapMinutes = 30;

function unavailable(interval: TimeInterval, resourceId: string, periods: AggregateSchedulingDataset["venueUnavailability"]) {
  return periods.some((period) => period.resourceId === resourceId && (() => {
    const blocked = makeInterval(period.date, timeToMinutes(period.startTime), timeToMinutes(period.endTime));
    return blocked ? intervalsOverlap(interval, blocked) : false;
  })());
}

function violation(code: string, message: string, metadata: Record<string, unknown>): AggregateConstraintViolation {
  return { code, message, metadata };
}

export function validateCbtSittings(sittings: CbtSitting[], dataset: AggregateSchedulingDataset): AggregateConstraintViolation[] {
  const violations: AggregateConstraintViolation[] = [];
  const events = new Map(dataset.events.map((event) => [event.id, event]));
  const venues = new Map(dataset.venues.map((venue) => [venue.id, venue]));
  const staff = new Map(dataset.invigilators.map((item) => [item.id, item]));
  const totals = new Map<string, number>();
  const byEvent = new Map<string, CbtSitting[]>();
  const batching = dataset.cbtBatchingPolicy ?? { enabled: true, minimumBatchGapMinutes: defaultBatchGapMinutes, maxBatchesPerDay: null, requireSameDay: true, allowMultiDay: false, preferMaximumCapacityPerBatch: true };
  const staffing = dataset.cbtStaffingPolicy ?? { minimumInvigilatorsPerVenue: 1, minimumTechnicalSupportPerVenue: 1, additionalSupportPerCandidates: null };

  for (const sitting of sittings) {
    const event = events.get(sitting.eventId);
    const interval = makeInterval(sitting.date, timeToMinutes(sitting.startTime), timeToMinutes(sitting.endTime));
    byEvent.set(sitting.eventId, [...(byEvent.get(sitting.eventId) ?? []), sitting]);
    totals.set(sitting.eventId, (totals.get(sitting.eventId) ?? 0) + sitting.candidateCount);

    if (!event || event.examMode !== "CBT") violations.push(violation("INVALID_CBT_SITTING", "A sitting references a missing or non-CBT event.", { eventId: sitting.eventId }));
    if (!Number.isInteger(sitting.sequenceNumber) || sitting.sequenceNumber < 1) violations.push(violation("INVALID_CBT_SEQUENCE", "CBT sitting sequence numbers must be positive integers.", { eventId: sitting.eventId, sequenceNumber: sitting.sequenceNumber }));
    if (!interval || (event && interval.endMinutes - interval.startMinutes !== event.durationMinutes)) violations.push(violation("INVALID_CBT_SITTING_DURATION", "Every CBT sitting must use the event duration.", { eventId: sitting.eventId }));
    if (!Number.isInteger(sitting.candidateCount) || sitting.candidateCount <= 0) violations.push(violation("INVALID_CBT_SITTING", "A CBT sitting must have a positive candidate count.", { eventId: sitting.eventId, candidateCount: sitting.candidateCount }));

    const venueIds = new Set<string>();
    let allocationTotal = 0;
    const assignedInvigilatorsByVenue = new Map<string, number>();
    const assignedSupportByVenue = new Map<string, number>();
    for (const item of sitting.venues) {
      if (venueIds.has(item.venueId)) violations.push(violation("VENUE_COLLISION", "A CBT sitting assigns a venue more than once.", { eventId: sitting.eventId, venueId: item.venueId }));
      venueIds.add(item.venueId);
      const venue = venues.get(item.venueId);
      const capacity = venue?.usableComputerCapacity ?? 0;
      allocationTotal += item.allocatedCandidates;
      if (!venue || !venue.active || (venue.capability !== "CBT" && venue.capability !== "BOTH")) violations.push(violation("VENUE_CAPABILITY_MISMATCH", "The sitting venue must be active and CBT-capable.", { eventId: sitting.eventId, venueId: item.venueId }));
      if (item.allocatedCandidates <= 0 || item.allocatedCandidates > capacity || item.allocatedCandidates > item.allocatedCapacity || item.allocatedCapacity > capacity) violations.push(violation("INSUFFICIENT_CBT_CAPACITY", "Sitting venue allocation exceeds usable computer capacity.", { eventId: sitting.eventId, venueId: item.venueId, allocatedCandidates: item.allocatedCandidates, allocatedCapacity: item.allocatedCapacity, capacity }));
      if (interval && unavailable(interval, item.venueId, dataset.venueUnavailability)) violations.push(violation("VENUE_UNAVAILABLE", "The CBT venue is unavailable during the sitting.", { eventId: sitting.eventId, venueId: item.venueId }));
    }
    if (allocationTotal !== sitting.candidateCount) violations.push(violation("CBT_CANDIDATE_COUNT_MISMATCH", "Sitting venue candidate allocations must equal the sitting candidate count.", { eventId: sitting.eventId, expected: sitting.candidateCount, actual: allocationTotal }));

    const staffIds = new Set<string>();
    for (const item of sitting.staff) {
      if (staffIds.has(item.staffId)) violations.push(violation("CBT_STAFF_ROLE_COLLISION", "A staff member cannot satisfy both CBT roles for one sitting.", { eventId: sitting.eventId, staffId: item.staffId }));
      staffIds.add(item.staffId);
      const person = staff.get(item.staffId);
      if (!person || !person.active || (item.assignmentType === "TECHNICAL_SUPPORT" && person.role !== "CBT_TECHNICAL_SUPPORT") || (item.assignmentType === "INVIGILATOR" && person.role === "CBT_TECHNICAL_SUPPORT")) violations.push(violation(item.assignmentType === "TECHNICAL_SUPPORT" ? "INSUFFICIENT_CBT_TECHNICAL_SUPPORT" : "INSUFFICIENT_INVIGILATORS", "CBT staff assignments do not match active role eligibility.", { eventId: sitting.eventId, staffId: item.staffId, assignmentType: item.assignmentType }));
      if (item.venueId && !venueIds.has(item.venueId)) violations.push(violation("INVALID_CBT_STAFF_VENUE", "CBT staff must be assigned to a venue on the same sitting.", { eventId: sitting.eventId, staffId: item.staffId, venueId: item.venueId }));
      if (item.venueId && item.assignmentType === "INVIGILATOR") assignedInvigilatorsByVenue.set(item.venueId, (assignedInvigilatorsByVenue.get(item.venueId) ?? 0) + 1);
      if (item.venueId && item.assignmentType === "TECHNICAL_SUPPORT") assignedSupportByVenue.set(item.venueId, (assignedSupportByVenue.get(item.venueId) ?? 0) + 1);
      if (interval && unavailable(interval, item.staffId, dataset.invigilatorUnavailability)) violations.push(violation("INVIGILATOR_UNAVAILABLE", "Assigned CBT staff are unavailable during the sitting.", { eventId: sitting.eventId, staffId: item.staffId }));
    }
    for (const venueId of venueIds) {
      if ((assignedInvigilatorsByVenue.get(venueId) ?? 0) < staffing.minimumInvigilatorsPerVenue) violations.push(violation("INSUFFICIENT_INVIGILATORS", "Every CBT venue must have the configured number of invigilators.", { eventId: sitting.eventId, venueId, required: staffing.minimumInvigilatorsPerVenue, actual: assignedInvigilatorsByVenue.get(venueId) ?? 0 }));
      if ((assignedSupportByVenue.get(venueId) ?? 0) < staffing.minimumTechnicalSupportPerVenue) violations.push(violation("INSUFFICIENT_CBT_TECHNICAL_SUPPORT", "Every CBT venue must have the configured technical-support coverage.", { eventId: sitting.eventId, venueId, required: staffing.minimumTechnicalSupportPerVenue, actual: assignedSupportByVenue.get(venueId) ?? 0 }));
    }
    const requiredSupport = venueIds.size * staffing.minimumTechnicalSupportPerVenue + (staffing.additionalSupportPerCandidates ? Math.ceil(sitting.candidateCount / staffing.additionalSupportPerCandidates) : 0);
    const actualSupport = sitting.staff.filter((item) => item.assignmentType === "TECHNICAL_SUPPORT").length;
    if (actualSupport < requiredSupport) violations.push(violation("INSUFFICIENT_CBT_TECHNICAL_SUPPORT", "The sitting does not have enough technical-support staff for its venues and candidate count.", { eventId: sitting.eventId, required: requiredSupport, actual: actualSupport }));
  }

  for (const event of dataset.events.filter((item) => item.examMode === "CBT")) {
    const eventSittings = (byEvent.get(event.id) ?? []).slice().sort((a, b) => a.sequenceNumber - b.sequenceNumber || `${a.date}|${a.startTime}`.localeCompare(`${b.date}|${b.startTime}`));
    if ((totals.get(event.id) ?? 0) !== event.candidateCount) violations.push(violation("CBT_CANDIDATE_COUNT_MISMATCH", "All CBT sitting candidate counts must sum to the logical event candidate count.", { eventId: event.id, expected: event.candidateCount, actual: totals.get(event.id) ?? 0 }));
    eventSittings.forEach((sitting, index) => { if (sitting.sequenceNumber !== index + 1) violations.push(violation("INVALID_CBT_SEQUENCE", "CBT sitting sequence numbers must be contiguous starting at one.", { eventId: event.id, expected: index + 1, actual: sitting.sequenceNumber })); });
    const dates = new Set(eventSittings.map((sitting) => sitting.date));
    if (dates.size > 1 && (batching.requireSameDay || !batching.allowMultiDay)) violations.push(violation("CBT_SAME_DAY_REQUIREMENT", "CBT batches for one event must remain on the same day under the configured policy.", { eventId: event.id, dates: [...dates] }));
    for (const date of dates) {
      const daily = eventSittings.filter((sitting) => sitting.date === date);
      if (batching.maxBatchesPerDay != null && daily.length > batching.maxBatchesPerDay) violations.push(violation("CBT_MAX_BATCHES_PER_DAY", "The event exceeds the configured maximum CBT batches per day.", { eventId: event.id, date, maximum: batching.maxBatchesPerDay, actual: daily.length }));
    }
    for (let index = 1; index < eventSittings.length; index += 1) {
      const previous = eventSittings[index - 1];
      const current = eventSittings[index];
      const previousInterval = makeInterval(previous.date, timeToMinutes(previous.startTime), timeToMinutes(previous.endTime));
      const currentInterval = makeInterval(current.date, timeToMinutes(current.startTime), timeToMinutes(current.endTime));
      if (previousInterval && currentInterval && previous.date === current.date && currentInterval.startMinutes < previousInterval.endMinutes + (batching.minimumBatchGapMinutes ?? defaultBatchGapMinutes)) violations.push(violation("CBT_BATCH_GAP", "Same-day CBT batches must respect the configured minimum gap.", { eventId: event.id, previousSequence: previous.sequenceNumber, currentSequence: current.sequenceNumber, requiredMinutes: batching.minimumBatchGapMinutes ?? defaultBatchGapMinutes }));
    }
  }

  for (let left = 0; left < sittings.length; left += 1) for (let right = left + 1; right < sittings.length; right += 1) {
    const a = sittings[left];
    const b = sittings[right];
    const ai = makeInterval(a.date, timeToMinutes(a.startTime), timeToMinutes(a.endTime));
    const bi = makeInterval(b.date, timeToMinutes(b.startTime), timeToMinutes(b.endTime));
    if (!ai || !bi || !intervalsOverlap(ai, bi)) continue;
    if (a.eventId === b.eventId || a.venues.some((venue) => b.venues.some((other) => other.venueId === venue.venueId))) violations.push(violation(a.eventId === b.eventId ? "CBT_SITTING_OVERLAP" : "VENUE_COLLISION", "CBT sitting intervals cannot overlap on the same event or venue.", { eventAId: a.eventId, eventBId: b.eventId }));
    if (a.staff.some((person) => b.staff.some((other) => other.staffId === person.staffId))) violations.push(violation("INVIGILATOR_COLLISION", "CBT staff cannot cover overlapping sittings.", { eventAId: a.eventId, eventBId: b.eventId }));
    const edge = dataset.conflictGraph.edges.find((item) => (item.eventAId === a.eventId && item.eventBId === b.eventId) || (item.eventAId === b.eventId && item.eventBId === a.eventId));
    if (edge?.hard) violations.push(violation("EVENT_CONFLICT", "Hard-conflicting CBT events cannot overlap any sitting.", { eventAId: a.eventId, eventBId: b.eventId }));
  }
  return violations;
}
