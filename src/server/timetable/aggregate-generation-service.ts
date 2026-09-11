import { Prisma } from "@prisma/client";

import { assessPlannerFeasibility, generateAggregateTimetable, generateFlexibleAggregateTimetable, generateCbtBatchedAggregateTimetable, previewCbtBatches, validateCompleteAggregateTimetable, type AggregateCandidateTimetable, type AggregateSchedulingDataset } from "@/domain/timetable";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { getAggregateDataReadiness } from "@/server/exams/readiness";
import { buildAggregateSchedulingDataset } from "./aggregate-dataset-builder";
import type { GenerationRequest } from "./schemas";

export const AGGREGATE_ENGINE_VERSION = "1.0.0-aggregate-event";
export const AGGREGATE_SNAPSHOT_VERSION = "aggregate-event-fixed-slot-v1";

export type AggregateGenerationReadiness = {
  ready: boolean;
  blockers: { code: string; message: string; metadata: Record<string, unknown> }[];
  warnings: { code: string; message: string; metadata: Record<string, unknown> }[];
  summary: { events: number; timeSlots: number; calendarDays: number; eligibleExamDays: number; venues: number; invigilators: number; candidateWorkload: number; penOnPaperEvents: number; cbtEvents: number; conflictEdges: number; conflictDensity: number };
  cbt?: { venues: number; usableCapacity: number; events: number; eventsRequiringBatching: number; estimatedBatches: number; technicalSupportStaff: number; batchingEnabled: boolean; previews: ReturnType<typeof previewCbtBatches> };
};

export function createAggregateGenerationSnapshot(dataset: AggregateSchedulingDataset) {
  return {
    schemaVersion: AGGREGATE_SNAPSHOT_VERSION,
    session: dataset.session,
    semester: dataset.semester,
    examPeriod: dataset.examPeriod,
    events: dataset.events,
    timeSlots: dataset.timeSlots,
    conflictGraph: dataset.conflictGraph,
    venues: dataset.venues,
    venueUnavailability: dataset.venueUnavailability,
    invigilators: dataset.invigilators,
    invigilatorUnavailability: dataset.invigilatorUnavailability,
    config: dataset.config,
    schedulingMode: dataset.schedulingMode,
    calendarDays: dataset.calendarDays,
    timePolicy: dataset.timePolicy,
    cbtBatchingPolicy: dataset.cbtBatchingPolicy,
    cbtStaffingPolicy: dataset.cbtStaffingPolicy,
  };
}

export function cbtSittingPersistenceData(sitting: NonNullable<AggregateCandidateTimetable["sittings"]>[number], generationId: string) {
  return { generationId, examEventId: sitting.eventId, sequenceNumber: sitting.sequenceNumber, batchLabel: sitting.batchLabel, candidateCount: sitting.candidateCount, date: new Date(`${sitting.date}T00:00:00.000Z`), startTime: sitting.startTime, endTime: sitting.endTime, status: "GENERATED" as const };
}

function mapReadinessBlockers(readiness: Awaited<ReturnType<typeof getAggregateDataReadiness>>): { code: string; message: string; metadata: Record<string, unknown> }[] { return readiness.blockers.map((issue) => ({ code: issue.code, message: issue.message, metadata: { count: issue.count ?? null, ids: issue.ids ?? [] } })); }

export async function getAggregateGenerationReadiness(input: GenerationRequest): Promise<AggregateGenerationReadiness> {
  const [aggregateReadiness, dataset] = await Promise.all([getAggregateDataReadiness(input.academicSessionId, input.semesterId), buildAggregateSchedulingDataset(input.academicSessionId, input.semesterId, input.examPeriodId, { seed: input.seed, maxGenerationAttempts: input.attempts }, input.schedulingMode)]);
  const blockers: AggregateGenerationReadiness["blockers"] = mapReadinessBlockers(aggregateReadiness); const warnings: AggregateGenerationReadiness["warnings"] = aggregateReadiness.warnings.map((issue) => ({ code: issue.code, message: issue.message, metadata: { count: issue.count ?? null } }));
  if (!dataset.examPeriod.active) blockers.push({ code: "INACTIVE_RESOURCE", message: "The selected examination period is inactive.", metadata: { examPeriodId: dataset.examPeriod.id } });
  if (input.schedulingMode === "FIXED_SESSIONS" && !dataset.timeSlots.length) blockers.push({ code: "NO_FEASIBLE_SLOT", message: "The selected examination period has no fixed time slots.", metadata: { examPeriodId: dataset.examPeriod.id } });
  if (input.schedulingMode === "FLEXIBLE_INTERVALS") {
    const feasibility = assessPlannerFeasibility((dataset.calendarDays ?? []).map((day) => ({ ...day, blackoutType: day.blackoutType as "PUBLIC_HOLIDAY" | "UNIVERSITY_EVENT" | "NO_EXAMS" | "OTHER" | null | undefined })), dataset.events, dataset.venues, dataset.conflictGraph, dataset.cbtBatchingPolicy?.enabled);
    if (feasibility.status === "BLOCKED") for (const blocker of feasibility.blockers) blockers.push({ code: blocker.code, message: blocker.message, metadata: { eventId: blocker.eventId ?? null } });
    if (feasibility.status === "TIGHT") warnings.push({ code: "TIGHT_EXAM_PERIOD", message: "The saved calendar is usable but has limited planning slack.", metadata: { utilization: feasibility.summary.utilization } });
  }
  if (!dataset.invigilators.length && dataset.events.length) blockers.push({ code: "INSUFFICIENT_INVIGILATORS", message: "At least one active invigilator is required for aggregate generation.", metadata: {} });
  for (const event of dataset.events) {
    if (input.schedulingMode === "FIXED_SESSIONS" && dataset.timeSlots.every((slot) => slotDuration(slot) < event.durationMinutes)) blockers.push({ code: "EVENT_DURATION_EXCEEDS_SLOT", message: "No fixed time slot can accommodate this event duration.", metadata: { eventId: event.id, durationMinutes: event.durationMinutes } });
    const compatible = dataset.venues.filter((venue) => venue.active && (event.examMode === "CBT" ? (venue.capability === "CBT" || venue.capability === "BOTH") : (venue.capability === "WRITTEN" || venue.capability === "BOTH")));
    const capacity = compatible.reduce((sum, venue) => sum + (event.examMode === "CBT" ? (venue.usableComputerCapacity ?? 0) : (venue.examCapacity ?? venue.capacity)), 0);
    if (capacity < event.candidateCount && !(event.examMode === "CBT" && dataset.cbtBatchingPolicy?.enabled)) blockers.push({ code: event.examMode === "CBT" ? (dataset.cbtBatchingPolicy?.enabled ? "INSUFFICIENT_CBT_CAPACITY" : "CBT_BATCHING_DISABLED_FOR_OVERSIZED_EVENT") : "INSUFFICIENT_VENUE_CAPACITY", message: dataset.cbtBatchingPolicy?.enabled ? "Configured compatible venue capacity cannot accommodate the event in one sitting." : "CBT batching is disabled for an event larger than simultaneous usable computer capacity.", metadata: { eventId: event.id, candidateCount: event.candidateCount, capacity } });
  }
  const summary = { events: dataset.events.length, timeSlots: dataset.timeSlots.length, calendarDays: (dataset.calendarDays ?? []).length, eligibleExamDays: (dataset.calendarDays ?? []).filter((day) => day.enabled && !day.blackoutType).length, venues: dataset.venues.length, invigilators: dataset.invigilators.length, candidateWorkload: dataset.events.reduce((sum, event) => sum + event.candidateCount, 0), penOnPaperEvents: dataset.events.filter((event) => event.examMode === "PEN_ON_PAPER").length, cbtEvents: dataset.events.filter((event) => event.examMode === "CBT").length, conflictEdges: dataset.conflictGraph.metrics.edges, conflictDensity: dataset.conflictGraph.metrics.density };
  const cbtPreviews = previewCbtBatches(dataset); const cbtVenues = dataset.venues.filter((venue) => venue.active && (venue.capability === "CBT" || venue.capability === "BOTH") && (venue.usableComputerCapacity ?? 0) > 0); const supportStaff = dataset.invigilators.filter((item) => item.active && item.role === "CBT_TECHNICAL_SUPPORT").length; const cbtSummary = { venues: cbtVenues.length, usableCapacity: cbtVenues.reduce((sum, venue) => sum + (venue.usableComputerCapacity ?? 0), 0), events: cbtPreviews.length, eventsRequiringBatching: cbtPreviews.filter((item) => item.requiredBatches > 1).length, estimatedBatches: cbtPreviews.reduce((sum, item) => sum + item.requiredBatches, 0), technicalSupportStaff: supportStaff, batchingEnabled: dataset.cbtBatchingPolicy?.enabled ?? false, previews: cbtPreviews };
  if (cbtSummary.events && !cbtSummary.venues) blockers.push({ code: "NO_CBT_VENUES", message: "No active CBT-capable venue has usable computer capacity.", metadata: {} });
  if (cbtSummary.events && !supportStaff) blockers.push({ code: "NO_CBT_TECHNICAL_SUPPORT", message: "No active technical-support staff are available for CBT sittings.", metadata: {} });
  if (cbtSummary.events && cbtSummary.eventsRequiringBatching && !cbtSummary.batchingEnabled) blockers.push({ code: "CBT_BATCHING_DISABLED_FOR_OVERSIZED_EVENT", message: "One or more CBT events exceed simultaneous capacity while batching is disabled.", metadata: { events: cbtSummary.eventsRequiringBatching } });
  if (cbtSummary.eventsRequiringBatching && cbtSummary.estimatedBatches > cbtSummary.events + 2) warnings.push({ code: "HIGH_BATCH_COUNT", message: "CBT workload requires several sittings.", metadata: { estimatedBatches: cbtSummary.estimatedBatches } });
  return { ready: blockers.length === 0, blockers, warnings, summary, cbt: cbtSummary };
}

function slotDuration(slot: { startTime: string; endTime: string }) { const [startHour, startMinute] = slot.startTime.split(":").map(Number); const [endHour, endMinute] = slot.endTime.split(":").map(Number); return endHour * 60 + endMinute - (startHour * 60 + startMinute); }

export async function generateAndPersistAggregateTimetable(input: GenerationRequest, actorId: string) {
  const existing = await prisma.timetableGeneration.findFirst({ where: { sessionId: input.academicSessionId, semesterId: input.semesterId, periodId: input.examPeriodId, status: "RUNNING" }, select: { id: true } });
  if (existing) throw new AcademicError("GENERATION_ALREADY_RUNNING", "A timetable generation is already running for this academic period.", { generationId: existing.id }, 409);
  const dataset = await buildAggregateSchedulingDataset(input.academicSessionId, input.semesterId, input.examPeriodId, { seed: input.seed, maxGenerationAttempts: input.attempts }, input.schedulingMode);
  const readiness = await getAggregateGenerationReadiness(input);
  let generation;
  try {
    generation = await prisma.timetableGeneration.create({ data: { sessionId: input.academicSessionId, semesterId: input.semesterId, periodId: input.examPeriodId, generatedBy: actorId, status: readiness.ready ? "RUNNING" : "FAILED", generationMode: "AGGREGATE_EVENT", lockKey: readiness.ready ? `${input.academicSessionId}|${input.semesterId}|${input.examPeriodId}` : null, engineVersion: AGGREGATE_ENGINE_VERSION, seed: dataset.config.seed, attemptCount: dataset.config.maxGenerationAttempts, inputSnapshot: createAggregateGenerationSnapshot(dataset) as Prisma.InputJsonValue, snapshotSchemaVersion: AGGREGATE_SNAPSHOT_VERSION, metadata: { mode: "AGGREGATE_EVENT", schedulingMode: input.schedulingMode, engineVersion: AGGREGATE_ENGINE_VERSION, readiness } as Prisma.InputJsonValue } });
  } catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new AcademicError("GENERATION_ALREADY_RUNNING", "A timetable generation is already running for this academic period.", {}, 409); throw error; }
  if (!readiness.ready) { await prisma.auditLog.create({ data: { actorId, action: "AGGREGATE_GENERATION_BLOCKED", entity: "TimetableGeneration", entityId: generation.id, metadata: { blockers: readiness.blockers } as Prisma.InputJsonValue } }); return { generation, readiness, candidate: null, validation: null }; }
  try {
    const candidate = dataset.events.some((event) => event.examMode === "CBT") ? generateCbtBatchedAggregateTimetable(dataset, dataset.config).candidate : input.schedulingMode === "FLEXIBLE_INTERVALS" ? generateFlexibleAggregateTimetable(dataset, dataset.config) : generateAggregateTimetable(dataset, dataset.config); const validation = validateCompleteAggregateTimetable(candidate, dataset); candidate.hardViolations = [...candidate.hardViolations, ...validation.violations]; candidate.metrics.hardViolationCount = candidate.hardViolations.length;
    if (!validateCompleteAggregateTimetable(candidate, dataset, false).valid) throw new AcademicError("TIMETABLE_INVALID", "Generated assignments failed validation before persistence.", { violations: validation.violations }, 409);
    const status = validation.valid && candidate.unscheduledEvents.length === 0 ? "COMPLETED" : "COMPLETED_WITH_WARNINGS";
    const saved = await prisma.$transaction(async (db) => {
      for (const assignment of candidate.assignments) {
        const schedule = await db.aggregateExamSchedule.create({ data: { generationId: generation.id, eventId: assignment.eventId, timeSlotId: assignment.timeSlotId, date: input.schedulingMode === "FLEXIBLE_INTERVALS" ? new Date(`${assignment.date}T00:00:00.000Z`) : null, startTime: assignment.startTime, endTime: assignment.endTime, schedulingMode: input.schedulingMode, status: "GENERATED", generatedBy: actorId } });
        if (assignment.venues.length) await db.aggregateExamVenueAssignment.createMany({ data: assignment.venues.map((venue) => ({ aggregateScheduleId: schedule.id, venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity, allocatedCandidates: venue.allocatedCandidates ?? undefined })) });
        if (assignment.invigilators.length) await db.aggregateInvigilationAssignment.createMany({ data: assignment.invigilators.map((item) => ({ aggregateScheduleId: schedule.id, invigilatorId: item.invigilatorId, venueId: item.venueId ?? null })) });
      }
      for (const sitting of candidate.sittings ?? []) {
        const savedSitting = await db.examSitting.create({ data: cbtSittingPersistenceData(sitting, generation.id) });
        if (sitting.venues.length) await db.examSittingVenueAssignment.createMany({ data: sitting.venues.map((venue) => ({ sittingId: savedSitting.id, venueId: venue.venueId, allocatedCandidates: venue.allocatedCandidates, allocatedCapacity: venue.allocatedCapacity })) });
        if (sitting.staff.length) await db.examSittingStaffAssignment.createMany({ data: sitting.staff.map((item) => ({ sittingId: savedSitting.id, staffId: item.staffId, assignmentType: item.assignmentType, venueId: item.venueId ?? null })) });
      }
      const updated = await db.timetableGeneration.update({ where: { id: generation.id }, data: { status, lockKey: null, score: candidate.softScore, metadata: { mode: "AGGREGATE_EVENT", schedulingMode: input.schedulingMode, engineVersion: AGGREGATE_ENGINE_VERSION, readiness, metrics: candidate.metrics, unscheduledEvents: candidate.unscheduledEvents, hardViolations: candidate.hardViolations } as Prisma.InputJsonValue } });
      await db.auditLog.create({ data: { actorId, action: "AGGREGATE_GENERATION_COMPLETED", entity: "TimetableGeneration", entityId: generation.id, metadata: { status, score: candidate.softScore, scheduledEvents: candidate.metrics.scheduledEvents, unscheduledEvents: candidate.metrics.unscheduledEvents } as Prisma.InputJsonValue } });
      return updated;
    }, { timeout: 60000 });
    return { generation: saved, readiness, candidate, validation };
  } catch (error) {
    const failed = await prisma.$transaction(async (db) => { const updated = await db.timetableGeneration.update({ where: { id: generation.id }, data: { status: "FAILED", lockKey: null, metadata: { mode: "AGGREGATE_EVENT", engineVersion: AGGREGATE_ENGINE_VERSION, error: error instanceof Error ? error.message : "Aggregate generation failed" } as Prisma.InputJsonValue } }); await db.auditLog.create({ data: { actorId, action: "AGGREGATE_GENERATION_FAILED", entity: "TimetableGeneration", entityId: generation.id, metadata: { error: error instanceof Error ? error.message : "Aggregate generation failed" } as Prisma.InputJsonValue } }); return updated; });
    return { generation: failed, readiness, candidate: null, validation: null, error: "AGGREGATE_GENERATION_FAILED" as const };
  }
}

export function aggregateCandidateSummary(candidate: AggregateCandidateTimetable | null) { return candidate ? { assignments: candidate.assignments.length, unscheduledEvents: candidate.unscheduledEvents, hardViolations: candidate.hardViolations, softScore: candidate.softScore, metrics: candidate.metrics } : null; }
