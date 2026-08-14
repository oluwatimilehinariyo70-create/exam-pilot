import { prisma } from "@/lib/prisma";
import type { SchedulingDataset } from "@/domain/timetable";
import { AcademicError } from "@/server/academic/errors";

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }

export async function buildSchedulingDataset(sessionId: string, semesterId: string, examPeriodId: string): Promise<SchedulingDataset> {
  const [session, semester, examPeriod] = await prisma.$transaction([
    prisma.academicSession.findUnique({ where: { id: sessionId } }),
    prisma.semester.findUnique({ where: { id: semesterId } }),
    prisma.examPeriod.findUnique({ where: { id: examPeriodId }, include: { timeSlots: { orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }] } } }),
  ]);
  if (!session || !semester || !examPeriod) throw new AcademicError("NOT_FOUND", "The selected session, semester, or examination period was not found.", {}, 404);
  if (semester.academicSessionId !== session.id || examPeriod.sessionId !== session.id || examPeriod.semesterId !== semester.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The selected timetable resources do not belong to the same academic period.", {}, 400);
  const courses = await prisma.course.findMany({ where: { semesterId, active: true }, select: { id: true, code: true, title: true, level: true, estimatedStudentCount: true, active: true } });
  const courseIds = courses.map((course) => course.id);
  const registrations = await prisma.courseRegistration.findMany({ where: { sessionId, semesterId, courseId: { in: courseIds } }, select: { studentId: true, courseId: true, sessionId: true, semesterId: true } });
  const studentIds = [...new Set(registrations.map((registration) => registration.studentId))];
  const activeVenues = await prisma.venue.findMany({ where: { active: true }, select: { id: true, code: true, name: true, capacity: true, active: true }, orderBy: [{ capacity: "asc" }, { code: "asc" }] });
  const activeVenueIds = activeVenues.map((venue) => venue.id);
  const [students, venueUnavailability, invigilators, invigilatorUnavailability] = await prisma.$transaction([
    prisma.student.findMany({ where: { id: { in: studentIds }, active: true }, select: { id: true, matricNumber: true, active: true } }),
    prisma.venueUnavailablePeriod.findMany({ where: { venueId: { in: activeVenueIds } } }),
    prisma.invigilator.findMany({ where: { active: true }, select: { id: true, staffId: true, name: true, active: true, maximumDailyAssignments: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.invigilatorUnavailablePeriod.findMany({ where: { invigilator: { active: true } } }),
  ]);
  const activeStudentIds = new Set(students.map((student) => student.id));
  return { session: { id: session.id, name: session.name, active: session.active }, semester: { id: semester.id, sessionId: semester.academicSessionId, name: semester.name, active: semester.active }, examPeriod: { id: examPeriod.id, sessionId: examPeriod.sessionId, semesterId: examPeriod.semesterId, name: examPeriod.name, startDate: isoDate(examPeriod.startDate), endDate: isoDate(examPeriod.endDate), active: examPeriod.active }, courses, students, registrations: registrations.filter((registration) => activeStudentIds.has(registration.studentId)), timeSlots: examPeriod.timeSlots.map((slot) => ({ id: slot.id, examPeriodId: slot.examPeriodId, date: isoDate(slot.date), startTime: slot.startTime, endTime: slot.endTime })), venues: activeVenues, venueUnavailability: venueUnavailability.map((period) => ({ resourceId: period.venueId, date: isoDate(period.date), startTime: period.startTime, endTime: period.endTime, reason: period.reason })), invigilators, invigilatorUnavailability: invigilatorUnavailability.map((period) => ({ resourceId: period.invigilatorId, date: isoDate(period.date), startTime: period.startTime, endTime: period.endTime, reason: period.reason })) };
}
