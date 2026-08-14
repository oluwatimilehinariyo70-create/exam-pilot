import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { activeWhere, courseCodeKey, dateValue, normalizeCourseCode, normalizeMatricNumber, timeToMinutes, type AvailabilityInput, type CourseInput, type InvigilatorInput, type RegistrationInput, type StudentInput, type VenueInput } from "@/server/resources/schemas";

type Db = Prisma.TransactionClient;
type Database = PrismaClient | Db;
type ListQuery = { q?: string; active: "true" | "false" | "all"; collegeId?: string; departmentId?: string; programmeId?: string; semesterId?: string; sessionId?: string; courseId?: string; studentId?: string; level?: number; page: number; pageSize: number };

async function audit(db: Db, actorId: string, action: string, entity: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue } });
}

function page<T>(rows: T[], total: number, query: ListQuery) { return { rows, total, page: query.page, pageSize: query.pageSize, pageCount: Math.max(1, Math.ceil(total / query.pageSize)) }; }

export async function listCourses(query: ListQuery) {
  const where = { ...activeWhere(query.active), ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.semesterId ? { semesterId: query.semesterId } : {}), ...(query.programmeId ? { programmes: { some: { programmeId: query.programmeId } } } : {}), ...(query.collegeId ? { department: { collegeId: query.collegeId } } : {}), ...(query.level ? { level: query.level } : {}), ...(query.q ? { OR: [{ code: { contains: query.q, mode: "insensitive" as const } }, { title: { contains: query.q, mode: "insensitive" as const } }] } : {}) };
  const [rows, total] = await prisma.$transaction([prisma.course.findMany({ where, include: { department: { select: { id: true, name: true, code: true, college: { select: { id: true, name: true, code: true } } }, }, semester: { select: { id: true, name: true, semesterNumber: true, academicSession: { select: { id: true, name: true } } } }, _count: { select: { registrations: true, programmes: true } } }, orderBy: [{ level: "asc" }, { normalizedCode: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.course.count({ where })]);
  return page(rows, total, query);
}

export async function getCourse(id: string) {
  const course = await prisma.course.findUnique({ where: { id }, include: { department: { include: { college: true } }, semester: { include: { academicSession: true } }, programmes: { include: { programme: { select: { id: true, name: true, code: true } } } }, registrations: { include: { student: { include: { programme: { select: { id: true, name: true, code: true } } } } }, orderBy: { student: { matricNumber: "asc" } } } } });
  if (!course) throw new AcademicError("COURSE_NOT_FOUND", "The course was not found.", {}, 404);
  return course;
}

async function assertCourseDependencies(db: Database, input: CourseInput) {
  const [department, semester] = await Promise.all([db.department.findUnique({ where: { id: input.departmentId } }), db.semester.findUnique({ where: { id: input.semesterId }, include: { academicSession: true } })]);
  if (!department) throw new AcademicError("NOT_FOUND", "Select an existing department.", {}, 404);
  if (!semester) throw new AcademicError("NOT_FOUND", "Select an existing semester.", {}, 404);
  if (!department.active || !semester.active) throw new AcademicError("DATABASE_ERROR", "Courses can only use active departments and semesters.", {}, 409);
  const programmes = input.programmeIds.length ? await db.programme.findMany({ where: { id: { in: input.programmeIds }, active: true } }) : [];
  if (programmes.length !== input.programmeIds.length) throw new AcademicError("NOT_FOUND", "One or more selected programmes were not found or are inactive.", {}, 404);
}

export async function createCourse(input: CourseInput, actorId: string) {
  await assertCourseDependencies(prisma, input);
  const normalizedCode = courseCodeKey(input.code);
  try { return await prisma.$transaction(async (db) => { const course = await db.course.create({ data: { code: normalizeCourseCode(input.code), normalizedCode, title: input.title, creditUnits: input.creditUnits, level: input.level, departmentId: input.departmentId, semesterId: input.semesterId, estimatedStudentCount: input.estimatedStudentCount, active: input.active } }); if (input.programmeIds.length) await db.programmeCourse.createMany({ data: input.programmeIds.map((programmeId) => ({ programmeId, courseId: course.id })), skipDuplicates: true }); await audit(db, actorId, "COURSE_CREATED", "Course", course.id, { code: course.code, semesterId: course.semesterId }); return course; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("COURSE_CODE_EXISTS", "This course code already exists for the selected semester.", { code: input.code }, 409); throw error; }
}

export async function updateCourse(id: string, input: CourseInput, actorId: string) {
  await assertCourseDependencies(prisma, input);
  try { return await prisma.$transaction(async (db) => { const course = await db.course.update({ where: { id }, data: { code: normalizeCourseCode(input.code), normalizedCode: courseCodeKey(input.code), title: input.title, creditUnits: input.creditUnits, level: input.level, departmentId: input.departmentId, semesterId: input.semesterId, estimatedStudentCount: input.estimatedStudentCount, active: input.active } }); await db.programmeCourse.deleteMany({ where: { courseId: id } }); if (input.programmeIds.length) await db.programmeCourse.createMany({ data: input.programmeIds.map((programmeId) => ({ programmeId, courseId: id })), skipDuplicates: true }); await audit(db, actorId, "COURSE_UPDATED", "Course", id, { code: course.code, active: course.active }); return course; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("COURSE_CODE_EXISTS", "This course code already exists for the selected semester.", {}, 409); throw error; }
}

export async function listStudents(query: ListQuery) {
  const where = { ...activeWhere(query.active), ...(query.programmeId || query.departmentId || query.collegeId ? { programme: { ...(query.programmeId ? { id: query.programmeId } : {}), ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.collegeId ? { department: { collegeId: query.collegeId } } : {}) } } : {}), ...(query.level ? { level: query.level } : {}), ...(query.q ? { OR: [{ matricNumber: { contains: query.q, mode: "insensitive" as const } }, { name: { contains: query.q, mode: "insensitive" as const } }] } : {}) };
  const [rows, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      include: {
        programme: { include: { department: { select: { id: true, name: true, code: true, college: { select: { id: true, name: true, code: true } } } } } },
        _count: { select: { registrations: true } },
      },
      orderBy: { matricNumber: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return page(rows, total, query);
}

export async function getStudent(id: string) {
  const student = await prisma.student.findUnique({ where: { id }, include: { programme: { include: { department: { include: { college: true } } } }, registrations: { include: { course: { select: { id: true, code: true, title: true } }, session: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } } }, orderBy: { course: { normalizedCode: "asc" } } } } });
  if (!student) throw new AcademicError("STUDENT_NOT_FOUND", "The student was not found.", {}, 404);
  return student;
}

async function assertStudentProgramme(db: Database, programmeId: string) { const programme = await db.programme.findUnique({ where: { id: programmeId } }); if (!programme || !programme.active) throw new AcademicError("NOT_FOUND", "Select an existing active programme.", {}, 404); return programme; }

export async function createStudent(input: StudentInput, actorId: string) {
  const matricNumber = normalizeMatricNumber(input.matricNumber);
  await assertStudentProgramme(prisma, input.programmeId);
  try { return await prisma.$transaction(async (db) => { const student = await db.student.create({ data: { ...input, matricNumber, name: input.name || null } }); await audit(db, actorId, "STUDENT_CREATED", "Student", student.id, { matricNumber: student.matricNumber, programmeId: student.programmeId }); return student; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("STUDENT_MATRIC_EXISTS", "A student with this matric number already exists.", {}, 409); throw error; }
}

export async function updateStudent(id: string, input: StudentInput, actorId: string) {
  await assertStudentProgramme(prisma, input.programmeId);
  try { return await prisma.$transaction(async (db) => { const student = await db.student.update({ where: { id }, data: { matricNumber: normalizeMatricNumber(input.matricNumber), name: input.name || null, programmeId: input.programmeId, level: input.level, active: input.active } }); await audit(db, actorId, "STUDENT_UPDATED", "Student", id, { matricNumber: student.matricNumber, active: student.active }); return student; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("STUDENT_MATRIC_EXISTS", "A student with this matric number already exists.", {}, 409); throw error; }
}

async function assertRegistration(db: Db, input: RegistrationInput) {
  const [student, course, session, semester] = await Promise.all([db.student.findUnique({ where: { id: input.studentId } }), db.course.findUnique({ where: { id: input.courseId } }), db.academicSession.findUnique({ where: { id: input.sessionId } }), db.semester.findUnique({ where: { id: input.semesterId } })]);
  if (!student) throw new AcademicError("STUDENT_NOT_FOUND", "The student was not found.", {}, 404);
  if (!student.active) throw new AcademicError("STUDENT_INACTIVE", "Inactive students cannot receive registrations.", {}, 409);
  if (!course) throw new AcademicError("COURSE_NOT_FOUND", "The course was not found.", {}, 404);
  if (!course.active) throw new AcademicError("COURSE_INACTIVE", "Inactive courses cannot receive registrations.", {}, 409);
  if (!session || !semester) throw new AcademicError("NOT_FOUND", "Select an existing academic session and semester.", {}, 404);
  if (semester.academicSessionId !== session.id || course.semesterId !== semester.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The registration session, semester, and course do not match.", {}, 400);
}

export async function listRegistrations(query: ListQuery) {
  const where = { ...(query.studentId ? { studentId: query.studentId } : {}), ...(query.courseId ? { courseId: query.courseId } : {}), ...(query.sessionId ? { sessionId: query.sessionId } : {}), ...(query.semesterId ? { semesterId: query.semesterId } : {}), ...(query.programmeId || query.departmentId || query.collegeId || query.level ? { student: { ...(query.level ? { level: query.level } : {}), ...(query.programmeId || query.departmentId || query.collegeId ? { programme: { ...(query.programmeId ? { id: query.programmeId } : {}), ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.collegeId ? { department: { collegeId: query.collegeId } } : {}) } } : {}) } } : {}), ...(query.q ? { OR: [{ student: { matricNumber: { contains: query.q, mode: "insensitive" as const } } }, { course: { code: { contains: query.q, mode: "insensitive" as const } } }] } : {}) };
  const [rows, total] = await prisma.$transaction([prisma.courseRegistration.findMany({ where, include: { student: { select: { id: true, matricNumber: true, name: true, level: true, programme: { select: { name: true, code: true } } } }, course: { select: { id: true, code: true, title: true } }, session: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } } }, orderBy: [{ student: { matricNumber: "asc" } }, { course: { normalizedCode: "asc" } }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.courseRegistration.count({ where })]);
  return page(rows, total, query);
}

export async function createRegistration(input: RegistrationInput, actorId: string) { await assertRegistration(prisma, input); try { return await prisma.$transaction(async (db) => { const registration = await db.courseRegistration.create({ data: input }); await audit(db, actorId, "REGISTRATION_CREATED", "CourseRegistration", registration.id, input); return registration; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("REGISTRATION_ALREADY_EXISTS", "This student is already registered for that course in the selected period.", {}, 409); throw error; } }

export async function removeRegistration(id: string, actorId: string) { return prisma.$transaction(async (db) => { const registration = await db.courseRegistration.findUnique({ where: { id } }); if (!registration) throw new AcademicError("REGISTRATION_NOT_FOUND", "The registration was not found.", {}, 404); await db.courseRegistration.delete({ where: { id } }); await audit(db, actorId, "REGISTRATION_REMOVED", "CourseRegistration", id, { studentId: registration.studentId, courseId: registration.courseId }); return { id }; }); }

export async function listVenues(query: ListQuery) { const where = { ...activeWhere(query.active), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { code: { contains: query.q, mode: "insensitive" as const } }, { location: { contains: query.q, mode: "insensitive" as const } }] } : {}) }; const [rows, total] = await prisma.$transaction([prisma.venue.findMany({ where, include: { _count: { select: { assignments: true, unavailablePeriods: true } } }, orderBy: { capacity: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.venue.count({ where })]); return page(rows, total, query); }
export async function getVenue(id: string) { const venue = await prisma.venue.findUnique({ where: { id }, include: { unavailablePeriods: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } } }); if (!venue) throw new AcademicError("NOT_FOUND", "The venue was not found.", {}, 404); return venue; }
export async function createVenue(input: VenueInput, actorId: string) { try { return await prisma.$transaction(async (db) => { const venue = await db.venue.create({ data: { ...input, location: input.location || null } }); await audit(db, actorId, "VENUE_CREATED", "Venue", venue.id, { code: venue.code, capacity: venue.capacity }); return venue; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("VENUE_CODE_EXISTS", "A venue with this code already exists.", {}, 409); throw error; } }
export async function updateVenue(id: string, input: VenueInput, actorId: string) { try { return await prisma.$transaction(async (db) => { const venue = await db.venue.update({ where: { id }, data: { ...input, location: input.location || null } }); await audit(db, actorId, "VENUE_UPDATED", "Venue", id, { code: venue.code, active: venue.active }); return venue; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("VENUE_CODE_EXISTS", "A venue with this code already exists.", {}, 409); throw error; } }
export async function addVenueUnavailable(venueId: string, input: AvailabilityInput, actorId: string) { return prisma.$transaction(async (db) => { const venue = await db.venue.findUnique({ where: { id: venueId } }); if (!venue) throw new AcademicError("NOT_FOUND", "The venue was not found.", {}, 404); await assertAvailabilityFree(db, "venue", venueId, input); const period = await db.venueUnavailablePeriod.create({ data: { venueId, date: dateValue(input.date), startTime: input.startTime, endTime: input.endTime, reason: input.reason || null } }); await audit(db, actorId, "VENUE_UNAVAILABLE_CREATED", "VenueUnavailablePeriod", period.id, { venueId, date: input.date }); return period; }); }
async function assertAvailabilityFree(db: Db, table: "venue" | "invigilator", ownerId: string, input: AvailabilityInput, excludeId?: string) { const periods = table === "venue" ? await db.venueUnavailablePeriod.findMany({ where: { venueId: ownerId, date: dateValue(input.date), ...(excludeId ? { id: { not: excludeId } } : {}) } }) : await db.invigilatorUnavailablePeriod.findMany({ where: { invigilatorId: ownerId, date: dateValue(input.date), ...(excludeId ? { id: { not: excludeId } } : {}) } }); if (periods.some((period) => timeToMinutes(input.startTime) < timeToMinutes(period.endTime) && timeToMinutes(period.startTime) < timeToMinutes(input.endTime))) throw new AcademicError("INVALID_AVAILABILITY_RANGE", "Unavailable periods cannot overlap for the same resource and date.", {}, 409); }
export async function updateVenueUnavailable(id: string, input: AvailabilityInput, actorId: string) { return prisma.$transaction(async (db) => { const current = await db.venueUnavailablePeriod.findUnique({ where: { id } }); if (!current) throw new AcademicError("NOT_FOUND", "The unavailability period was not found.", {}, 404); await assertAvailabilityFree(db, "venue", current.venueId, input, id); const period = await db.venueUnavailablePeriod.update({ where: { id }, data: { date: dateValue(input.date), startTime: input.startTime, endTime: input.endTime, reason: input.reason || null } }); await audit(db, actorId, "VENUE_UNAVAILABLE_UPDATED", "VenueUnavailablePeriod", id, { venueId: current.venueId, date: input.date }); return period; }); }
export async function removeVenueUnavailable(id: string, actorId: string) { return prisma.$transaction(async (db) => { const period = await db.venueUnavailablePeriod.findUnique({ where: { id } }); if (!period) throw new AcademicError("NOT_FOUND", "The unavailability period was not found.", {}, 404); await db.venueUnavailablePeriod.delete({ where: { id } }); await audit(db, actorId, "VENUE_UNAVAILABLE_REMOVED", "VenueUnavailablePeriod", id); return { id }; }); }

export async function listInvigilators(query: ListQuery) { const where = { ...activeWhere(query.active), ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { staffId: { contains: query.q, mode: "insensitive" as const } }, { email: { contains: query.q, mode: "insensitive" as const } }] } : {}) }; const [rows, total] = await prisma.$transaction([prisma.invigilator.findMany({ where, include: { department: { select: { id: true, name: true, code: true } }, _count: { select: { assignments: true, unavailablePeriods: true } } }, orderBy: { name: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.invigilator.count({ where })]); return page(rows, total, query); }
export async function getInvigilator(id: string) { const invigilator = await prisma.invigilator.findUnique({ where: { id }, include: { department: true, unavailablePeriods: { orderBy: [{ date: "asc" }, { startTime: "asc" }] } } }); if (!invigilator) throw new AcademicError("NOT_FOUND", "The invigilator was not found.", {}, 404); return invigilator; }
export async function createInvigilator(input: InvigilatorInput, actorId: string) { try { return await prisma.$transaction(async (db) => { if (input.departmentId) { const department = await db.department.findUnique({ where: { id: input.departmentId } }); if (!department) throw new AcademicError("NOT_FOUND", "The department was not found.", {}, 404); } const invigilator = await db.invigilator.create({ data: { ...input, staffId: input.staffId || null, email: input.email || null, departmentId: input.departmentId || null } }); await audit(db, actorId, "INVIGILATOR_CREATED", "Invigilator", invigilator.id, { staffId: invigilator.staffId }); return invigilator; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("INVIGILATOR_STAFF_ID_EXISTS", "That staff ID or email is already in use.", {}, 409); throw error; } }
export async function updateInvigilator(id: string, input: InvigilatorInput, actorId: string) { try { return await prisma.$transaction(async (db) => { if (input.departmentId) { const department = await db.department.findUnique({ where: { id: input.departmentId } }); if (!department) throw new AcademicError("NOT_FOUND", "The department was not found.", {}, 404); } const invigilator = await db.invigilator.update({ where: { id }, data: { ...input, staffId: input.staffId || null, email: input.email || null, departmentId: input.departmentId || null } }); await audit(db, actorId, "INVIGILATOR_UPDATED", "Invigilator", id, { staffId: invigilator.staffId, active: invigilator.active }); return invigilator; }); } catch (error) { if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("INVIGILATOR_STAFF_ID_EXISTS", "That staff ID or email is already in use.", {}, 409); throw error; } }
export async function addInvigilatorUnavailable(invigilatorId: string, input: AvailabilityInput, actorId: string) { return prisma.$transaction(async (db) => { const invigilator = await db.invigilator.findUnique({ where: { id: invigilatorId } }); if (!invigilator) throw new AcademicError("NOT_FOUND", "The invigilator was not found.", {}, 404); await assertAvailabilityFree(db, "invigilator", invigilatorId, input); const period = await db.invigilatorUnavailablePeriod.create({ data: { invigilatorId, date: dateValue(input.date), startTime: input.startTime, endTime: input.endTime, reason: input.reason || null } }); await audit(db, actorId, "INVIGILATOR_UNAVAILABLE_CREATED", "InvigilatorUnavailablePeriod", period.id, { invigilatorId, date: input.date }); return period; }); }
export async function updateInvigilatorUnavailable(id: string, input: AvailabilityInput, actorId: string) { return prisma.$transaction(async (db) => { const current = await db.invigilatorUnavailablePeriod.findUnique({ where: { id } }); if (!current) throw new AcademicError("NOT_FOUND", "The unavailability period was not found.", {}, 404); await assertAvailabilityFree(db, "invigilator", current.invigilatorId, input, id); const period = await db.invigilatorUnavailablePeriod.update({ where: { id }, data: { date: dateValue(input.date), startTime: input.startTime, endTime: input.endTime, reason: input.reason || null } }); await audit(db, actorId, "INVIGILATOR_UNAVAILABLE_UPDATED", "InvigilatorUnavailablePeriod", id, { invigilatorId: current.invigilatorId, date: input.date }); return period; }); }
export async function removeInvigilatorUnavailable(id: string, actorId: string) { return prisma.$transaction(async (db) => { const period = await db.invigilatorUnavailablePeriod.findUnique({ where: { id } }); if (!period) throw new AcademicError("NOT_FOUND", "The unavailability period was not found.", {}, 404); await db.invigilatorUnavailablePeriod.delete({ where: { id } }); await audit(db, actorId, "INVIGILATOR_UNAVAILABLE_REMOVED", "InvigilatorUnavailablePeriod", id); return { id }; }); }

export async function getResourceReadiness() {
  const [courses, students, registrations, venues, invigilators, slots, activePeriod, unregisteredCourses, largestVenue] = await prisma.$transaction([
    prisma.course.count({ where: { active: true } }), prisma.student.count({ where: { active: true } }), prisma.courseRegistration.count(), prisma.venue.count({ where: { active: true } }), prisma.invigilator.count({ where: { active: true } }), prisma.examTimeSlot.count({ where: { examPeriod: { active: true } } }), prisma.examPeriod.findFirst({ where: { active: true }, orderBy: { startDate: "desc" } }), prisma.course.count({ where: { active: true, registrations: { none: {} } } }), prisma.venue.findFirst({ where: { active: true }, orderBy: { capacity: "desc" } }),
  ]);
  const oversizedCourses = largestVenue ? await prisma.course.count({ where: { active: true, estimatedStudentCount: { gt: largestVenue.capacity }, registrations: { none: {} } } }) : 0;
  return { courses, students, registrations, venues, invigilators, slots, activePeriod: activePeriod?.name ?? null, unregisteredCourses, oversizedCourses, largestVenueCapacity: largestVenue?.capacity ?? 0 };
}
