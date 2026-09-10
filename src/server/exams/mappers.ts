import type { CourseOffering as DomainCourseOffering, ExamEvent as DomainExamEvent } from "@/domain/exams";
import { canonicalCourseCodeKey, createCohortKey } from "@/domain/exams";
import type { Prisma } from "@prisma/client";

export type PersistedCourseOffering = Prisma.CourseOfferingGetPayload<{
  include: {
    course: { include: { department: true } };
    programme: true;
  };
}>;

export type PersistedExamEvent = Prisma.ExamEventGetPayload<{
  include: {
    offerings: {
      include: {
        courseOffering: {
          include: {
            course: { include: { department: true } };
            programme: true;
          };
        };
      };
    };
  };
}>;

export function courseOfferingToDomain(record: PersistedCourseOffering): DomainCourseOffering {
  return {
    id: record.id,
    sessionId: record.academicSessionId,
    semesterId: record.semesterId,
    courseId: record.courseId,
    courseCode: record.course.code,
    courseTitle: record.course.title,
    programmeId: record.programmeId,
    programmeName: record.programme.name,
    departmentId: record.course.departmentId,
    level: record.level,
    candidateCount: record.candidateCount,
    creditUnits: record.course.creditUnits,
    examMode: record.examModeOverride ?? record.course.defaultExamMode ?? undefined,
    durationMinutes: record.durationMinutesOverride ?? record.course.defaultDurationMinutes ?? undefined,
  };
}

export function examEventToDomain(record: PersistedExamEvent): DomainExamEvent {
  const memberOfferings = record.offerings.map((membership) => courseOfferingToDomain(membership.courseOffering));
  return {
    id: record.id,
    memberOfferings,
    courseCodes: [...new Set(memberOfferings.map((offering) => offering.courseCode))],
    canonicalCourseKeys: [...new Set(memberOfferings.map((offering) => canonicalCourseCodeKey(offering.courseCode)))].sort(),
    title: record.title,
    candidateCount: memberOfferings.reduce((total, offering) => total + offering.candidateCount, 0),
    cohortKeys: [...new Set(memberOfferings.map((offering) => createCohortKey(offering.programmeId, offering.level)))].sort(),
    examMode: record.examMode,
    durationMinutes: record.durationMinutes,
    source: record.source,
    mergeMetadata: record.manualMergeReason ? { reason: record.manualMergeReason, mergedBy: record.createdById ?? undefined } : undefined,
  };
}
