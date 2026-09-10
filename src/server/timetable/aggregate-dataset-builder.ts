import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { resolveAggregateGenerationConfig, type AggregateSchedulingDataset, type AggregateSchedulingMode } from "@/domain/timetable";
import { buildAggregateConflictDataset } from "@/server/exams/conflict-graph-service";

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }

export async function buildAggregateSchedulingDataset(sessionId: string, semesterId: string, examPeriodId: string, config: Parameters<typeof resolveAggregateGenerationConfig>[0] = {}, schedulingMode: AggregateSchedulingMode = "FIXED_SESSIONS"): Promise<AggregateSchedulingDataset> {
  const [session, semester, examPeriod] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: sessionId } }),
    prisma.semester.findUnique({ where: { id: semesterId } }),
    prisma.examPeriod.findUnique({ where: { id: examPeriodId }, include: { timeSlots: { orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }] }, calendarDays: { orderBy: [{ date: "asc" }, { id: "asc" }] } } }),
  ]);
  if (!session || !semester || !examPeriod) throw new AcademicError("NOT_FOUND", "The selected session, semester, or examination period was not found.", {}, 404);
  if (semester.academicSessionId !== session.id || examPeriod.sessionId !== session.id || examPeriod.semesterId !== semester.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The selected timetable resources do not belong to the same academic period.", {}, 400);
  const [conflictDataset, venues, invigilators] = await Promise.all([
    buildAggregateConflictDataset(sessionId, semesterId),
    prisma.venue.findMany({ where: { active: true }, orderBy: [{ capacity: "asc" }, { code: "asc" }] }),
    prisma.invigilator.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  const venueIds = venues.map((venue) => venue.id); const invigilatorIds = invigilators.map((item) => item.id);
  const [venueUnavailability, invigilatorUnavailability] = await Promise.all([
    prisma.venueUnavailablePeriod.findMany({ where: { venueId: { in: venueIds } } }),
    prisma.invigilatorUnavailablePeriod.findMany({ where: { invigilatorId: { in: invigilatorIds } } }),
  ]);
  return {
    session: { id: session.id, name: session.name, active: session.active },
    semester: { id: semester.id, sessionId: semester.academicSessionId, name: semester.name, active: semester.active },
    examPeriod: { id: examPeriod.id, sessionId: examPeriod.sessionId, semesterId: examPeriod.semesterId, name: examPeriod.name, startDate: isoDate(examPeriod.startDate), endDate: isoDate(examPeriod.endDate), active: examPeriod.active },
    events: conflictDataset.events.map((event) => ({ id: event.id, title: event.title, memberCourseCodes: event.courseCodes, candidateCount: event.candidateCount, cohortKeys: event.cohortKeys, examMode: event.examMode, durationMinutes: event.durationMinutes, source: event.source, members: event.memberOfferings.map((o) => ({ programmeId: o.programmeId, programmeName: o.programmeName ?? o.programmeId, level: o.level, courseCode: o.courseCode, courseTitle: o.courseTitle })), offeringIds: event.memberOfferings.map((offering) => offering.id) })),
    timeSlots: examPeriod.timeSlots.map((slot) => ({ id: slot.id, examPeriodId: slot.examPeriodId, date: isoDate(slot.date), startTime: slot.startTime, endTime: slot.endTime })),
    calendarDays: examPeriod.calendarDays.map((day) => ({ id: day.id, examPeriodId: day.examPeriodId, date: isoDate(day.date), enabled: day.enabled, dayType: day.dayType, startTime: day.startTime, endTime: day.endTime, turnaroundMinutesOverride: day.turnaroundMinutesOverride, blackoutType: day.blackoutType, reason: day.reason })),
    timePolicy: { defaultDayStartTime: examPeriod.defaultDayStartTime, defaultDayEndTime: examPeriod.defaultDayEndTime, defaultTurnaroundMinutes: examPeriod.defaultTurnaroundMinutes, writtenTurnaroundMinutes: examPeriod.writtenTurnaroundMinutes, cbtTurnaroundMinutes: examPeriod.cbtTurnaroundMinutes, timeGranularityMinutes: examPeriod.timeGranularityMinutes },
    cbtBatchingPolicy: { enabled: examPeriod.cbtBatchingEnabled, minimumBatchGapMinutes: examPeriod.cbtMinimumBatchGapMinutes, maxBatchesPerDay: examPeriod.cbtMaxBatchesPerDay, requireSameDay: examPeriod.cbtRequireSameDay, allowMultiDay: examPeriod.cbtAllowMultiDay, preferMaximumCapacityPerBatch: examPeriod.cbtPreferMaximumCapacityPerBatch },
    cbtStaffingPolicy: { minimumInvigilatorsPerVenue: examPeriod.cbtMinimumInvigilatorsPerVenue, minimumTechnicalSupportPerVenue: examPeriod.cbtMinimumTechnicalSupportPerVenue, additionalSupportPerCandidates: examPeriod.cbtAdditionalSupportPerCandidates },
    schedulingMode,
    conflictGraph: conflictDataset.graph,
    venues: venues.map((venue) => ({ id: venue.id, code: venue.code, name: venue.name, capacity: venue.capacity, examCapacity: venue.examCapacity, computerCapacity: venue.computerCapacity, usableComputerCapacity: venue.usableComputerCapacity, capability: venue.capability, venueGroup: venue.venueGroup, active: venue.active })),
    venueUnavailability: venueUnavailability.map((period) => ({ resourceId: period.venueId, date: isoDate(period.date), startTime: period.startTime, endTime: period.endTime, reason: period.reason })),
    invigilators: invigilators.map((item) => ({ id: item.id, staffId: item.staffId, name: item.name, active: item.active, maximumDailyAssignments: item.maximumDailyAssignments, maximumTotalAssignments: item.maximumTotalAssignments, role: item.role })),
    invigilatorUnavailability: invigilatorUnavailability.map((period) => ({ resourceId: period.invigilatorId, date: isoDate(period.date), startTime: period.startTime, endTime: period.endTime, reason: period.reason })),
    config: resolveAggregateGenerationConfig(config),
  };
}
