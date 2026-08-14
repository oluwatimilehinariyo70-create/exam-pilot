import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { courseCodeKey, normalizeMatricNumber, type ImportConfirmRequest } from "@/server/resources/schemas";
import { parseCsv, type CsvRecord, REQUIRED_IMPORT_HEADERS } from "@/server/resources/csv";

type ImportRow = { rowNumber: number; matricNumber: string; name?: string; programmeId: string; level: number; courseId: string };
type ImportIssue = { rowNumber: number; matricNumber: string; courseCode: string; message: string; code: string };

function normalized(value: string) { return value.trim().toLowerCase(); }

function parseLevel(value: string) { const parsed = Number(value.trim()); return Number.isInteger(parsed) && parsed >= 100 && parsed <= 999 && parsed % 100 === 0 ? parsed : null; }

function programmeMatches(programme: { id: string; name: string; code: string }, value: string) { const key = normalized(value); return normalized(programme.code) === key || normalized(programme.name) === key; }

async function loadImportContext(sessionId: string, semesterId: string) {
  const [session, semester, programmes, courses, students, registrations] = await prisma.$transaction([
    prisma.academicSession.findUnique({ where: { id: sessionId } }),
    prisma.semester.findUnique({ where: { id: semesterId } }),
    prisma.programme.findMany({ where: { active: true }, select: { id: true, name: true, code: true } }),
    prisma.course.findMany({ where: { semesterId, active: true }, select: { id: true, code: true, normalizedCode: true } }),
    prisma.student.findMany({ select: { id: true, matricNumber: true, programmeId: true, level: true, active: true } }),
    prisma.courseRegistration.findMany({ where: { sessionId, semesterId }, select: { studentId: true, courseId: true } }),
  ]);
  if (!session || !semester) throw new AcademicError("NOT_FOUND", "Select an existing academic session and semester.", {}, 404);
  if (semester.academicSessionId !== sessionId) throw new AcademicError("INVALID_SESSION_SEMESTER", "The selected semester does not belong to the selected session.", {}, 400);
  return { session, semester, programmes, courses, students, registrations };
}

export async function previewRegistrationImport(csv: string, sessionId: string, semesterId: string) {
  const { programmes, courses, students, registrations } = await loadImportContext(sessionId, semesterId);
  const parsed = parseCsv(csv);
  const issues: ImportIssue[] = [];
  const rows: ImportRow[] = [];
  const seenRegistrations = new Set<string>();
  const studentByMatric = new Map(students.map((student) => [normalized(student.matricNumber), student]));
  const courseByCode = new Map(courses.map((course) => [course.normalizedCode ?? courseCodeKey(course.code), course]));
  const registrationKeys = new Set(registrations.map((registration) => `${registration.studentId}|${registration.courseId}`));
  const newStudents = new Set<string>();
  const existingStudents = new Set<string>();
  let duplicateRows = 0;
  for (const record of parsed.rows) {
    const matricNumber = normalizeMatricNumber(record.values.matric_number ?? "");
    const programmeValue = record.values.programme ?? "";
    const courseValue = record.values.course_code ?? "";
    const level = parseLevel(record.values.level ?? "");
    const errors: ImportIssue[] = [];
    if (!matricNumber) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: "Matric number is required.", code: "CSV_INVALID_ROW" });
    if (!programmeValue) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: "Programme is required.", code: "CSV_UNKNOWN_PROGRAMME" });
    const programme = programmes.find((candidate) => programmeMatches(candidate, programmeValue));
    if (programmeValue && !programme) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: `Programme ${programmeValue} does not exist.`, code: "CSV_UNKNOWN_PROGRAMME" });
    if (level === null) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: "Level must be a valid academic level such as 100, 200, or 400.", code: "CSV_INVALID_ROW" });
    const course = courseByCode.get(courseCodeKey(courseValue));
    if (!course) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: `Course ${courseValue || "(blank)"} does not exist for the selected semester.`, code: "CSV_UNKNOWN_COURSE" });
    const existingStudent = studentByMatric.get(normalized(matricNumber));
    if (existingStudent && !existingStudent.active) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: "The existing student is inactive.", code: "STUDENT_INACTIVE" });
    if (programme && existingStudent && existingStudent.programmeId !== programme.id) errors.push({ rowNumber: record.rowNumber, matricNumber, courseCode: courseValue, message: "The matric number already belongs to a different programme.", code: "CSV_INVALID_ROW" });
    if (errors.length) { issues.push(...errors); continue; }
    const key = `${normalized(matricNumber)}|${course!.id}`;
    if (seenRegistrations.has(key) || (existingStudent && registrationKeys.has(`${existingStudent.id}|${course!.id}`))) { duplicateRows += 1; continue; }
    seenRegistrations.add(key);
    rows.push({ rowNumber: record.rowNumber, matricNumber, name: record.values.student_name || undefined, programmeId: programme!.id, level: level!, courseId: course!.id });
    if (!existingStudent) newStudents.add(normalized(matricNumber));
    else existingStudents.add(normalized(matricNumber));
    if (!studentByMatric.has(normalized(matricNumber))) studentByMatric.set(normalized(matricNumber), { id: `new-${newStudents.size}`, matricNumber, programmeId: programme!.id, level: level!, active: true });
  }
  return { headers: parsed.headers, rows, issues, summary: { totalRows: parsed.rows.length, validRows: rows.length, invalidRows: new Set(issues.map((issue) => issue.rowNumber)).size, duplicateRows, newStudents: newStudents.size, existingStudents: existingStudents.size }, requiredHeaders: REQUIRED_IMPORT_HEADERS };
}

export async function commitRegistrationImport(input: ImportConfirmRequest, actorId: string) {
  const preview = await previewRowsForCommit(input);
  return prisma.$transaction(async (db) => {
    let createdStudents = 0;
    const studentIds = new Map<string, string>();
    const existingStudents = await db.student.findMany({ where: { matricNumber: { in: preview.rows.map((row) => row.matricNumber) } } });
    for (const student of existingStudents) studentIds.set(normalized(student.matricNumber), student.id);
    for (const row of preview.rows) {
      const key = normalized(row.matricNumber);
      if (studentIds.has(key)) continue;
      const student = await db.student.create({ data: { matricNumber: row.matricNumber, name: row.name || null, programmeId: row.programmeId, level: row.level, active: true } });
      studentIds.set(key, student.id); createdStudents += 1;
    }
    const existingKeys = new Set((await db.courseRegistration.findMany({ where: { sessionId: input.sessionId, semesterId: input.semesterId, studentId: { in: [...studentIds.values()] }, courseId: { in: preview.rows.map((row) => row.courseId) } }, select: { studentId: true, courseId: true } })).map((item) => `${item.studentId}|${item.courseId}`));
    const data = preview.rows.filter((row) => !existingKeys.has(`${studentIds.get(normalized(row.matricNumber))}|${row.courseId}`)).map((row) => ({ studentId: studentIds.get(normalized(row.matricNumber))!, courseId: row.courseId, sessionId: input.sessionId, semesterId: input.semesterId }));
    const createdRegistrations = data.length ? (await db.courseRegistration.createMany({ data, skipDuplicates: true })).count : 0;
    const history = await db.registrationImport.create({ data: { fileName: input.fileName, sessionId: input.sessionId, semesterId: input.semesterId, uploadedBy: actorId, totalRows: input.totalRows, validRows: input.rows.length, invalidRows: input.invalidRows, duplicateRows: input.duplicateRows, createdStudents, createdRegistrations, status: "COMPLETED", errors: input.invalidRows ? { invalidRows: input.invalidRows } : undefined } });
    await db.auditLog.create({ data: { actorId, action: "CSV_IMPORT_COMPLETED", entity: "RegistrationImport", entityId: history.id, metadata: { fileName: input.fileName, createdStudents, createdRegistrations, duplicateRows: input.duplicateRows, invalidRows: input.invalidRows } } });
    return { history, createdStudents, createdRegistrations, duplicateRows: input.duplicateRows, invalidRows: input.invalidRows };
  });
}

async function previewRowsForCommit(input: ImportConfirmRequest) {
  const context = await loadImportContext(input.sessionId, input.semesterId);
  const courseIds = new Set(context.courses.map((course) => course.id));
  const programmeIds = new Set(context.programmes.map((programme) => programme.id));
  const studentByMatric = new Map(context.students.map((student) => [normalized(student.matricNumber), student]));
  const seenNewStudents = new Map<string, { programmeId: string; level: number }>();
  for (const row of input.rows) {
    const key = normalized(row.matricNumber);
    const existing = studentByMatric.get(key);
    const previous = seenNewStudents.get(key);
    if (!key || !courseIds.has(row.courseId) || !programmeIds.has(row.programmeId) || !Number.isInteger(row.level) || row.level < 100 || row.level > 999 || row.level % 100 !== 0 || (existing && (!existing.active || existing.programmeId !== row.programmeId)) || (previous && (previous.programmeId !== row.programmeId || previous.level !== row.level))) throw new AcademicError("CSV_CONFIRMATION_REQUIRED", "The import preview is no longer valid. Please upload the CSV again.", {}, 409);
    if (!existing) seenNewStudents.set(key, { programmeId: row.programmeId, level: row.level });
  }
  return input;
}
