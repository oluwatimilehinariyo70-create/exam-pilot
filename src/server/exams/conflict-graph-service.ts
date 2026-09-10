import { Prisma } from "@prisma/client";

import { buildConflictGraph, type ExplicitEventConflict, type StudentEventOverlap, type ExamConflictGraph } from "@/domain/exams";
import { prisma } from "@/lib/prisma";
import { examEventToDomain, type PersistedExamEvent } from "./mappers";

const eventInclude = {
  offerings: {
    include: {
      courseOffering: {
        include: { course: { include: { department: true } }, programme: true },
      },
    },
  },
} satisfies Prisma.ExamEventInclude;

const conflictInclude = { courseA: true, courseB: true } satisfies Prisma.ExamConflictInclude;

export type ConflictGraphIssue = {
  code: "INVALID_EXPLICIT_CONFLICT" | "EXPLICIT_CONFLICT_WITHOUT_EVENT";
  conflictId: string;
  message: string;
};

export type AggregateConflictDataset = {
  academicSessionId: string;
  semesterId: string;
  events: ReturnType<typeof examEventToDomain>[];
  graph: ExamConflictGraph;
  explicitConflicts: Prisma.ExamConflictGetPayload<{ include: typeof conflictInclude }>[];
  studentPrecisionAvailable: boolean;
  registrationCount: number;
  issues: ConflictGraphIssue[];
};

function addStudentOverlap(overlaps: Map<string, StudentEventOverlap & { studentIds: Set<string> }>, studentId: string, eventAId: string, eventBId: string, courseAId: string, courseBId: string) {
  if (eventAId === eventBId) return;
  const [leftEvent, rightEvent] = eventAId < eventBId ? [eventAId, eventBId] : [eventBId, eventAId];
  const [leftCourse, rightCourse] = eventAId < eventBId ? [courseAId, courseBId] : [courseBId, courseAId];
  const key = `${leftEvent}|${rightEvent}`;
  const existing = overlaps.get(key);
  if (existing) {
    existing.studentIds.add(studentId);
    existing.sharedStudentCount = existing.studentIds.size;
  } else {
    overlaps.set(key, { eventAId: leftEvent, eventBId: rightEvent, courseAId: leftCourse, courseBId: rightCourse, sharedStudentCount: 1, studentIds: new Set([studentId]) });
  }
}

function buildStudentOverlaps(rows: { studentId: string; courseId: string }[], courseEventIds: Map<string, string[]>) {
  const byStudent = new Map<string, { courseId: string; eventId: string }[]>();
  for (const row of rows) {
    for (const eventId of courseEventIds.get(row.courseId) ?? []) byStudent.set(row.studentId, [...(byStudent.get(row.studentId) ?? []), { courseId: row.courseId, eventId }]);
  }
  const overlaps = new Map<string, StudentEventOverlap & { studentIds: Set<string> }>();
  for (const [studentId, registrations] of byStudent) {
    const unique = [...new Map(registrations.map((item) => [`${item.eventId}|${item.courseId}`, item])).values()];
    for (let leftIndex = 0; leftIndex < unique.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < unique.length; rightIndex += 1) {
        addStudentOverlap(overlaps, studentId, unique[leftIndex].eventId, unique[rightIndex].eventId, unique[leftIndex].courseId, unique[rightIndex].courseId);
      }
    }
  }
  return [...overlaps.values()].map(({ studentIds: _studentIds, ...overlap }) => overlap);
}

export async function buildAggregateConflictDataset(academicSessionId: string, semesterId: string, options: { includeStudentPrecision?: boolean } = {}): Promise<AggregateConflictDataset> {
  const events = await prisma.examEvent.findMany({ where: { academicSessionId, semesterId, active: true }, include: eventInclude, orderBy: { id: "asc" } });
  const explicitConflicts = await prisma.examConflict.findMany({ where: { academicSessionId, semesterId, active: true }, include: conflictInclude, orderBy: [{ courseAId: "asc" }, { courseBId: "asc" }] });
  const persistedEvents = events as PersistedExamEvent[];
  const domainEvents = persistedEvents.map(examEventToDomain);
  const eventCourseIds = new Map<string, string[]>();
  const courseEventIds = new Map<string, string[]>();
  for (const event of persistedEvents) {
    const courseIds = [...new Set(event.offerings.map((membership) => membership.courseOffering.courseId))];
    eventCourseIds.set(event.id, courseIds);
    for (const courseId of courseIds) courseEventIds.set(courseId, [...(courseEventIds.get(courseId) ?? []), event.id]);
  }

  const explicitEventConflicts: ExplicitEventConflict[] = [];
  const issues: ConflictGraphIssue[] = [];
  for (const conflict of explicitConflicts) {
    const eventsA = courseEventIds.get(conflict.courseAId) ?? [];
    const eventsB = courseEventIds.get(conflict.courseBId) ?? [];
    if (conflict.courseAId === conflict.courseBId || conflict.courseA.semesterId !== semesterId || conflict.courseB.semesterId !== semesterId) {
      issues.push({ code: "INVALID_EXPLICIT_CONFLICT", conflictId: conflict.id, message: "The explicit conflict courses do not belong to the selected semester or are identical." });
      continue;
    }
    if (!eventsA.length || !eventsB.length) {
      issues.push({ code: "EXPLICIT_CONFLICT_WITHOUT_EVENT", conflictId: conflict.id, message: "Both explicit-conflict courses must have a materialized exam event before the conflict can be applied." });
      continue;
    }
    for (const eventAId of eventsA) for (const eventBId of eventsB) if (eventAId !== eventBId) explicitEventConflicts.push({ id: conflict.id, eventAId, eventBId, hard: conflict.severity === "HARD", conflictType: conflict.type, courseAId: conflict.courseAId, courseBId: conflict.courseBId, estimatedSharedCandidates: conflict.estimatedSharedCandidates ?? undefined, reason: conflict.reason ?? undefined });
  }

  let registrationCount = 0;
  let studentOverlaps: StudentEventOverlap[] = [];
  if (options.includeStudentPrecision !== false && courseEventIds.size) {
    const rows = await prisma.courseRegistration.findMany({ where: { sessionId: academicSessionId, semesterId, courseId: { in: [...courseEventIds.keys()] } }, select: { studentId: true, courseId: true } });
    registrationCount = rows.length;
    studentOverlaps = buildStudentOverlaps(rows, courseEventIds);
  }
  const graph = buildConflictGraph(domainEvents, { explicitConflicts: explicitEventConflicts, studentOverlaps });
  return { academicSessionId, semesterId, events: domainEvents, graph, explicitConflicts, studentPrecisionAvailable: registrationCount > 0, registrationCount, issues };
}
