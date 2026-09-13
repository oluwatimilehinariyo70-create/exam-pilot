import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { hasOverlappingSlots } from "@/server/academic/rules";
import { dateKey, parseDateOnly, timeToMinutes, type BulkTimeSlotInput, type CollegeInput, type DepartmentInput, type ExamPeriodInput, type ProgrammeInput, type SessionInput, type SemesterInput, type TimeSlotInput } from "@/server/academic/schemas";

type Db = Prisma.TransactionClient;

async function audit(db: Db, actorId: string, action: string, entity: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue } });
}

function activeFilter(active: "true" | "false" | "all") {
  return active === "all" ? {} : { active: active === "true" };
}

export async function listColleges(query: { q?: string; active: "true" | "false" | "all" }) {
  return prisma.college.findMany({ where: { ...activeFilter(query.active), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, include: { _count: { select: { departments: true } } } });
}

export async function createCollege(input: CollegeInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const college = await db.college.create({ data: input });
      await audit(db, actorId, "COLLEGE_CREATED", "College", college.id, { code: college.code, name: college.name });
      return college;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("COLLEGE_CODE_EXISTS", "A college with this code already exists.", { code: input.code }, 409);
    throw error;
  }
}

export async function updateCollege(id: string, input: CollegeInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const college = await db.college.update({ where: { id }, data: input });
      await audit(db, actorId, "COLLEGE_UPDATED", "College", id, { code: college.code, active: college.active });
      return college;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("COLLEGE_CODE_EXISTS", "A college with this code already exists.", { code: input.code }, 409);
    throw error;
  }
}

export async function listDepartments(query: { q?: string; active: "true" | "false" | "all"; collegeId?: string }) {
  return prisma.department.findMany({ where: { ...activeFilter(query.active), ...(query.collegeId ? { collegeId: query.collegeId } : {}), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, include: { college: { select: { id: true, name: true, code: true } }, _count: { select: { programmes: true } } } });
}

export async function createDepartment(input: DepartmentInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const college = await db.college.findUnique({ where: { id: input.collegeId } });
      if (!college) throw new AcademicError("NOT_FOUND", "Select an existing college.", { collegeId: input.collegeId }, 404);
      const department = await db.department.create({ data: input });
      await audit(db, actorId, "DEPARTMENT_CREATED", "Department", department.id, { collegeId: college.id, code: department.code });
      return department;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("DEPARTMENT_CODE_EXISTS", "This department code already exists in the selected college.", { code: input.code }, 409);
    throw error;
  }
}

export async function updateDepartment(id: string, input: DepartmentInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const college = await db.college.findUnique({ where: { id: input.collegeId } });
      if (!college) throw new AcademicError("NOT_FOUND", "Select an existing college.", { collegeId: input.collegeId }, 404);
      const department = await db.department.update({ where: { id }, data: input });
      await audit(db, actorId, "DEPARTMENT_UPDATED", "Department", id, { collegeId: input.collegeId, code: department.code, active: department.active });
      return department;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("DEPARTMENT_CODE_EXISTS", "This department code already exists in the selected college.", { code: input.code }, 409);
    throw error;
  }
}

export async function listProgrammes(query: { q?: string; active: "true" | "false" | "all"; departmentId?: string; collegeId?: string }) {
  return prisma.programme.findMany({ where: { ...activeFilter(query.active), ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.collegeId ? { department: { collegeId: query.collegeId } } : {}), ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }] } : {}) }, orderBy: { name: "asc" }, include: { department: { select: { id: true, name: true, code: true, college: { select: { id: true, name: true, code: true } } } }, _count: { select: { students: true } } } });
}

export async function createProgramme(input: ProgrammeInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const department = await db.department.findUnique({ where: { id: input.departmentId } });
      if (!department) throw new AcademicError("NOT_FOUND", "Select an existing department.", { departmentId: input.departmentId }, 404);
      const programme = await db.programme.create({ data: input });
      await audit(db, actorId, "PROGRAMME_CREATED", "Programme", programme.id, { departmentId: input.departmentId, code: programme.code });
      return programme;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("PROGRAMME_CODE_EXISTS", "This programme code already exists in the selected department.", { code: input.code }, 409);
    throw error;
  }
}

export async function updateProgramme(id: string, input: ProgrammeInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const department = await db.department.findUnique({ where: { id: input.departmentId } });
      if (!department) throw new AcademicError("NOT_FOUND", "Select an existing department.", { departmentId: input.departmentId }, 404);
      const programme = await db.programme.update({ where: { id }, data: input });
      await audit(db, actorId, "PROGRAMME_UPDATED", "Programme", id, { departmentId: input.departmentId, code: programme.code, active: programme.active });
      return programme;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("PROGRAMME_CODE_EXISTS", "This programme code already exists in the selected department.", { code: input.code }, 409);
    throw error;
  }
}

export async function listSessions(query: { q?: string; active: "true" | "false" | "all" }) {
  return prisma.academicSession.findMany({ where: { ...activeFilter(query.active), ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}) }, orderBy: { startYear: "desc" }, include: { _count: { select: { semesters: true, examPeriods: true } } } });
}

export async function createSession(input: SessionInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      if (input.active) await db.academicSession.updateMany({ data: { active: false } });
      const session = await db.academicSession.create({ data: input });
      await audit(db, actorId, "SESSION_CREATED", "AcademicSession", session.id, { name: session.name, active: session.active });
      return session;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("SESSION_ALREADY_EXISTS", "This academic session already exists.", { name: input.name }, 409);
    throw error;
  }
}

export async function updateSession(id: string, input: SessionInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      if (input.active) await db.academicSession.updateMany({ where: { id: { not: id } }, data: { active: false } });
      const session = await db.academicSession.update({ where: { id }, data: input });
      await audit(db, actorId, "SESSION_UPDATED", "AcademicSession", id, { name: session.name, active: session.active });
      return session;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("SESSION_ALREADY_EXISTS", "This academic session already exists.", { name: input.name }, 409);
    throw error;
  }
}

export async function listSemesters(query: { q?: string; active: "true" | "false" | "all"; sessionId?: string }) {
  return prisma.semester.findMany({ where: { ...activeFilter(query.active), ...(query.sessionId ? { academicSessionId: query.sessionId } : {}), ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}) }, orderBy: [{ academicSessionId: "desc" }, { semesterNumber: "asc" }], include: { academicSession: { select: { id: true, name: true } }, _count: { select: { courses: true, examPeriods: true } } } });
}

export async function createSemester(input: SemesterInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const session = await db.academicSession.findUnique({ where: { id: input.academicSessionId } });
      if (!session) throw new AcademicError("NOT_FOUND", "Select an existing academic session.", { academicSessionId: input.academicSessionId }, 404);
      const semester = await db.semester.create({ data: input });
      await audit(db, actorId, "SEMESTER_CREATED", "Semester", semester.id, { academicSessionId: input.academicSessionId, semesterNumber: semester.semesterNumber });
      return semester;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("SEMESTER_ALREADY_EXISTS", "This semester number already exists in the selected academic session.", { semesterNumber: input.semesterNumber }, 409);
    throw error;
  }
}

export async function updateSemester(id: string, input: SemesterInput, actorId: string) {
  try {
    return await prisma.$transaction(async (db) => {
      const session = await db.academicSession.findUnique({ where: { id: input.academicSessionId } });
      if (!session) throw new AcademicError("NOT_FOUND", "Select an existing academic session.", { academicSessionId: input.academicSessionId }, 404);
      const semester = await db.semester.update({ where: { id }, data: input });
      await audit(db, actorId, "SEMESTER_UPDATED", "Semester", id, { academicSessionId: input.academicSessionId, semesterNumber: semester.semesterNumber, active: semester.active });
      return semester;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("SEMESTER_ALREADY_EXISTS", "This semester number already exists in the selected academic session.", { semesterNumber: input.semesterNumber }, 409);
    throw error;
  }
}

export async function listExamPeriods(query: { q?: string; active: "true" | "false" | "all"; sessionId?: string }) {
  return prisma.examPeriod.findMany({ where: { ...activeFilter(query.active), ...(query.sessionId ? { sessionId: query.sessionId } : {}), ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}) }, orderBy: { startDate: "desc" }, include: { session: { select: { id: true, name: true } }, semester: { select: { id: true, name: true, semesterNumber: true } }, _count: { select: { timeSlots: true } } } });
}

async function assertPeriodRelationship(db: Db, sessionId: string, semesterId: string) {
  const semester = await db.semester.findUnique({ where: { id: semesterId }, select: { id: true, academicSessionId: true, name: true } });
  if (!semester || semester.academicSessionId !== sessionId) throw new AcademicError("INVALID_SESSION_SEMESTER", "The selected semester does not belong to the selected academic session.", { sessionId, semesterId }, 400);
}

export async function createExamPeriod(input: ExamPeriodInput, actorId: string) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  try {
    return await prisma.$transaction(async (db) => {
      await assertPeriodRelationship(db, input.sessionId, input.semesterId);
      const period = await db.examPeriod.create({ data: { ...input, startDate, endDate } });
      await audit(db, actorId, "EXAM_PERIOD_CREATED", "ExamPeriod", period.id, { sessionId: input.sessionId, semesterId: input.semesterId, name: period.name });
      return period;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("EXAM_PERIOD_ALREADY_EXISTS", "An examination period with this name already exists for the selected semester.", { name: input.name }, 409);
    throw error;
  }
}

export async function updateExamPeriod(id: string, input: ExamPeriodInput, actorId: string) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = parseDateOnly(input.endDate);
  try { return await prisma.$transaction(async (db) => {
    await assertPeriodRelationship(db, input.sessionId, input.semesterId);
    const period = await db.examPeriod.update({ where: { id }, data: { ...input, startDate, endDate } });
    await audit(db, actorId, "EXAM_PERIOD_UPDATED", "ExamPeriod", id, { sessionId: input.sessionId, semesterId: input.semesterId, active: period.active });
    return period;
  }); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") throw new AcademicError("EXAM_PERIOD_ALREADY_EXISTS", "An examination period with this name already exists for the selected semester.", { name: input.name }, 409);
    throw error;
  }
}

export async function listTimeSlots(query: { periodId?: string; q?: string }) {
  const dateSearch = query.q && /^\d{4}-\d{2}-\d{2}$/.test(query.q) ? parseDateOnly(query.q) : undefined;
  return prisma.examTimeSlot.findMany({ where: { ...(query.periodId ? { examPeriodId: query.periodId } : {}), ...(query.q ? { OR: [...(dateSearch ? [{ date: { equals: dateSearch } }] : []), { startTime: { contains: query.q } }, { endTime: { contains: query.q } }] } : {}) }, orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { examPeriod: { select: { id: true, name: true, startDate: true, endDate: true } } } });
}

function validateSlotWithinPeriod(period: { startDate: Date; endDate: Date }, date: Date) {
  const key = dateKey(date);
  if (key < dateKey(period.startDate) || key > dateKey(period.endDate)) throw new AcademicError("TIMESLOT_OUTSIDE_EXAM_PERIOD", "The time slot date must fall inside the examination period.", { date: key });
}

function ensureNoOverlap(slots: Array<{ date: Date; startTime: string; endTime: string }>) {
  if (hasOverlappingSlots(slots)) throw new AcademicError("TIMESLOT_OVERLAP", "Examination time slots cannot overlap on the same date.");
}

export async function createTimeSlot(input: TimeSlotInput, actorId: string) {
  return createTimeSlots([input], actorId);
}

export async function createTimeSlots(inputs: TimeSlotInput[], actorId: string) {
  return prisma.$transaction(async (db) => {
    const periodIds = [...new Set(inputs.map((input) => input.examPeriodId))];
    const periods = await db.examPeriod.findMany({ where: { id: { in: periodIds } } });
    if (periods.length !== periodIds.length) throw new AcademicError("NOT_FOUND", "One or more examination periods were not found.", {}, 404);
    const periodMap = new Map(periods.map((period) => [period.id, period]));
    const proposed = inputs.map((input) => { const date = parseDateOnly(input.date); const period = periodMap.get(input.examPeriodId); if (!period) throw new AcademicError("NOT_FOUND", "Examination period not found.", {}, 404); validateSlotWithinPeriod(period, date); return { ...input, date }; });
    const keys = new Set<string>();
    for (const slot of proposed) { const key = `${slot.examPeriodId}|${dateKey(slot.date)}|${slot.startTime}|${slot.endTime}`; if (keys.has(key)) throw new AcademicError("TIMESLOT_DUPLICATE", "The proposed time slots contain a duplicate.", { key }); keys.add(key); }
    ensureNoOverlap(proposed);
    const existing = await db.examTimeSlot.findMany({ where: { examPeriodId: { in: periodIds }, date: { in: proposed.map((slot) => slot.date) } } });
    ensureNoOverlap([...existing, ...proposed]);
    for (const slot of proposed) { if (existing.some((current) => current.examPeriodId === slot.examPeriodId && dateKey(current.date) === dateKey(slot.date) && current.startTime === slot.startTime && current.endTime === slot.endTime)) throw new AcademicError("TIMESLOT_DUPLICATE", "One or more time slots already exist.", { date: dateKey(slot.date), startTime: slot.startTime, endTime: slot.endTime }); }
    const created = await Promise.all(proposed.map((slot) => db.examTimeSlot.create({ data: slot })));
    await audit(db, actorId, "TIME_SLOTS_CREATED", "ExamTimeSlot", null, { count: created.length, examPeriodIds: periodIds });
    return created;
  });
}

export async function updateTimeSlot(id: string, input: TimeSlotInput, actorId: string) {
  return prisma.$transaction(async (db) => {
    const current = await db.examTimeSlot.findUnique({ where: { id } });
    if (!current) throw new AcademicError("NOT_FOUND", "The time slot was not found.", {}, 404);
    const period = await db.examPeriod.findUnique({ where: { id: input.examPeriodId } });
    if (!period) throw new AcademicError("NOT_FOUND", "The examination period was not found.", {}, 404);
    const date = parseDateOnly(input.date);
    validateSlotWithinPeriod(period, date);
    const existing = await db.examTimeSlot.findMany({ where: { examPeriodId: input.examPeriodId, date, id: { not: id } } });
    ensureNoOverlap([...existing, { date, startTime: input.startTime, endTime: input.endTime }]);
    if (existing.some((slot) => dateKey(slot.date) === input.date && slot.startTime === input.startTime && slot.endTime === input.endTime)) throw new AcademicError("TIMESLOT_DUPLICATE", "A time slot with these details already exists.", {}, 409);
    const updated = await db.examTimeSlot.update({ where: { id }, data: { examPeriodId: input.examPeriodId, date, startTime: input.startTime, endTime: input.endTime } });
    await audit(db, actorId, "TIME_SLOT_UPDATED", "ExamTimeSlot", id, { date: input.date, startTime: input.startTime, endTime: input.endTime });
    return updated;
  });
}

export async function previewTimeSlots(input: BulkTimeSlotInput) {
  const period = await prisma.examPeriod.findUnique({ where: { id: input.examPeriodId }, include: { timeSlots: true, calendarDays: true } });
  if (!period) throw new AcademicError("NOT_FOUND", "The examination period was not found.", { examPeriodId: input.examPeriodId }, 404);
  const excluded = new Set(input.excludedDates);
  const proposed: Array<{ date: string; startTime: string; endTime: string; duplicate: boolean; collision: boolean }> = [];
  const collisions: string[] = [];
  for (let cursor = new Date(period.startDate); cursor <= period.endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    const key = dateKey(cursor);
    if (!input.daysOfWeek.includes(day) || (input.skipWeekends && (day === 0 || day === 6)) || excluded.has(key)) continue;
    const calendarDay = period.calendarDays.find((candidate) => dateKey(candidate.date) === key);
    if (calendarDay && (!calendarDay.enabled || calendarDay.blackoutType)) continue;
    for (const dailySession of input.dailySessions) {
      const duplicate = period.timeSlots.some((slot) => dateKey(slot.date) === key && slot.startTime === dailySession.startTime && slot.endTime === dailySession.endTime);
      const overlap = period.timeSlots.some((slot) => dateKey(slot.date) === key && timeToMinutes(dailySession.startTime) < timeToMinutes(slot.endTime) && timeToMinutes(slot.startTime) < timeToMinutes(dailySession.endTime));
      if (overlap && !duplicate) collisions.push(`${key} ${dailySession.startTime}-${dailySession.endTime}`);
      proposed.push({ date: key, ...dailySession, duplicate, collision: overlap && !duplicate });
    }
  }
  ensureNoOverlap(input.dailySessions.map((slot) => ({ ...slot, date: parseDateOnly("2000-01-01") })));
  return { period: { id: period.id, name: period.name, startDate: dateKey(period.startDate), endDate: dateKey(period.endDate) }, slots: proposed, collisions, existingCount: period.timeSlots.length };
}

export async function deleteTimeSlot(id: string, actorId: string) {
  return prisma.$transaction(async (db) => {
    const slot = await db.examTimeSlot.findUnique({ where: { id }, include: { _count: { select: { schedules: true } } } });
    if (!slot) throw new AcademicError("NOT_FOUND", "The time slot was not found.", {}, 404);
    if (slot._count.schedules > 0) throw new AcademicError("DATABASE_ERROR", "This time slot is already used by a timetable and cannot be removed.", {}, 409);
    await db.examTimeSlot.delete({ where: { id } });
    await audit(db, actorId, "TIME_SLOT_DELETED", "ExamTimeSlot", id, { date: dateKey(slot.date), startTime: slot.startTime, endTime: slot.endTime });
    return { id };
  });
}
