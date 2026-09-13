import { getConflictingEvents, getWeightedConflictDegree } from "../../exams";
import { allocateAggregateInvigilators, allocateAggregateVenues, slotDurationMinutes } from "./allocation";
import { resolveAggregateGenerationConfig } from "./config";
import type { AggregateCandidateTimetable, AggregateConstraintViolation, AggregateEventDiagnostic, AggregateExamAssignment, AggregateGenerationConfig, AggregateSchedulingDataset, AggregateSlotEvaluation, AggregateTimetableMetrics, SchedulingExamEvent, UnscheduledAggregateEvent } from "./types";
import { validateAggregateTimetable } from "./validation";
import { fixedSlotCalendarViolation, fixedSlotTurnaroundViolation } from "./fixed-rules";

type MutableState = { assignments: AggregateExamAssignment[]; eventSlots: Map<string, string>; slotEvents: Map<string, Set<string>>; slotVenues: Map<string, Map<string, number>>; slotInvigilators: Map<string, Set<string>>; dailyInvigilators: Map<string, number>; totalInvigilators: Map<string, number> };

function stableSeed(value: string, seed: number) { let hash = seed | 0; for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0; return Math.abs(hash); }
function slotOrder(dataset: AggregateSchedulingDataset) { return new Map(dataset.timeSlots.slice().sort((a, b) => `${a.date}|${a.startTime}|${a.id}`.localeCompare(`${b.date}|${b.startTime}|${b.id}`)).map((slot, index) => [slot.id, index])); }
function eventById(dataset: AggregateSchedulingDataset) { return new Map(dataset.events.map((event) => [event.id, event])); }
function eventSharesCohort(left: SchedulingExamEvent, right: SchedulingExamEvent) { const rightKeys = new Set(right.cohortKeys); return left.cohortKeys.some((key) => rightKeys.has(key)); }

function compatibleSlotCount(event: SchedulingExamEvent, dataset: AggregateSchedulingDataset) { return dataset.timeSlots.filter((slot) => slotDurationMinutes(slot) >= event.durationMinutes).length; }
function compatibleVenueCount(event: SchedulingExamEvent, dataset: AggregateSchedulingDataset) { return dataset.venues.filter((venue) => venue.active && (event.examMode === "CBT" ? (venue.capability === "CBT" || venue.capability === "BOTH") && (venue.usableComputerCapacity ?? 0) > 0 : (venue.capability === "WRITTEN" || venue.capability === "BOTH") && (venue.examCapacity ?? venue.capacity) > 0)).length; }

function orderEvents(events: SchedulingExamEvent[], dataset: AggregateSchedulingDataset, state: MutableState, attemptSeed: number) {
  const assignedSlots = state.eventSlots;
  return events.slice().sort((left, right) => {
    const saturation = (event: SchedulingExamEvent) => new Set(getConflictingEvents(dataset.conflictGraph, event.id).filter((edge) => edge.hard).map((edge) => assignedSlots.get(edge.eventAId === event.id ? edge.eventBId : edge.eventAId)).filter(Boolean)).size;
    const saturationDifference = saturation(right) - saturation(left); if (saturationDifference) return saturationDifference;
    const hardDegree = (event: SchedulingExamEvent) => getConflictingEvents(dataset.conflictGraph, event.id).filter((edge) => edge.hard).length;
    const hardDegreeDifference = hardDegree(right) - hardDegree(left); if (hardDegreeDifference) return hardDegreeDifference;
    const weightedDifference = getWeightedConflictDegree(dataset.conflictGraph, right.id) - getWeightedConflictDegree(dataset.conflictGraph, left.id); if (weightedDifference) return weightedDifference;
    const candidateDifference = right.candidateCount - left.candidateCount; if (candidateDifference) return candidateDifference;
    const venueScarcityDifference = (compatibleVenueCount(left, dataset) - compatibleVenueCount(right, dataset)); if (venueScarcityDifference) return venueScarcityDifference;
    const slotScarcityDifference = compatibleSlotCount(left, dataset) - compatibleSlotCount(right, dataset); if (slotScarcityDifference) return slotScarcityDifference;
    const modeScarcityDifference = (right.examMode === "CBT" ? compatibleVenueCount(right, dataset) : Number.MAX_SAFE_INTEGER) - (left.examMode === "CBT" ? compatibleVenueCount(left, dataset) : Number.MAX_SAFE_INTEGER); if (modeScarcityDifference) return modeScarcityDifference;
    const seededDifference = stableSeed(left.id, attemptSeed) - stableSeed(right.id, attemptSeed); if (seededDifference) return seededDifference;
    return left.id.localeCompare(right.id);
  });
}

function slotFor(dataset: AggregateSchedulingDataset, id: string) { return dataset.timeSlots.find((slot) => slot.id === id); }

function cohortSoftPenalty(event: SchedulingExamEvent, slotId: string, state: MutableState, dataset: AggregateSchedulingDataset, config: AggregateGenerationConfig) {
  const order = slotOrder(dataset); const slot = slotFor(dataset, slotId); if (!slot) return 0;
  let penalty = 0; const daily = new Map<string, number>();
  for (const assignment of state.assignments) {
    const other = eventById(dataset).get(assignment.eventId); const otherSlot = assignment.timeSlotId ? slotFor(dataset, assignment.timeSlotId) : undefined; if (!other || !otherSlot || !eventSharesCohort(event, other)) continue;
    daily.set(otherSlot.date, (daily.get(otherSlot.date) ?? 0) + 1);
    if (otherSlot.date === slot.date && Math.abs((order.get(assignment.timeSlotId ?? "") ?? 0) - (order.get(slotId) ?? 0)) === 1) penalty += config.cohortBackToBackPenalty;
  }
  const count = (daily.get(slot.date) ?? 0) + 1; if (count > config.maxCohortExamsPerDay) penalty += (count - config.maxCohortExamsPerDay) * config.cohortDailyOverloadPenalty;
  return penalty;
}

function evaluateSlot(event: SchedulingExamEvent, slot: AggregateSchedulingDataset["timeSlots"][number], state: MutableState, dataset: AggregateSchedulingDataset, config: AggregateGenerationConfig): AggregateSlotEvaluation {
  const hardViolations: AggregateConstraintViolation[] = [];
  if (slot.examPeriodId !== dataset.examPeriod.id) hardViolations.push({ code: "INVALID_TIME_SLOT", message: "Assignment uses a slot outside the selected examination period.", metadata: { eventId: event.id, timeSlotId: slot.id } });
  const calendarViolation = fixedSlotCalendarViolation(slot, dataset); if (calendarViolation) hardViolations.push({ ...calendarViolation, metadata: { ...calendarViolation.metadata, eventId: event.id } });
  const turnaroundViolation = fixedSlotTurnaroundViolation(slot, dataset); if (turnaroundViolation) hardViolations.push({ ...turnaroundViolation, metadata: { ...turnaroundViolation.metadata, eventId: event.id } });
  if (slotDurationMinutes(slot) < event.durationMinutes) hardViolations.push({ code: "EVENT_DURATION_EXCEEDS_SLOT", message: "The fixed time slot is shorter than the event duration.", metadata: { eventId: event.id, durationMinutes: event.durationMinutes, slotDurationMinutes: slotDurationMinutes(slot), timeSlotId: slot.id } });
  for (const edge of getConflictingEvents(dataset.conflictGraph, event.id)) {
    const otherId = edge.eventAId === event.id ? edge.eventBId : edge.eventAId;
    if (state.eventSlots.get(otherId) !== slot.id) continue;
    if (edge.hard) hardViolations.push({ code: "EVENT_CONFLICT", message: "A hard-conflicting exam event is already assigned to this slot.", metadata: { eventId: event.id, conflictingEventId: otherId, reasons: edge.reasons, timeSlotId: slot.id } });
  }
  const venues = hardViolations.length ? undefined : allocateAggregateVenues(event.candidateCount, event.examMode, slot, dataset.venues, dataset.venueUnavailability, state.slotVenues.get(slot.id) ?? new Map(), config.venueSplitPenalty);
  if (venues && !venues.success) hardViolations.push({ code: venues.failureCode ?? "INSUFFICIENT_VENUE_CAPACITY", message: venues.failureReason ?? "No compatible venue allocation was found.", metadata: { eventId: event.id, candidateCount: event.candidateCount, examMode: event.examMode, timeSlotId: slot.id } });
  const invigilators = venues?.success ? allocateAggregateInvigilators(slot, venues.venueAssignments.map((venue) => venue.venueId), dataset.invigilators, dataset.invigilatorUnavailability, state.slotInvigilators.get(slot.id) ?? new Set(), state.dailyInvigilators, state.totalInvigilators, config) : undefined;
  if (invigilators && !invigilators.success) hardViolations.push({ code: invigilators.failureCode ?? "INSUFFICIENT_INVIGILATORS", message: invigilators.failureReason ?? "No invigilator allocation was found.", metadata: { eventId: event.id, timeSlotId: slot.id } });
  let softPenalty = cohortSoftPenalty(event, slot.id, state, dataset, config);
  for (const edge of getConflictingEvents(dataset.conflictGraph, event.id)) if (!edge.hard && state.eventSlots.get(edge.eventAId === event.id ? edge.eventBId : edge.eventAId) === slot.id) softPenalty += config.softConflictPenalty;
  if (venues?.success) softPenalty += venues.unusedCapacity * config.venueWastePenaltyWeight + Math.max(0, venues.venueAssignments.length - 1) * config.venueSplitPenalty;
  return { eventId: event.id, timeSlotId: slot.id, feasible: hardViolations.length === 0, hardViolations, softPenalty, venuePreview: venues, invigilatorPreview: invigilators };
}

function commitAssignment(assignment: AggregateExamAssignment, state: MutableState, dataset: AggregateSchedulingDataset) {
  state.assignments.push(assignment); state.eventSlots.set(assignment.eventId, assignment.timeSlotId!);
  const events = state.slotEvents.get(assignment.timeSlotId!) ?? new Set<string>(); events.add(assignment.eventId); state.slotEvents.set(assignment.timeSlotId!, events);
  const venues = state.slotVenues.get(assignment.timeSlotId!) ?? new Map<string, number>(); assignment.venues.forEach((venue) => venues.set(venue.venueId, (venues.get(venue.venueId) ?? 0) + (venue.allocatedCandidates ?? 0))); state.slotVenues.set(assignment.timeSlotId!, venues);
  const invigilators = state.slotInvigilators.get(assignment.timeSlotId!) ?? new Set<string>(); assignment.invigilators.forEach((item) => invigilators.add(item.invigilatorId)); state.slotInvigilators.set(assignment.timeSlotId!, invigilators);
  const slot = slotFor(dataset, assignment.timeSlotId!); if (slot) for (const item of assignment.invigilators) { state.dailyInvigilators.set(`${item.invigilatorId}|${slot.date}`, (state.dailyInvigilators.get(`${item.invigilatorId}|${slot.date}`) ?? 0) + 1); state.totalInvigilators.set(item.invigilatorId, (state.totalInvigilators.get(item.invigilatorId) ?? 0) + 1); }
}

function generateAttempt(dataset: AggregateSchedulingDataset, config: AggregateGenerationConfig, attempt: number): AggregateCandidateTimetable {
  const initialVenueUsage = new Map<string, Map<string, number>>(); for (const item of dataset.initialVenueUsage ?? []) { const slot = item.slotId ?? dataset.timeSlots.find((candidate) => candidate.date === item.date && candidate.startTime === item.startTime && candidate.endTime === item.endTime)?.id; if (!slot) continue; const usage = initialVenueUsage.get(slot) ?? new Map<string, number>(); usage.set(item.venueId, (usage.get(item.venueId) ?? 0) + item.allocatedCandidates); initialVenueUsage.set(slot, usage); }
  const state: MutableState = { assignments: [], eventSlots: new Map(), slotEvents: new Map(), slotVenues: initialVenueUsage, slotInvigilators: new Map(), dailyInvigilators: new Map(), totalInvigilators: new Map() }; const unscheduledEvents: UnscheduledAggregateEvent[] = [];
  const ordered = orderEvents(dataset.events.filter((event) => event.candidateCount >= 0), dataset, state, config.seed + attempt); const sortedSlots = dataset.timeSlots.slice().sort((a, b) => `${a.date}|${a.startTime}|${a.id}`.localeCompare(`${b.date}|${b.startTime}|${b.id}`));
  for (const event of ordered) {
    const evaluations: AggregateSlotEvaluation[] = []; let selected: { assignment: AggregateExamAssignment; evaluation: AggregateSlotEvaluation } | undefined;
    for (const slot of sortedSlots) { const evaluation = evaluateSlot(event, slot, state, dataset, config); evaluations.push(evaluation); if (!evaluation.feasible) continue; const assignment: AggregateExamAssignment = { eventId: event.id, timeSlotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime, venues: evaluation.venuePreview!.venueAssignments, invigilators: evaluation.invigilatorPreview!.invigilators }; const fit = slotDurationMinutes(slot) - event.durationMinutes; const selectedSlot = selected ? sortedSlots.find((candidate) => candidate.id === selected?.assignment.timeSlotId) : undefined; const selectedFit = selectedSlot ? slotDurationMinutes(selectedSlot) - event.durationMinutes : Number.POSITIVE_INFINITY; const selectedPenalty = selected?.evaluation.softPenalty ?? Number.POSITIVE_INFINITY; const selectedId = selected?.assignment.timeSlotId ?? ""; if (!selected || fit < selectedFit || (fit === selectedFit && (evaluation.softPenalty < selectedPenalty || (evaluation.softPenalty === selectedPenalty && slot.id.localeCompare(selectedId) < 0)))) selected = { assignment, evaluation }; }
    if (!selected) { const conflictingEvents = getConflictingEvents(dataset.conflictGraph, event.id).map((edge) => ({ eventId: edge.eventAId === event.id ? edge.eventBId : edge.eventAId, hard: edge.hard, weight: edge.weight, reasons: edge.reasons })); const diagnostics: AggregateEventDiagnostic = { eventId: event.id, title: event.title, candidateCount: event.candidateCount, examMode: event.examMode, durationMinutes: event.durationMinutes, conflictingEvents, attemptedSlots: evaluations }; unscheduledEvents.push({ eventId: event.id, title: event.title, reason: "NO_FEASIBLE_SLOT", diagnostics }); continue; }
    commitAssignment(selected.assignment, state, dataset);
  }
  const candidate: AggregateCandidateTimetable = { assignments: state.assignments, unscheduledEvents, hardViolations: [], softScore: 0, metrics: {} as AggregateTimetableMetrics }; candidate.hardViolations = validateAggregateTimetable(candidate, dataset); candidate.metrics = calculateAggregateMetrics(candidate, dataset); candidate.softScore = calculateSoftScore(candidate, dataset, config); return candidate;
}

export function generateAggregateTimetable(dataset: AggregateSchedulingDataset, inputConfig: Partial<AggregateGenerationConfig> = {}): AggregateCandidateTimetable {
  const config = resolveAggregateGenerationConfig(inputConfig); let best: AggregateCandidateTimetable | undefined;
  for (let attempt = 0; attempt < config.maxGenerationAttempts; attempt += 1) { const candidate = generateAttempt(dataset, config, attempt); if (!best || candidate.hardViolations.length < best.hardViolations.length || (candidate.hardViolations.length === best.hardViolations.length && candidate.unscheduledEvents.length < best.unscheduledEvents.length) || (candidate.hardViolations.length === best.hardViolations.length && candidate.unscheduledEvents.length === best.unscheduledEvents.length && candidate.softScore < best.softScore)) best = candidate; if (candidate.hardViolations.length === 0 && candidate.unscheduledEvents.length === 0) break; }
  return best!;
}

function calculateAggregateMetrics(candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset): AggregateTimetableMetrics {
  const slots = new Map(dataset.timeSlots.map((slot) => [slot.id, slot])); const order = slotOrder(dataset); const eventMap = eventById(dataset); let totalUnusedCapacity = 0; let venueSplitCount = 0; let softConflictOverlapCount = 0; let cohortBackToBackCount = 0; let cohortDailyOverloadCount = 0; const cohortSchedules = new Map<string, { eventId: string; slotId: string; date: string }[]>();
  for (const assignment of candidate.assignments) { const event = eventMap.get(assignment.eventId)!; totalUnusedCapacity += assignment.venues.reduce((sum, venue) => sum + venue.allocatedCapacity, 0) - event.candidateCount; if (assignment.venues.length > 1) venueSplitCount += 1; for (const cohort of event.cohortKeys) { const slot = assignment.timeSlotId ? slots.get(assignment.timeSlotId) : undefined; if (!slot) continue; cohortSchedules.set(cohort, [...(cohortSchedules.get(cohort) ?? []), { eventId: event.id, slotId: slot.id, date: slot.date }]); } }
  for (const edge of dataset.conflictGraph.edges) if (!edge.hard && candidate.assignments.some((assignment) => assignment.eventId === edge.eventAId && candidate.assignments.some((other) => other.eventId === edge.eventBId && other.timeSlotId === assignment.timeSlotId))) softConflictOverlapCount += 1;
  for (const schedules of cohortSchedules.values()) { const sorted = schedules.slice().sort((a, b) => (order.get(a.slotId) ?? 0) - (order.get(b.slotId) ?? 0)); for (let index = 1; index < sorted.length; index += 1) if (sorted[index].date === sorted[index - 1].date && (order.get(sorted[index].slotId) ?? 0) - (order.get(sorted[index - 1].slotId) ?? 0) === 1) cohortBackToBackCount += 1; const byDate = new Map<string, number>(); for (const item of schedules) byDate.set(item.date, (byDate.get(item.date) ?? 0) + 1); for (const count of byDate.values()) if (count > dataset.config.maxCohortExamsPerDay) cohortDailyOverloadCount += count - dataset.config.maxCohortExamsPerDay; }
  const invigilatorLoads = new Map<string, number>(); const dailyLoads = new Map<string, number>(); for (const assignment of candidate.assignments) { const slot = assignment.timeSlotId ? slots.get(assignment.timeSlotId) : undefined; if (!slot) continue; for (const invigilator of assignment.invigilators) { invigilatorLoads.set(invigilator.invigilatorId, (invigilatorLoads.get(invigilator.invigilatorId) ?? 0) + 1); dailyLoads.set(`${invigilator.invigilatorId}|${slot.date}`, (dailyLoads.get(`${invigilator.invigilatorId}|${slot.date}`) ?? 0) + 1); } }
  const loads = dataset.invigilators.map((item) => invigilatorLoads.get(item.id) ?? 0); const average = loads.length ? loads.reduce((sum, value) => sum + value, 0) / loads.length : 0; const variance = loads.length ? loads.reduce((sum, value) => sum + (value - average) ** 2, 0) / loads.length : 0; const invigilatorDailyOverloadCount = [...dailyLoads.entries()].reduce((total, [key, count]) => { const invigilator = dataset.invigilators.find((item) => item.id === key.split("|")[0]); return total + (invigilator ? Math.max(0, count - invigilator.maximumDailyAssignments) : 0); }, 0); const totalCbtCapacity = dataset.venues.filter((venue) => venue.capability === "CBT" || venue.capability === "BOTH").reduce((sum, venue) => sum + (venue.usableComputerCapacity ?? 0), 0); const cbtCandidates = dataset.events.filter((event) => event.examMode === "CBT").reduce((sum, event) => sum + event.candidateCount, 0);
  return { totalEvents: dataset.events.length, scheduledEvents: candidate.assignments.length, unscheduledEvents: candidate.unscheduledEvents.length, candidateWorkload: dataset.events.reduce((sum, event) => sum + event.candidateCount, 0), penOnPaperEvents: dataset.events.filter((event) => event.examMode === "PEN_ON_PAPER").length, cbtEvents: dataset.events.filter((event) => event.examMode === "CBT").length, hardViolationCount: candidate.hardViolations.length, softConflictOverlapCount, cohortBackToBackCount, cohortDailyOverloadCount, averageVenueUtilization: candidate.assignments.reduce((sum, assignment) => sum + assignment.venues.reduce((inner, venue) => inner + venue.allocatedCapacity, 0), 0) ? 1 - totalUnusedCapacity / candidate.assignments.reduce((sum, assignment) => sum + assignment.venues.reduce((inner, venue) => inner + venue.allocatedCapacity, 0), 0) : 0, totalUnusedCapacity, cbtCapacityUtilization: totalCbtCapacity ? Math.min(1, cbtCandidates / totalCbtCapacity) : 0, venueSplitCount, invigilatorDailyOverloadCount, invigilatorAssignmentMin: loads.length ? Math.min(...loads) : 0, invigilatorAssignmentMax: loads.length ? Math.max(...loads) : 0, invigilatorAssignmentAverage: average, invigilatorWorkloadVariance: variance };
}

function calculateSoftScore(candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset, config: AggregateGenerationConfig) { const metrics = candidate.metrics; return metrics.hardViolationCount * 100000 + metrics.unscheduledEvents * 10000 + metrics.softConflictOverlapCount * config.softConflictPenalty + metrics.cohortBackToBackCount * config.cohortBackToBackPenalty + metrics.cohortDailyOverloadCount * config.cohortDailyOverloadPenalty + metrics.totalUnusedCapacity * config.venueWastePenaltyWeight + metrics.venueSplitCount * config.venueSplitPenalty + metrics.invigilatorWorkloadVariance * config.invigilatorBalancePenaltyWeight + metrics.invigilatorDailyOverloadCount * config.dailyInvigilatorOverloadPenalty + (dataset.timeSlots.length ? Math.max(0, (dataset.timeSlots.length - 1) / 2 - candidate.assignments.length) : 0); }
