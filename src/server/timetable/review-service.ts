import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { buildSchedulingDataset } from "./dataset-builder";
import { scoreTimetable } from "@/domain/timetable/scoring/score";
import { resolveEngineConfig, validateCompleteAggregateTimetable, validateTimetable, type AggregateCandidateTimetable, type AggregateSchedulingDataset, type CandidateTimetable, type TimetableMetrics } from "@/domain/timetable";
import { buildConflictGraph } from "@/domain/timetable/graph/conflict-graph";
import { buildAggregateSchedulingDataset } from "./aggregate-dataset-builder";

type Operation = "MOVE_EXAM" | "REASSIGN_VENUES" | "REASSIGN_INVIGILATORS";
type EditInput = { generationId: string; scheduleId: string; operation: Operation; targetTimeSlotId?: string; venueIds?: string[]; invigilatorIds?: string[]; reason?: string };

export type HallCollision = {
  scheduleIds: string[];
  courseCodes: string[];
  date: string;
  startTime: string;
  endTime: string;
};

function dateKey(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function slotsOverlap(a: { date: Date | string; startTime: string; endTime: string }, b: { date: Date | string; startTime: string; endTime: string }) {
  return dateKey(a.date) === dateKey(b.date) && a.startTime < b.endTime && b.startTime < a.endTime;
}

function asCandidate(generation: { schedules: Array<{ courseId: string; timeSlotId: string; venues: Array<{ venueId: string; allocatedCapacity: number }>; invigilators: Array<{ invigilatorId: string; venueId: string | null }> }>; metadata: unknown; score: number | null }): CandidateTimetable {
  const metadata = (generation.metadata && typeof generation.metadata === "object" ? generation.metadata : {}) as Record<string, unknown>;
  const metrics = (metadata.metrics ?? {}) as TimetableMetrics;
  return { assignments: generation.schedules.map((schedule) => ({ courseId: schedule.courseId, timeSlotId: schedule.timeSlotId, venues: schedule.venues.map((venue) => ({ venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity })), invigilators: schedule.invigilators.map((invigilator) => ({ invigilatorId: invigilator.invigilatorId, venueId: invigilator.venueId ?? undefined })) })), unscheduledCourses: Array.isArray(metadata.unscheduledCourses) ? metadata.unscheduledCourses as CandidateTimetable["unscheduledCourses"] : [], hardViolations: Array.isArray(metadata.hardViolations) ? metadata.hardViolations as CandidateTimetable["hardViolations"] : [], softScore: generation.score ?? 0, metrics };
}

function asAggregateCandidate(generation: { aggregateSchedules: Array<{ eventId: string; timeSlotId: string | null; date: Date | null; startTime: string | null; endTime: string | null; venues: Array<{ venueId: string; allocatedCapacity: number; allocatedCandidates: number | null }>; invigilators: Array<{ invigilatorId: string; venueId: string | null }> }>; metadata: unknown; score: number | null }): AggregateCandidateTimetable {
  const metadata = (generation.metadata && typeof generation.metadata === "object" ? generation.metadata : {}) as Record<string, unknown>;
  return {
    assignments: generation.aggregateSchedules.map((schedule) => ({ eventId: schedule.eventId, timeSlotId: schedule.timeSlotId, date: schedule.date?.toISOString().slice(0, 10) ?? "", startTime: schedule.startTime ?? "", endTime: schedule.endTime ?? "", venues: schedule.venues.map((venue) => ({ venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity, allocatedCandidates: venue.allocatedCandidates })), invigilators: schedule.invigilators.map((item) => ({ invigilatorId: item.invigilatorId, venueId: item.venueId ?? undefined })) })),
    unscheduledEvents: Array.isArray(metadata.unscheduledEvents) ? metadata.unscheduledEvents as AggregateCandidateTimetable["unscheduledEvents"] : [],
    hardViolations: Array.isArray(metadata.hardViolations) ? metadata.hardViolations as AggregateCandidateTimetable["hardViolations"] : [],
    softScore: generation.score ?? 0,
    metrics: (metadata.metrics ?? {}) as AggregateCandidateTimetable["metrics"],
  };
}

async function loadEditableGeneration(generationId: string, scheduleId?: string) {
  const generation = await prisma.timetableGeneration.findUnique({ where: { id: generationId }, include: { schedules: { include: { venues: true, invigilators: true } } } });
  if (!generation) throw new AcademicError("NOT_FOUND", "The timetable generation was not found.", {}, 404);
  if (generation.reviewStatus === "APPROVED") throw new AcademicError("TIMETABLE_NOT_EDITABLE", "Approved timetables cannot be edited.", {}, 409);
  const schedule = scheduleId ? generation.schedules.find((item) => item.id === scheduleId) : undefined;
  if (scheduleId && !schedule) throw new AcademicError("NOT_FOUND", "The examination schedule was not found in this generation.", {}, 404);
  return { generation, schedule };
}

export async function getGenerationDetail(generationId: string) {
  const generation = await prisma.timetableGeneration.findUnique({ where: { id: generationId }, include: { session: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } }, period: { select: { id: true, name: true, startDate: true, endDate: true } }, generator: { select: { id: true, name: true, email: true } }, approver: { select: { id: true, name: true } }, schedules: { include: { course: { select: { id: true, code: true, title: true, department: { select: { name: true, code: true } } } }, timeSlot: true, venues: { include: { venue: true } }, invigilators: { include: { invigilator: { select: { id: true, name: true, staffId: true } } } } }, orderBy: [{ timeSlot: { date: "asc" } }, { timeSlot: { startTime: "asc" } }] }, aggregateSchedules: { include: { event: true, timeSlot: true, venues: { include: { venue: true } }, invigilators: { include: { invigilator: { select: { id: true, name: true, staffId: true } } } } }, orderBy: [{ timeSlot: { date: "asc" } }, { timeSlot: { startTime: "asc" } }] }, examSittings: { include: { examEvent: true, venues: { include: { venue: true } }, staff: { include: { staff: { select: { id: true, name: true, role: true } } } } }, orderBy: [{ date: "asc" }, { startTime: "asc" }, { sequenceNumber: "asc" }] } } });
  if (!generation) throw new AcademicError("NOT_FOUND", "The timetable generation was not found.", {}, 404);
  if (generation.generationMode === "AGGREGATE_EVENT") {
    const snapshot = generation.inputSnapshot && typeof generation.inputSnapshot === "object" && !Array.isArray(generation.inputSnapshot) ? generation.inputSnapshot as unknown as AggregateSchedulingDataset : null;
    const dataset = snapshot?.events && snapshot?.conflictGraph ? snapshot : await buildAggregateSchedulingDataset(generation.sessionId, generation.semesterId, generation.periodId);
    const candidate = asAggregateCandidate(generation);
    candidate.assignments = candidate.assignments.map((a) => { const slot = dataset.timeSlots.find((s) => s.id === a.timeSlotId); return slot ? { ...a, date: slot.date, startTime: slot.startTime, endTime: slot.endTime } : a; });
    candidate.sittings = generation.examSittings.map((s) => ({ id: s.id, eventId: s.examEventId, sequenceNumber: s.sequenceNumber, batchLabel: s.batchLabel ?? undefined, candidateCount: s.candidateCount, date: dateKey(s.date), startTime: s.startTime, endTime: s.endTime, venues: s.venues.map((v) => ({ venueId: v.venueId, allocatedCapacity: v.allocatedCapacity, allocatedCandidates: v.allocatedCandidates })), staff: s.staff.map((p) => ({ staffId: p.staffId, assignmentType: p.assignmentType, venueId: p.venueId ?? undefined })) }));
    const validation = validateCompleteAggregateTimetable(candidate, dataset);
    const schedules = generation.aggregateSchedules.map((schedule) => ({ ...schedule, timeSlot: schedule.timeSlot ?? (schedule.date && schedule.startTime && schedule.endTime ? { date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime } : null), candidateCount: dataset.events.find((event) => event.id === schedule.eventId)?.candidateCount ?? 0, eventSummary: dataset.events.find((event) => event.id === schedule.eventId) ?? schedule.event }));
    return { generation: { ...generation, schedules, aggregateSchedules: schedules }, candidate, validation, mode: "AGGREGATE_EVENT" as const, sittings: generation.examSittings, resources: { timeSlots: dataset.timeSlots, venues: dataset.venues, invigilators: dataset.invigilators } };
  }
  const dataset = await buildSchedulingDataset(generation.sessionId, generation.semesterId, generation.periodId);
  const candidate = asCandidate(generation); const graph = buildConflictGraph(dataset); const candidateCounts = new Map<string, number>(); for (const registration of dataset.registrations) candidateCounts.set(registration.courseId, (candidateCounts.get(registration.courseId) ?? 0) + 1);
  const schedules = generation.schedules.map((schedule) => ({ ...schedule, candidateCount: candidateCounts.get(schedule.courseId) ?? 0, conflicts: graph.getConflictingCourses(schedule.courseId).slice(0, 5).map((edge) => ({ courseId: edge.courseAId === schedule.courseId ? edge.courseBId : edge.courseAId, sharedStudentCount: edge.sharedStudentCount })) }));
  return { generation: { ...generation, schedules }, candidate, validation: validateTimetable(candidate, dataset), resources: { timeSlots: dataset.timeSlots, venues: dataset.venues, invigilators: dataset.invigilators } };
}

/** Return only the information needed to resolve simultaneous exams sharing a hall. */
export async function getGenerationHallCollisions(generationId: string) {
  const generation = await prisma.timetableGeneration.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      period: { select: { name: true } },
      reviewStatus: true,
      status: true,
      generatedAt: true,
      generationMode: true,
      schedules: {
        select: {
          id: true,
          course: { select: { code: true } },
          timeSlot: { select: { date: true, startTime: true, endTime: true } },
          venues: { select: { venueId: true } },
        },
      },
      aggregateSchedules: {
        select: {
          id: true,
          event: { select: { title: true } },
          timeSlot: { select: { date: true, startTime: true, endTime: true } },
          date: true,
          startTime: true,
          endTime: true,
          venues: { select: { venueId: true } },
        },
      },
    },
  });
  if (!generation) throw new AcademicError("NOT_FOUND", "The timetable generation was not found.", {}, 404);

  const rows: Array<{ id: string; code: string; timeSlot: { date: Date | string; startTime: string; endTime: string }; venues: { venueId: string }[] }> = generation.generationMode === "AGGREGATE_EVENT"
    ? generation.aggregateSchedules.flatMap((schedule) => { const timeSlot = schedule.date && schedule.startTime && schedule.endTime ? { date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime } : schedule.timeSlot; return timeSlot ? [{ id: schedule.id, code: schedule.event.title, timeSlot, venues: schedule.venues }] : []; })
    : generation.schedules.flatMap((schedule) => schedule.timeSlot ? [{ id: schedule.id, code: schedule.course.code, timeSlot: schedule.timeSlot, venues: schedule.venues }] : []);
  const collisions: HallCollision[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const first = rows[i];
    for (let j = i + 1; j < rows.length; j += 1) {
      const second = rows[j];
      if (generation.generationMode === "AGGREGATE_EVENT") continue;
      if (!slotsOverlap(first.timeSlot, second.timeSlot)) continue;
      if (!first.venues.some((venue) => second.venues.some((other) => venue.venueId === other.venueId))) continue;
      collisions.push({
        scheduleIds: [first.id, second.id],
        courseCodes: [first.code, second.code],
        date: dateKey(first.timeSlot.date),
        startTime: first.timeSlot.startTime > second.timeSlot.startTime ? first.timeSlot.startTime : second.timeSlot.startTime,
        endTime: first.timeSlot.endTime < second.timeSlot.endTime ? first.timeSlot.endTime : second.timeSlot.endTime,
      });
    }
  }

  return {
    generation: { id: generation.id, periodName: generation.period.name, reviewStatus: generation.reviewStatus, status: generation.status, generationMode: generation.generationMode, generatedAt: generation.generatedAt },
    collisions,
  };
}

export async function applyTimetableEdit(input: EditInput, actorId: string) {
  const { generation, schedule } = await loadEditableGeneration(input.generationId, input.scheduleId);
  if (generation.generationMode === "AGGREGATE_EVENT") throw new AcademicError("TIMETABLE_NOT_EDITABLE", "Aggregate event generations are fixed outputs; manual editing is not enabled in this phase.", {}, 409);
  if (!schedule) throw new AcademicError("NOT_FOUND", "The examination schedule was not found.", {}, 404);
  if (input.operation === "MOVE_EXAM" && !input.targetTimeSlotId) throw new AcademicError("VALIDATION_ERROR", "A target time slot is required.", {}, 400);
  if (input.operation === "REASSIGN_VENUES" && (!input.venueIds?.length || new Set(input.venueIds).size !== input.venueIds.length)) throw new AcademicError("VALIDATION_ERROR", "Provide one or more unique venues.", {}, 400);
  if (input.operation === "REASSIGN_INVIGILATORS" && (!input.invigilatorIds?.length || new Set(input.invigilatorIds).size !== input.invigilatorIds.length)) throw new AcademicError("VALIDATION_ERROR", "Provide one or more unique invigilators.", {}, 400);
  const dataset = await buildSchedulingDataset(generation.sessionId, generation.semesterId, generation.periodId);
  const before = { timeSlotId: schedule.timeSlotId, venues: schedule.venues.map((venue) => ({ venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity })), invigilators: schedule.invigilators.map((invigilator) => ({ invigilatorId: invigilator.invigilatorId, venueId: invigilator.venueId })) };
  const candidate = asCandidate(generation); const assignment = candidate.assignments.find((item) => item.courseId === schedule.courseId); if (!assignment) throw new AcademicError("NOT_FOUND", "The schedule assignment could not be reconstructed.", {}, 404);
  if (input.operation === "MOVE_EXAM") assignment.timeSlotId = input.targetTimeSlotId!;
  if (input.operation === "REASSIGN_VENUES") { const venues = dataset.venues.filter((venue) => input.venueIds!.includes(venue.id)); if (venues.length !== input.venueIds!.length) throw new AcademicError("NOT_FOUND", "One or more venues were not found or are inactive.", {}, 404); assignment.venues = venues.map((venue) => ({ venueId: venue.id, allocatedCapacity: venue.capacity })); }
  if (input.operation === "REASSIGN_INVIGILATORS") { const invigilators = dataset.invigilators.filter((invigilator) => input.invigilatorIds!.includes(invigilator.id)); if (invigilators.length !== input.invigilatorIds!.length) throw new AcademicError("NOT_FOUND", "One or more invigilators were not found or are inactive.", {}, 404); assignment.invigilators = invigilators.map((invigilator, index) => ({ invigilatorId: invigilator.id, venueId: assignment.venues[index % Math.max(1, assignment.venues.length)]?.venueId })); }
  const validation = validateTimetable(candidate, dataset); if (!validation.valid) throw new AcademicError("TIMETABLE_INVALID", "This change introduces one or more hard constraint violations.", { violations: validation.violations }, 409);
  const score = scoreTimetable(candidate, dataset, resolveEngineConfig({ seed: generation.seed ?? 0, maxGenerationAttempts: 1 }));
  const after = { timeSlotId: assignment.timeSlotId, venues: assignment.venues, invigilators: assignment.invigilators }; const action = input.operation === "MOVE_EXAM" ? "EXAM_MOVED" : input.operation === "REASSIGN_VENUES" ? "EXAM_VENUE_CHANGED" : "EXAM_INVIGILATOR_CHANGED";
  const saved = await prisma.$transaction(async (db) => { await db.examSchedule.update({ where: { id: schedule.id }, data: { timeSlotId: assignment.timeSlotId } }); if (input.operation === "REASSIGN_VENUES") { await db.examVenueAssignment.deleteMany({ where: { examScheduleId: schedule.id } }); await db.examVenueAssignment.createMany({ data: assignment.venues.map((venue) => ({ examScheduleId: schedule.id, venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity })) }); } if (input.operation === "REASSIGN_INVIGILATORS") { await db.invigilationAssignment.deleteMany({ where: { examScheduleId: schedule.id } }); await db.invigilationAssignment.createMany({ data: assignment.invigilators.map((invigilator) => ({ examScheduleId: schedule.id, invigilatorId: invigilator.invigilatorId, venueId: invigilator.venueId ?? null })) }); } const metadata = generation.metadata && typeof generation.metadata === "object" && !Array.isArray(generation.metadata) ? generation.metadata as Record<string, unknown> : {}; const updated = await db.timetableGeneration.update({ where: { id: generation.id }, data: { revision: { increment: 1 }, score: score.penalty, metadata: { ...metadata, metrics: score.metrics, hardViolations: validation.violations } as Prisma.InputJsonValue } }); await db.auditLog.create({ data: { actorId, action, entity: "ExamSchedule", entityId: schedule.id, metadata: { generationId: generation.id, before, after, reason: input.reason ?? null, score: score.penalty } as Prisma.InputJsonValue } }); return updated; });
  return { generation: saved, validation, score, before, after };
}

export async function transitionGeneration(generationId: string, target: "UNDER_REVIEW" | "APPROVED", actorId: string) {
  const { generation } = await loadEditableGeneration(generationId);
  if (target === "UNDER_REVIEW" && generation.reviewStatus !== "DRAFT") throw new AcademicError("WORKFLOW_TRANSITION_INVALID", "Only draft generations can move to review.", {}, 409);
  if (target === "APPROVED") {
    if (generation.reviewStatus !== "UNDER_REVIEW") throw new AcademicError("WORKFLOW_TRANSITION_INVALID", "Only generations under review can be approved.", {}, 409);
    const detail = await getGenerationDetail(generationId);
    const aggregate = detail.generation.generationMode === "AGGREGATE_EVENT";
    const detailAny = detail as any;
    const unscheduled = aggregate ? detailAny.candidate.unscheduledEvents : detailAny.candidate.unscheduledCourses;
    if (!detailAny.validation.valid || unscheduled.length) throw new AcademicError("APPROVAL_BLOCKED", "Only fully valid timetables with no unscheduled examinations can be approved.", { violations: detailAny.validation.violations, unscheduled }, 409);
  }
  return prisma.$transaction(async (db) => { const updated = await db.timetableGeneration.update({ where: { id: generationId }, data: target === "APPROVED" ? { reviewStatus: target, approvedAt: new Date(), approvedBy: actorId } : { reviewStatus: target } }); await db.auditLog.create({ data: { actorId, action: target === "APPROVED" ? "TIMETABLE_APPROVED" : "TIMETABLE_SUBMITTED_FOR_REVIEW", entity: "TimetableGeneration", entityId: generationId } }); return updated; });
}

export async function compareGenerations(firstId: string, secondId: string) {
  const [first, second] = await Promise.all([getGenerationDetail(firstId), getGenerationDetail(secondId)]);
  if (first.generation.sessionId !== second.generation.sessionId || first.generation.semesterId !== second.generation.semesterId || first.generation.periodId !== second.generation.periodId) throw new AcademicError("VALIDATION_ERROR", "Only generations for the same academic period can be compared.", {}, 400);
  if (first.generation.generationMode !== second.generation.generationMode) throw new AcademicError("VALIDATION_ERROR", "Only generations using the same generation mode can be compared.", {}, 400);
  const aggregate = first.generation.generationMode === "AGGREGATE_EVENT";
  const firstAny = first as any; const secondAny = second as any;
  const firstByItem = new Map(firstAny.candidate.assignments.map((assignment: any) => [aggregate ? assignment.eventId : assignment.courseId, assignment]));
  const secondByItem = new Map(secondAny.candidate.assignments.map((assignment: any) => [aggregate ? assignment.eventId : assignment.courseId, assignment]));
  const movedCourses: string[] = []; const venueChanges: string[] = []; const invigilatorChanges: string[] = [];
  for (const itemId of new Set<string>([...firstByItem.keys(), ...secondByItem.keys()] as string[])) { const a: any = firstByItem.get(itemId); const b: any = secondByItem.get(itemId); if (a?.timeSlotId !== b?.timeSlotId) movedCourses.push(itemId); if (JSON.stringify(a?.venues) !== JSON.stringify(b?.venues)) venueChanges.push(itemId); if (JSON.stringify(a?.invigilators) !== JSON.stringify(b?.invigilators)) invigilatorChanges.push(itemId); }
  const rank = (candidate: any) => [candidate.hardViolations.length, aggregate ? candidate.unscheduledEvents.length : candidate.unscheduledCourses.length, candidate.softScore]; const firstRank = rank(firstAny.candidate); const secondRank = rank(secondAny.candidate); const recommendation = firstRank[0] !== secondRank[0] ? (firstRank[0] < secondRank[0] ? "FIRST" : "SECOND") : firstRank[1] !== secondRank[1] ? (firstRank[1] < secondRank[1] ? "FIRST" : "SECOND") : firstRank[2] < secondRank[2] ? "FIRST" : secondRank[2] < firstRank[2] ? "SECOND" : "TIE";
  return { first: { generation: first.generation, metrics: first.candidate.metrics, validation: first.validation }, second: { generation: second.generation, metrics: second.candidate.metrics, validation: second.validation }, changes: { movedCourses, venueChanges, invigilatorChanges }, recommendation };
}
