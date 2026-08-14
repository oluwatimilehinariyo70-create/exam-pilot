import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { buildSchedulingDataset } from "./dataset-builder";
import { scoreTimetable } from "@/domain/timetable/scoring/score";
import { resolveEngineConfig, validateTimetable, type CandidateTimetable, type TimetableMetrics } from "@/domain/timetable";
import { buildConflictGraph } from "@/domain/timetable/graph/conflict-graph";

type Operation = "MOVE_EXAM" | "REASSIGN_VENUES" | "REASSIGN_INVIGILATORS";
type EditInput = { generationId: string; scheduleId: string; operation: Operation; targetTimeSlotId?: string; venueIds?: string[]; invigilatorIds?: string[]; reason?: string };

function asCandidate(generation: { schedules: Array<{ courseId: string; timeSlotId: string; venues: Array<{ venueId: string; allocatedCapacity: number }>; invigilators: Array<{ invigilatorId: string; venueId: string | null }> }>; metadata: unknown; score: number | null }): CandidateTimetable {
  const metadata = (generation.metadata && typeof generation.metadata === "object" ? generation.metadata : {}) as Record<string, unknown>;
  const metrics = (metadata.metrics ?? {}) as TimetableMetrics;
  return { assignments: generation.schedules.map((schedule) => ({ courseId: schedule.courseId, timeSlotId: schedule.timeSlotId, venues: schedule.venues.map((venue) => ({ venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity })), invigilators: schedule.invigilators.map((invigilator) => ({ invigilatorId: invigilator.invigilatorId, venueId: invigilator.venueId ?? undefined })) })), unscheduledCourses: Array.isArray(metadata.unscheduledCourses) ? metadata.unscheduledCourses as CandidateTimetable["unscheduledCourses"] : [], hardViolations: Array.isArray(metadata.hardViolations) ? metadata.hardViolations as CandidateTimetable["hardViolations"] : [], softScore: generation.score ?? 0, metrics };
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
  const generation = await prisma.timetableGeneration.findUnique({ where: { id: generationId }, include: { session: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } }, period: { select: { id: true, name: true, startDate: true, endDate: true } }, generator: { select: { id: true, name: true, email: true } }, approver: { select: { id: true, name: true } }, schedules: { include: { course: { select: { id: true, code: true, title: true, department: { select: { name: true, code: true } } } }, timeSlot: true, venues: { include: { venue: true } }, invigilators: { include: { invigilator: { select: { id: true, name: true, staffId: true } } } } }, orderBy: [{ timeSlot: { date: "asc" } }, { timeSlot: { startTime: "asc" } }] }, } });
  if (!generation) throw new AcademicError("NOT_FOUND", "The timetable generation was not found.", {}, 404);
  const dataset = await buildSchedulingDataset(generation.sessionId, generation.semesterId, generation.periodId);
  const candidate = asCandidate(generation); const graph = buildConflictGraph(dataset); const candidateCounts = new Map<string, number>(); for (const registration of dataset.registrations) candidateCounts.set(registration.courseId, (candidateCounts.get(registration.courseId) ?? 0) + 1);
  const schedules = generation.schedules.map((schedule) => ({ ...schedule, candidateCount: candidateCounts.get(schedule.courseId) ?? 0, conflicts: graph.getConflictingCourses(schedule.courseId).slice(0, 5).map((edge) => ({ courseId: edge.courseAId === schedule.courseId ? edge.courseBId : edge.courseAId, sharedStudentCount: edge.sharedStudentCount })) }));
  return { generation: { ...generation, schedules }, candidate, validation: validateTimetable(candidate, dataset), resources: { timeSlots: dataset.timeSlots, venues: dataset.venues, invigilators: dataset.invigilators } };
}

export async function applyTimetableEdit(input: EditInput, actorId: string) {
  const { generation, schedule } = await loadEditableGeneration(input.generationId, input.scheduleId);
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
  if (target === "APPROVED") { if (generation.reviewStatus !== "UNDER_REVIEW") throw new AcademicError("WORKFLOW_TRANSITION_INVALID", "Only generations under review can be approved.", {}, 409); const detail = await getGenerationDetail(generationId); if (!detail.validation.valid || detail.candidate.unscheduledCourses.length) throw new AcademicError("APPROVAL_BLOCKED", "Only fully valid timetables with no unscheduled courses can be approved.", { violations: detail.validation.violations, unscheduledCourses: detail.candidate.unscheduledCourses }, 409); }
  return prisma.$transaction(async (db) => { const updated = await db.timetableGeneration.update({ where: { id: generationId }, data: target === "APPROVED" ? { reviewStatus: target, approvedAt: new Date(), approvedBy: actorId } : { reviewStatus: target } }); await db.auditLog.create({ data: { actorId, action: target === "APPROVED" ? "TIMETABLE_APPROVED" : "TIMETABLE_SUBMITTED_FOR_REVIEW", entity: "TimetableGeneration", entityId: generationId } }); return updated; });
}

export async function compareGenerations(firstId: string, secondId: string) {
  const [first, second] = await Promise.all([getGenerationDetail(firstId), getGenerationDetail(secondId)]);
  if (first.generation.sessionId !== second.generation.sessionId || first.generation.semesterId !== second.generation.semesterId || first.generation.periodId !== second.generation.periodId) throw new AcademicError("VALIDATION_ERROR", "Only generations for the same academic period can be compared.", {}, 400);
  const firstByCourse = new Map(first.candidate.assignments.map((assignment) => [assignment.courseId, assignment])); const secondByCourse = new Map(second.candidate.assignments.map((assignment) => [assignment.courseId, assignment])); const movedCourses: string[] = []; const venueChanges: string[] = []; const invigilatorChanges: string[] = [];
  for (const courseId of new Set([...firstByCourse.keys(), ...secondByCourse.keys()])) { const a = firstByCourse.get(courseId); const b = secondByCourse.get(courseId); if (a?.timeSlotId !== b?.timeSlotId) movedCourses.push(courseId); if (JSON.stringify(a?.venues) !== JSON.stringify(b?.venues)) venueChanges.push(courseId); if (JSON.stringify(a?.invigilators) !== JSON.stringify(b?.invigilators)) invigilatorChanges.push(courseId); }
  const rank = (candidate: CandidateTimetable) => [candidate.hardViolations.length, candidate.unscheduledCourses.length, candidate.softScore]; const firstRank = rank(first.candidate); const secondRank = rank(second.candidate); const recommendation = firstRank[0] !== secondRank[0] ? (firstRank[0] < secondRank[0] ? "FIRST" : "SECOND") : firstRank[1] !== secondRank[1] ? (firstRank[1] < secondRank[1] ? "FIRST" : "SECOND") : firstRank[2] < secondRank[2] ? "FIRST" : secondRank[2] < firstRank[2] ? "SECOND" : "TIE";
  return { first: { generation: first.generation, metrics: first.candidate.metrics, validation: first.validation }, second: { generation: second.generation, metrics: second.candidate.metrics, validation: second.validation }, changes: { movedCourses, venueChanges, invigilatorChanges }, recommendation };
}
