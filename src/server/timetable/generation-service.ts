import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { generateTimetable, resolveEngineConfig, validateGenerationReadiness, validateTimetable, type CandidateTimetable, type GenerationReadiness } from "@/domain/timetable";
import type { GenerationRequest } from "./schemas";
import { buildSchedulingDataset } from "./dataset-builder";

export const TIMETABLE_ENGINE_VERSION = "1.0.0";

export async function getGenerationReadiness(input: GenerationRequest): Promise<GenerationReadiness> {
  const dataset = await buildSchedulingDataset(input.academicSessionId, input.semesterId, input.examPeriodId);
  return validateGenerationReadiness(dataset);
}

export async function generateAndPersistTimetable(input: GenerationRequest, actorId: string) {
  const existing = await prisma.timetableGeneration.findFirst({ where: { sessionId: input.academicSessionId, semesterId: input.semesterId, periodId: input.examPeriodId, status: "RUNNING" }, select: { id: true } });
  if (existing) throw new AcademicError("GENERATION_ALREADY_RUNNING", "A timetable generation is already running for this academic period.", { generationId: existing.id }, 409);
  const dataset = await buildSchedulingDataset(input.academicSessionId, input.semesterId, input.examPeriodId);
  const readiness = validateGenerationReadiness(dataset);
  const engineConfig = resolveEngineConfig({ maxGenerationAttempts: input.attempts, seed: input.seed });
  let generation;
  try { generation = await prisma.timetableGeneration.create({ data: { sessionId: input.academicSessionId, semesterId: input.semesterId, periodId: input.examPeriodId, generatedBy: actorId, status: readiness.ready ? "RUNNING" : "FAILED", lockKey: readiness.ready ? `${input.academicSessionId}|${input.semesterId}|${input.examPeriodId}` : null, engineVersion: TIMETABLE_ENGINE_VERSION, seed: engineConfig.seed, attemptCount: engineConfig.maxGenerationAttempts, metadata: { engineVersion: TIMETABLE_ENGINE_VERSION, configuration: engineConfig, readiness } as Prisma.InputJsonValue } }); } catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new AcademicError("GENERATION_ALREADY_RUNNING", "A timetable generation is already running for this academic period.", {}, 409); throw error; }
  if (!readiness.ready) { await prisma.auditLog.create({ data: { actorId, action: "TIMETABLE_GENERATION_BLOCKED", entity: "TimetableGeneration", entityId: generation.id, metadata: { blockers: readiness.blockers } as Prisma.InputJsonValue } }); return { generation, readiness, candidate: null, validation: null }; }
  try {
    const candidate = generateTimetable(dataset, engineConfig);
    const validation = validateTimetable(candidate, dataset);
    const status = validation.valid && candidate.unscheduledCourses.length === 0 ? "COMPLETED" : "COMPLETED_WITH_WARNINGS";
    const saved = await prisma.$transaction(async (db) => {
      for (const assignment of candidate.assignments) {
        const schedule = await db.examSchedule.create({ data: { generationId: generation.id, courseId: assignment.courseId, timeSlotId: assignment.timeSlotId, status: "GENERATED", generatedBy: actorId } });
        if (assignment.venues.length) await db.examVenueAssignment.createMany({ data: assignment.venues.map((venue) => ({ examScheduleId: schedule.id, venueId: venue.venueId, allocatedCapacity: venue.allocatedCapacity })) });
        if (assignment.invigilators.length) await db.invigilationAssignment.createMany({ data: assignment.invigilators.map((invigilator) => ({ examScheduleId: schedule.id, invigilatorId: invigilator.invigilatorId, venueId: invigilator.venueId ?? null })) });
      }
      const saved = await db.timetableGeneration.update({ where: { id: generation.id }, data: { status, lockKey: null, score: candidate.softScore, metadata: { engineVersion: TIMETABLE_ENGINE_VERSION, configuration: engineConfig, readiness, metrics: candidate.metrics, unscheduledCourses: candidate.unscheduledCourses, hardViolations: validation.violations } as Prisma.InputJsonValue } });
      await db.auditLog.create({ data: { actorId, action: "TIMETABLE_GENERATION_COMPLETED", entity: "TimetableGeneration", entityId: generation.id, metadata: { status, score: candidate.softScore, scheduledCourses: candidate.metrics.scheduledCourses, unscheduledCourses: candidate.metrics.unscheduledCourses } } });
      return saved;
    });
    return { generation: saved, readiness, candidate, validation };
  } catch (error) {
    const failed = await prisma.$transaction(async (db) => { const updated = await db.timetableGeneration.update({ where: { id: generation.id }, data: { status: "FAILED", lockKey: null, metadata: { engineVersion: TIMETABLE_ENGINE_VERSION, error: error instanceof Error ? error.message : "Generation failed" } } }); await db.auditLog.create({ data: { actorId, action: "TIMETABLE_GENERATION_FAILED", entity: "TimetableGeneration", entityId: generation.id, metadata: { error: error instanceof Error ? error.message : "Generation failed" } } }); return updated; });
    return { generation: failed, readiness, candidate: null, validation: null, error: "GENERATION_FAILED" as const };
  }
}

export async function listGenerationHistory(sessionId?: string, semesterId?: string, examPeriodId?: string) {
  return prisma.timetableGeneration.findMany({ where: { ...(sessionId ? { sessionId } : {}), ...(semesterId ? { semesterId } : {}), ...(examPeriodId ? { periodId: examPeriodId } : {}) }, include: { session: { select: { name: true } }, semester: { select: { name: true } }, period: { select: { name: true } }, generator: { select: { id: true, name: true } }, schedules: { select: { id: true } }, aggregateSchedules: { select: { id: true } } }, orderBy: { generatedAt: "desc" }, take: 100 });
}

export function candidateSummary(candidate: CandidateTimetable | null) { return candidate ? { assignments: candidate.assignments.length, unscheduledCourses: candidate.unscheduledCourses, hardViolations: candidate.hardViolations, softScore: candidate.softScore, metrics: candidate.metrics } : null; }
