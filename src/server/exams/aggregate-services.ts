import { Prisma, type CourseOfferingSource, type ExamEventSource, type ImportStatus } from "@prisma/client";

import { aggregateCourseOfferings, mergeCourseOfferings, validateExamEventMerge, type AggregateOptions, type CourseOffering as DomainCourseOffering, type DurationPolicy } from "@/domain/exams";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { courseOfferingToDomain, examEventToDomain, type PersistedCourseOffering, type PersistedExamEvent } from "./mappers";

type Db = Prisma.TransactionClient;
type Database = PrismaClientLike | Db;
type PrismaClientLike = typeof prisma;

const offeringInclude = {
  course: { include: { department: true } },
  programme: true,
} satisfies Prisma.CourseOfferingInclude;

const eventInclude = {
  offerings: { include: { courseOffering: { include: offeringInclude } } },
} satisfies Prisma.ExamEventInclude;

export type CourseOfferingFilters = {
  academicSessionId?: string;
  semesterId?: string;
  programmeId?: string;
  level?: number;
  courseId?: string;
  active?: boolean;
};

export type CourseOfferingInput = {
  academicSessionId: string;
  semesterId: string;
  courseId: string;
  programmeId: string;
  level: number;
  candidateCount: number;
  examModeOverride?: "PEN_ON_PAPER" | "CBT" | null;
  durationMinutesOverride?: number | null;
  active?: boolean;
  source?: CourseOfferingSource;
};

export type AggregatePreview = ReturnType<typeof aggregateCourseOfferings>;

function assertNonNegativeCount(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new AcademicError("INVALID_CANDIDATE_COUNT", "Candidate count must be a non-negative whole number.", { candidateCount: value }, 400);
}

function assertPositiveDuration(value: number | null | undefined) {
  if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) throw new AcademicError("INVALID_DURATION", "Duration must be a positive whole number of minutes.", { durationMinutes: value }, 400);
}

async function assertOfferingDependencies(db: Database, input: Pick<CourseOfferingInput, "academicSessionId" | "semesterId" | "courseId" | "programmeId" | "level">) {
  const [session, semester, course, programme, programmeCourse] = await Promise.all([
    db.academicSession.findUnique({ where: { id: input.academicSessionId } }),
    db.semester.findUnique({ where: { id: input.semesterId } }),
    db.course.findUnique({ where: { id: input.courseId } }),
    db.programme.findUnique({ where: { id: input.programmeId } }),
    db.programmeCourse.findUnique({ where: { programmeId_courseId: { programmeId: input.programmeId, courseId: input.courseId } } }),
  ]);
  if (!session || !semester || !course || !programme) throw new AcademicError("NOT_FOUND", "The session, semester, course, and programme must all exist.", {}, 404);
  if (semester.academicSessionId !== session.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The offering semester must belong to the selected academic session.", {}, 400);
  if (course.semesterId !== semester.id) throw new AcademicError("INVALID_COURSE_SEMESTER", "The offering course must belong to the selected semester.", {}, 400);
  if (!programmeCourse) throw new AcademicError("PROGRAMME_COURSE_REQUIRED", "The course must be assigned to the programme before creating an offering.", {}, 400);
  if (!programme.active || !course.active || !semester.active || !session.active) throw new AcademicError("INACTIVE_DEPENDENCY", "Offerings require active session, semester, course, and programme records.", {}, 409);
  if (!Number.isInteger(input.level) || input.level <= 0) throw new AcademicError("INVALID_LEVEL", "Level must be a positive whole number.", { level: input.level }, 400);
}

async function audit(db: Db, actorId: string | undefined, action: string, entity: string, entityId: string, metadata: Record<string, unknown> = {}) {
  if (!actorId) return;
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue } });
}

export async function listCourseOfferings(filters: CourseOfferingFilters = {}) {
  return prisma.courseOffering.findMany({
    where: filters,
    include: offeringInclude,
    orderBy: [{ semesterId: "asc" }, { course: { normalizedCode: "asc" } }, { programmeId: "asc" }, { level: "asc" }],
  });
}

export async function findCourseOfferingsBySessionSemester(academicSessionId: string, semesterId: string) {
  return listCourseOfferings({ academicSessionId, semesterId, active: true });
}

export async function createCourseOffering(input: CourseOfferingInput, actorId?: string) {
  assertNonNegativeCount(input.candidateCount);
  assertPositiveDuration(input.durationMinutesOverride);
  await assertOfferingDependencies(prisma, input);
  try {
    return await prisma.$transaction(async (db) => {
      const offering = await db.courseOffering.create({
        data: {
          academicSessionId: input.academicSessionId,
          semesterId: input.semesterId,
          courseId: input.courseId,
          programmeId: input.programmeId,
          level: input.level,
          candidateCount: input.candidateCount,
          examModeOverride: input.examModeOverride,
          durationMinutesOverride: input.durationMinutesOverride,
          active: input.active ?? true,
          source: input.source ?? "MANUAL",
        },
        include: offeringInclude,
      });
      await audit(db, actorId, "COURSE_OFFERING_CREATED", "CourseOffering", offering.id, { candidateCount: offering.candidateCount });
      return offering;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AcademicError("COURSE_OFFERING_EXISTS", "This logical course offering already exists for the selected session, semester, programme, level, and course.", {}, 409);
    throw error;
  }
}

export async function updateCourseOffering(id: string, input: Partial<Pick<CourseOfferingInput, "candidateCount" | "examModeOverride" | "durationMinutesOverride" | "active" | "source" | "level">>, actorId?: string) {
  if (input.candidateCount !== undefined) assertNonNegativeCount(input.candidateCount);
  assertPositiveDuration(input.durationMinutesOverride);
  const current = await prisma.courseOffering.findUnique({ where: { id } });
  if (!current) throw new AcademicError("COURSE_OFFERING_NOT_FOUND", "The course offering was not found.", {}, 404);
  if (input.level !== undefined) await assertOfferingDependencies(prisma, { academicSessionId: current.academicSessionId, semesterId: current.semesterId, courseId: current.courseId, programmeId: current.programmeId, level: input.level });
  try {
    return await prisma.$transaction(async (db) => {
      const offering = await db.courseOffering.update({ where: { id }, data: input, include: offeringInclude });
      await audit(db, actorId, "COURSE_OFFERING_UPDATED", "CourseOffering", id, { candidateCount: offering.candidateCount, active: offering.active });
      return offering;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AcademicError("COURSE_OFFERING_EXISTS", "That update would duplicate another logical course offering.", {}, 409);
    throw error;
  }
}

export async function setCourseOfferingActive(id: string, active: boolean, actorId?: string) {
  return updateCourseOffering(id, { active }, actorId);
}

function mapOfferings(records: PersistedCourseOffering[]): DomainCourseOffering[] {
  return records.map(courseOfferingToDomain);
}

function aggregateOptions(options: { durationPolicy?: DurationPolicy; defaultExamMode?: "PEN_ON_PAPER" | "CBT"; eventId?: string } = {}): AggregateOptions {
  return options;
}

export async function previewCourseOfferingAggregation(academicSessionId: string, semesterId: string, options: { durationPolicy?: DurationPolicy; defaultExamMode?: "PEN_ON_PAPER" | "CBT" } = {}): Promise<AggregatePreview> {
  const records = await findCourseOfferingsBySessionSemester(academicSessionId, semesterId);
  return aggregateCourseOfferings(mapOfferings(records), aggregateOptions(options));
}

async function getOfferingRecords(ids: string[]) {
  if (!ids.length) throw new AcademicError("EMPTY_SELECTION", "At least one course offering must be selected.", {}, 400);
  const records = await prisma.courseOffering.findMany({ where: { id: { in: ids }, active: true }, include: offeringInclude });
  if (records.length !== ids.length) throw new AcademicError("COURSE_OFFERING_NOT_FOUND", "One or more selected course offerings were not found or are inactive.", { ids }, 404);
  return records;
}

async function persistEvent(event: ReturnType<typeof mergeCourseOfferings>["event"], source: ExamEventSource, actorId: string | undefined, reason?: string) {
  if (!event) throw new AcademicError("INVALID_EXAM_EVENT", "The selected offerings could not form a compatible exam event.", {}, 400);
  return prisma.$transaction(async (db) => {
    const linked = await db.examEventOffering.count({ where: { courseOfferingId: { in: event.memberOfferings.map((o) => o.id) } } });
    if (linked) throw new AcademicError("EXAM_EVENT_LOCKED", "An offering already belongs to an examination event.", {}, 409);
    const examEvent = await db.examEvent.create({
      data: {
        academicSessionId: event.memberOfferings[0].sessionId,
        semesterId: event.memberOfferings[0].semesterId,
        title: event.title,
        examMode: event.examMode,
        durationMinutes: event.durationMinutes,
        source,
        manualMergeReason: reason,
        createdById: actorId,
        offerings: { create: event.memberOfferings.map((offering) => ({ courseOfferingId: offering.id })) },
      },
      include: eventInclude,
    });
    await audit(db, actorId, source === "MANUAL_MERGE" ? "EXAM_EVENT_MERGED" : "EXAM_EVENT_CREATED", "ExamEvent", examEvent.id, { offeringIds: event.memberOfferings.map((offering) => offering.id), candidateCount: event.candidateCount });
    return examEvent;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createExamEventFromOfferings(ids: string[], options: { durationPolicy?: DurationPolicy; defaultExamMode?: "PEN_ON_PAPER" | "CBT"; actorId?: string } = {}) {
  const records = await getOfferingRecords(ids);
  const validation = validateExamEventMerge(mapOfferings(records), aggregateOptions(options));
  if (!validation.valid) throw new AcademicError("INVALID_EXAM_EVENT", "The selected offerings are incompatible.", { diagnostics: validation.errors }, 400);
  const result = aggregateCourseOfferings(mapOfferings(records), aggregateOptions(options));
  if (result.events.length !== 1) throw new AcademicError("INVALID_EXAM_EVENT", "The selected offerings must belong to one compatible aggregation group.", { diagnostics: result.diagnostics }, 400);
  return persistEvent(result.events[0], "AUTO_AGGREGATED", options.actorId);
}

export async function manuallyMergeCourseOfferings(ids: string[], reason: string, options: { durationPolicy?: DurationPolicy; defaultExamMode?: "PEN_ON_PAPER" | "CBT"; actorId?: string } = {}) {
  const records = await getOfferingRecords(ids);
  const result = mergeCourseOfferings(mapOfferings(records), aggregateOptions(options));
  if (!result.event) throw new AcademicError("INVALID_EXAM_EVENT", "The selected offerings cannot be manually merged.", { diagnostics: result.validation.errors }, 400);
  return persistEvent(result.event, "MANUAL_MERGE", options.actorId, reason.trim() || undefined);
}

export async function attachOfferingToExamEvent(examEventId: string, courseOfferingId: string, actorId?: string) {
  return prisma.$transaction(async (db) => {
    const event = await db.examEvent.findUnique({ where: { id: examEventId }, include: eventInclude });
    const offering = await db.courseOffering.findUnique({ where: { id: courseOfferingId }, include: offeringInclude });
    if (!event || !offering) throw new AcademicError("NOT_FOUND", "The exam event or course offering was not found.", {}, 404);
    if (event.status !== "DRAFT" || !event.active) throw new AcademicError("EXAM_EVENT_LOCKED", "Only active draft exam events can be changed.", {}, 409);
    const members = [...event.offerings.map((membership) => courseOfferingToDomain(membership.courseOffering)), courseOfferingToDomain(offering)];
    const validation = validateExamEventMerge(members);
    if (!validation.valid) throw new AcademicError("INVALID_EXAM_EVENT", "The offering is incompatible with this exam event.", { diagnostics: validation.errors }, 400);
    const membership = await db.examEventOffering.create({ data: { examEventId, courseOfferingId } });
    await audit(db, actorId, "EXAM_EVENT_OFFERING_ATTACHED", "ExamEventOffering", `${examEventId}:${courseOfferingId}`, { examEventId, courseOfferingId });
    return membership;
  });
}

export async function detachOfferingFromExamEvent(examEventId: string, courseOfferingId: string, actorId?: string) {
  return prisma.$transaction(async (db) => {
    const event = await db.examEvent.findUnique({ where: { id: examEventId } });
    if (!event) throw new AcademicError("EXAM_EVENT_NOT_FOUND", "The exam event was not found.", {}, 404);
    if (event.status !== "DRAFT" || !event.active) throw new AcademicError("EXAM_EVENT_LOCKED", "Only active draft exam events can be changed.", {}, 409);
    const membership = await db.examEventOffering.findUnique({ where: { examEventId_courseOfferingId: { examEventId, courseOfferingId } } });
    if (!membership) throw new AcademicError("MEMBERSHIP_NOT_FOUND", "The offering is not attached to this exam event.", {}, 404);
    await db.examEventOffering.delete({ where: { id: membership.id } });
    await audit(db, actorId, "EXAM_EVENT_OFFERING_DETACHED", "ExamEventOffering", membership.id, { examEventId, courseOfferingId });
    return { id: membership.id };
  });
}

export async function getExamEvent(id: string) {
  const event = await prisma.examEvent.findUnique({ where: { id }, include: eventInclude });
  if (!event) throw new AcademicError("EXAM_EVENT_NOT_FOUND", "The exam event was not found.", {}, 404);
  return { record: event, domain: examEventToDomain(event) };
}

export async function getExamEventCandidateCount(id: string) {
  const memberships = await prisma.examEventOffering.findMany({ where: { examEventId: id }, include: { courseOffering: { select: { candidateCount: true } } } });
  return memberships.reduce((total, membership) => total + membership.courseOffering.candidateCount, 0);
}

export function normalizeConflictPair(courseAId: string, courseBId: string) {
  if (!courseAId || !courseBId || courseAId === courseBId) throw new AcademicError("INVALID_CONFLICT_PAIR", "An explicit conflict requires two different courses.", {}, 400);
  return courseAId < courseBId ? [courseAId, courseBId] as const : [courseBId, courseAId] as const;
}

export type ExplicitConflictInput = {
  academicSessionId: string;
  semesterId: string;
  courseAId: string;
  courseBId: string;
  severity: "HARD" | "SOFT";
  type: "CARRYOVER" | "ELECTIVE_OVERLAP" | "DEPARTMENT_RULE" | "MANUAL";
  estimatedSharedCandidates?: number;
  reason?: string;
  actorId?: string;
};

export async function createExplicitConflict(input: ExplicitConflictInput) {
  const [courseAId, courseBId] = normalizeConflictPair(input.courseAId, input.courseBId);
  if (input.estimatedSharedCandidates !== undefined) assertNonNegativeCount(input.estimatedSharedCandidates);
  const [session, semester, courseA, courseB] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: input.academicSessionId } }),
    prisma.semester.findUnique({ where: { id: input.semesterId } }),
    prisma.course.findUnique({ where: { id: courseAId } }),
    prisma.course.findUnique({ where: { id: courseBId } }),
  ]);
  if (!session || !semester || !courseA || !courseB) throw new AcademicError("NOT_FOUND", "The conflict session, semester, and courses must exist.", {}, 404);
  if (semester.academicSessionId !== session.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The conflict semester must belong to the selected session.", {}, 400);
  if (courseA.semesterId !== semester.id || courseB.semesterId !== semester.id) throw new AcademicError("INVALID_COURSE_SEMESTER", "Both conflict courses must belong to the selected semester.", {}, 400);
  try {
    return await prisma.$transaction(async (db) => {
      const conflict = await db.examConflict.create({ data: { academicSessionId: session.id, semesterId: semester.id, courseAId, courseBId, severity: input.severity, type: input.type, estimatedSharedCandidates: input.estimatedSharedCandidates, reason: input.reason?.trim() || null, createdById: input.actorId } });
      await audit(db, input.actorId, "EXAM_CONFLICT_CREATED", "ExamConflict", conflict.id, { courseAId, courseBId, severity: input.severity, type: input.type });
      return conflict;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AcademicError("EXAM_CONFLICT_EXISTS", "That course conflict already exists, including its reverse direction.", {}, 409);
    throw error;
  }
}

export async function listExplicitConflicts(academicSessionId: string, semesterId: string, active = true) {
  return prisma.examConflict.findMany({ where: { academicSessionId, semesterId, ...(active === undefined ? {} : { active }) }, include: { courseA: true, courseB: true }, orderBy: [{ courseAId: "asc" }, { courseBId: "asc" }] });
}

export async function setExplicitConflictActive(id: string, active: boolean, actorId?: string) {
  return prisma.$transaction(async (db) => {
    const conflict = await db.examConflict.update({ where: { id }, data: { active } });
    await audit(db, actorId, active ? "EXAM_CONFLICT_ACTIVATED" : "EXAM_CONFLICT_DEACTIVATED", "ExamConflict", id);
    return conflict;
  });
}

export type ExplicitConflictUpdate = Partial<Pick<ExplicitConflictInput, "severity" | "type" | "estimatedSharedCandidates" | "reason">>;

export async function updateExplicitConflict(id: string, input: ExplicitConflictUpdate, actorId?: string) {
  if (input.estimatedSharedCandidates !== undefined) assertNonNegativeCount(input.estimatedSharedCandidates);
  try {
    return await prisma.$transaction(async (db) => {
      const conflict = await db.examConflict.update({ where: { id }, data: { ...(input.severity === undefined ? {} : { severity: input.severity }), ...(input.type === undefined ? {} : { type: input.type }), ...(input.estimatedSharedCandidates === undefined ? {} : { estimatedSharedCandidates: input.estimatedSharedCandidates }), ...(input.reason === undefined ? {} : { reason: input.reason?.trim() || null }) } });
      await audit(db, actorId, "EXAM_CONFLICT_UPDATED", "ExamConflict", id, { severity: conflict.severity, type: conflict.type });
      return conflict;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new AcademicError("EXAM_CONFLICT_NOT_FOUND", "The explicit conflict was not found.", {}, 404);
    throw error;
  }
}

export type GenerationInputSnapshot = {
  schemaVersion: string;
  courseOfferings: unknown[];
  examEvents: unknown[];
  venues: unknown[];
  invigilators: unknown[];
  explicitConflicts: unknown[];
  policy?: unknown;
};

export async function createGenerationInputSnapshot(generationId: string, snapshot: GenerationInputSnapshot) {
  if (!snapshot.schemaVersion.trim()) throw new AcademicError("INVALID_SNAPSHOT", "A snapshot schema version is required.", {}, 400);
  const generation = await prisma.timetableGeneration.findUnique({ where: { id: generationId }, select: { inputSnapshot: true } });
  if (!generation) throw new AcademicError("GENERATION_NOT_FOUND", "The timetable generation was not found.", {}, 404);
  if (generation.inputSnapshot !== null) throw new AcademicError("SNAPSHOT_ALREADY_EXISTS", "Generation input snapshots are immutable once stored.", {}, 409);
  return prisma.timetableGeneration.update({ where: { id: generationId }, data: { inputSnapshot: snapshot as Prisma.InputJsonValue, snapshotSchemaVersion: snapshot.schemaVersion } });
}

export type CourseLoadImportInput = {
  fileName: string;
  academicSessionId: string;
  semesterId: string;
  uploadedBy: string;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateRows?: number;
  createdOfferings?: number;
  updatedOfferings?: number;
  status?: ImportStatus;
};

export async function createCourseLoadImport(input: CourseLoadImportInput) {
  return prisma.courseLoadImport.create({ data: { fileName: input.fileName, academicSessionId: input.academicSessionId, semesterId: input.semesterId, uploadedBy: input.uploadedBy, totalRows: input.totalRows ?? 0, validRows: input.validRows ?? 0, invalidRows: input.invalidRows ?? 0, duplicateRows: input.duplicateRows ?? 0, createdOfferings: input.createdOfferings ?? 0, updatedOfferings: input.updatedOfferings ?? 0, status: input.status ?? "PENDING" } });
}
