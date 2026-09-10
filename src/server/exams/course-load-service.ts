import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { aggregateCourseOfferings, createAggregationIdentity, createCohortKey, validateExamEventMerge, type CourseOffering as DomainCourseOffering } from "@/domain/exams";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { canonicalCourseCodeKey } from "@/domain/exams/identity";
import { courseOfferingToDomain } from "./mappers";
import { COURSE_LOAD_HEADERS, parseCourseLoadCsv, type CourseLoadIssue, type NormalizedCourseLoadRow } from "./course-load-parser";

const offeringInclude = {
  course: { include: { department: true } },
  programme: { include: { department: true } },
} satisfies Prisma.CourseOfferingInclude;

const courseInclude = { department: true, semester: true } satisfies Prisma.CourseInclude;

type Severity = "ERROR" | "WARNING";
export type CourseLoadResolvedRow = NormalizedCourseLoadRow & {
  programmeId?: string;
  departmentId?: string;
  courseId?: string;
  existingOfferingId?: string;
  existingCandidateCount?: number;
  status: "NEW" | "EXISTING" | "INVALID";
  issues: (CourseLoadIssue & { severity: Severity })[];
};

export type CourseLoadAggregateGroup = {
  key: string;
  canonicalCourseCode: string;
  displayCourseCode: string;
  candidateCount: number;
  offeringCount: number;
  cohortKeys: string[];
  status: "READY_TO_AGGREGATE" | "REQUIRES_REVIEW";
  diagnostics: { code: string; severity: Severity; message: string }[];
};

export type CourseLoadMergeSuggestion = {
  left: { rowNumber: number; courseCode: string; courseTitle: string; programme: string; level: number; candidateCount: number };
  right: { rowNumber: number; courseCode: string; courseTitle: string; programme: string; level: number; candidateCount: number };
  reason: string;
  confidence: "REVIEW";
};

export type CourseLoadPreview = {
  previewHash: string;
  headers: string[];
  rows: CourseLoadResolvedRow[];
  aggregateGroups: CourseLoadAggregateGroup[];
  mergeSuggestions: CourseLoadMergeSuggestion[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    newOfferings: number;
    existingOfferings: number;
    updateOfferings: number;
    unknownProgrammes: number;
    unknownDepartments: number;
    unknownCourses: number;
    candidateIssues: number;
    modeIssues: number;
    durationIssues: number;
    logicalExams: number;
    candidateVolume: number;
  };
};

function lookup(value: string) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }

function issue(row: NormalizedCourseLoadRow, code: string, field: string, message: string, severity: Severity = "ERROR") {
  return { rowNumber: row.rowNumber, code: code as CourseLoadIssue["code"], field, message, severity };
}

function titleSimilarity(left: string, right: string) {
  const a = new Set(left.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  const b = new Set(right.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function canonicalPreviewInput(sessionId: string, semesterId: string, rows: CourseLoadResolvedRow[]) {
  return JSON.stringify({ sessionId, semesterId, rows: rows.map((row) => ({ rowNumber: row.rowNumber, programmeId: row.programmeId, departmentId: row.departmentId, level: row.level, courseId: row.courseId, courseCode: row.canonicalCourseCode, courseTitle: row.courseTitle, creditUnits: row.creditUnits, candidateCount: row.candidateCount, examMode: row.examMode, durationMinutes: row.durationMinutes, status: row.status, issues: row.issues.map((item) => ({ code: item.code, field: item.field, severity: item.severity })) })) });
}

function hashPreview(input: string) { return createHash("sha256").update(input).digest("hex"); }

function toDomainRow(row: CourseLoadResolvedRow, course: { code: string; title: string; creditUnits: number; departmentId: string; defaultExamMode: "PEN_ON_PAPER" | "CBT" | null; defaultDurationMinutes: number | null }): DomainCourseOffering {
  return {
    id: row.existingOfferingId ?? `preview:${row.rowNumber}:${row.programmeId}:${row.courseId}`,
    sessionId: "preview-session",
    semesterId: "preview-semester",
    courseId: row.courseId!,
    courseCode: course.code,
    courseTitle: course.title,
    programmeId: row.programmeId!,
    programmeName: row.programme,
    departmentId: course.departmentId,
    level: row.level,
    candidateCount: row.candidateCount,
    creditUnits: course.creditUnits,
    examMode: row.examMode ?? course.defaultExamMode ?? undefined,
    durationMinutes: row.durationMinutes ?? course.defaultDurationMinutes ?? undefined,
  };
}

function suggestionRows(rows: CourseLoadResolvedRow[]) {
  const valid = rows.filter((row) => row.status !== "INVALID" && row.courseId && row.programmeId);
  const suggestions: CourseLoadMergeSuggestion[] = [];
  for (let leftIndex = 0; leftIndex < valid.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < valid.length; rightIndex += 1) {
      const left = valid[leftIndex]; const right = valid[rightIndex];
      if (left.canonicalCourseCode === right.canonicalCourseCode || left.level !== right.level || left.creditUnits !== right.creditUnits) continue;
      const leftMode = left.examMode ?? "PEN_ON_PAPER"; const rightMode = right.examMode ?? "PEN_ON_PAPER";
      if (leftMode !== rightMode || (left.durationMinutes !== undefined && right.durationMinutes !== undefined && left.durationMinutes !== right.durationMinutes)) continue;
      if (titleSimilarity(left.courseTitle, right.courseTitle) < 0.3 && left.courseTitle.split(/\s+/)[0].toLowerCase() !== right.courseTitle.split(/\s+/)[0].toLowerCase()) continue;
      suggestions.push({ left: { rowNumber: left.rowNumber, courseCode: left.courseCode, courseTitle: left.courseTitle, programme: left.programme, level: left.level, candidateCount: left.candidateCount }, right: { rowNumber: right.rowNumber, courseCode: right.courseCode, courseTitle: right.courseTitle, programme: right.programme, level: right.level, candidateCount: right.candidateCount }, reason: `Same level, ${left.creditUnits} credit units, ${leftMode}, and compatible duration/title signals.`, confidence: "REVIEW" });
    }
  }
  return suggestions.slice(0, 50);
}

export async function previewCourseLoadImport(input: { fileName: string; academicSessionId: string; semesterId: string; csv: string }): Promise<CourseLoadPreview> {
  if (!input.fileName.toLowerCase().endsWith(".csv")) throw new AcademicError("CSV_INVALID_HEADERS", "Only CSV files are supported for course-load imports.", {}, 400);
  const parsed = parseCourseLoadCsv(input.csv);
  const [session, semester, programmes, courses, existingOfferings] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: input.academicSessionId } }),
    prisma.semester.findUnique({ where: { id: input.semesterId } }),
    prisma.programme.findMany({ where: { active: true }, include: { department: true } }),
    prisma.course.findMany({ where: { semesterId: input.semesterId, active: true }, include: courseInclude }),
    prisma.courseOffering.findMany({ where: { academicSessionId: input.academicSessionId, semesterId: input.semesterId }, include: offeringInclude }),
  ]);
  if (!session || !semester) throw new AcademicError("NOT_FOUND", "Select an existing academic session and semester.", {}, 404);
  if (semester.academicSessionId !== session.id) throw new AcademicError("INVALID_SESSION_SEMESTER", "The selected semester does not belong to the selected session.", {}, 400);
  const programmeByKey = new Map(programmes.flatMap((programme) => [[lookup(programme.code), programme], [lookup(programme.name), programme]]));
  const courseByCode = new Map(courses.map((course) => [course.normalizedCode ?? canonicalCourseCodeKey(course.code), course]));
  const offeringByKey = new Map(existingOfferings.map((offering) => [`${offering.programmeId}|${offering.level}|${offering.courseId}`, offering]));
  const rows: CourseLoadResolvedRow[] = [];
  const duplicateKeys = new Map<string, number[]>();
  for (const parsedRow of parsed.rows) {
    if (!parsedRow.normalized) {
      rows.push({ rowNumber: parsedRow.rowNumber, programme: parsedRow.raw.programme ?? "", department: parsedRow.raw.department ?? "", level: 0, courseCode: parsedRow.raw.course_code ?? "", canonicalCourseCode: canonicalCourseCodeKey(parsedRow.raw.course_code ?? ""), courseTitle: parsedRow.raw.course_title ?? "", creditUnits: 0, candidateCount: 0, status: "INVALID", issues: parsedRow.issues.map((item) => ({ ...item, severity: "ERROR" })) });
      continue;
    }
    const normalized = parsedRow.normalized;
    const rowIssues: CourseLoadResolvedRow["issues"] = parsedRow.issues.map((item) => ({ ...item, severity: "ERROR" }));
    const programme = programmeByKey.get(lookup(normalized.programme));
    if (!programme) rowIssues.push(issue(normalized, "CSV_UNKNOWN_PROGRAMME", "programme", `Unknown programme “${normalized.programme}”.`));
    const department = programme?.department;
    if (programme && department && lookup(normalized.department) !== lookup(department.name) && lookup(normalized.department) !== lookup(department.code)) rowIssues.push(issue(normalized, "CSV_UNKNOWN_DEPARTMENT", "department", `Department does not match programme ${programme.name}.`));
    const course = courseByCode.get(normalized.canonicalCourseCode);
    if (!course) rowIssues.push(issue(normalized, "CSV_UNKNOWN_OFFERING", "course_code", `Unknown course ${normalized.courseCode} for the selected semester.`));
    if (course && lookup(normalized.courseTitle) !== lookup(course.title)) rowIssues.push(issue(normalized, "CSV_INVALID_ROW", "course_title", `Course title differs from the catalogue title “${course.title}”.`, "WARNING"));
    if (course && normalized.creditUnits !== course.creditUnits) rowIssues.push(issue(normalized, "CSV_INVALID_CREDIT_UNITS", "credit_units", `Uploaded credit units differ from the catalogue value ${course.creditUnits}.`, "WARNING"));
    const key = programme && course ? `${programme.id}|${normalized.level}|${course.id}` : undefined;
    if (key) duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), normalized.rowNumber]);
    const existing = key ? offeringByKey.get(key) : undefined;
    rows.push({ ...normalized, programmeId: programme?.id, departmentId: department?.id, courseId: course?.id, existingOfferingId: existing?.id, existingCandidateCount: existing?.candidateCount, status: rowIssues.some((item) => item.severity === "ERROR") ? "INVALID" : existing ? "EXISTING" : "NEW", issues: rowIssues });
  }
  for (const [key, rowNumbers] of duplicateKeys) if (rowNumbers.length > 1) for (const row of rows) if (rowNumbers.includes(row.rowNumber)) row.issues.push(issue(row as NormalizedCourseLoadRow, "CSV_DUPLICATE_OFFERING_ROW", "course_code", `Duplicate logical offering in rows ${rowNumbers.join(", ")}.`));
  const validRows = rows.filter((row) => row.status !== "INVALID" && !row.issues.some((item) => item.severity === "ERROR"));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const domainRows = validRows.filter((row) => row.courseId).map((row) => toDomainRow(row, courseById.get(row.courseId!)!));
  for (const row of domainRows) { row.sessionId = input.academicSessionId; row.semesterId = input.semesterId; }
  const aggregate = aggregateCourseOfferings(domainRows, { defaultExamMode: "PEN_ON_PAPER" });
  const groupMap = new Map<string, DomainCourseOffering[]>();
  for (const row of domainRows) groupMap.set(createAggregationIdentity(row), [...(groupMap.get(createAggregationIdentity(row)) ?? []), row]);
  const aggregateGroups: CourseLoadAggregateGroup[] = [];
  for (const [key, group] of groupMap) {
    const validation = validateExamEventMerge(group, { defaultExamMode: "PEN_ON_PAPER" });
    aggregateGroups.push({ key, canonicalCourseCode: canonicalCourseCodeKey(group[0].courseCode), displayCourseCode: group[0].courseCode, candidateCount: group.reduce((sum, row) => sum + row.candidateCount, 0), offeringCount: group.length, cohortKeys: [...new Set(group.map((row) => createCohortKey(row.programmeId, row.level)))].sort(), status: validation.valid ? "READY_TO_AGGREGATE" : "REQUIRES_REVIEW", diagnostics: [...validation.errors, ...validation.warnings].map((diagnostic) => ({ code: diagnostic.code, severity: diagnostic.severity, message: diagnostic.message })) });
  }
  const summary = { totalRows: parsed.rows.length, validRows: validRows.length, invalidRows: rows.filter((row) => row.issues.some((item) => item.severity === "ERROR")).length, duplicateRows: rows.filter((row) => row.issues.some((item) => item.code === "CSV_DUPLICATE_OFFERING_ROW")).length, newOfferings: validRows.filter((row) => row.status === "NEW").length, existingOfferings: validRows.filter((row) => row.status === "EXISTING").length, updateOfferings: validRows.filter((row) => row.status === "EXISTING").length, unknownProgrammes: rows.filter((row) => row.issues.some((item) => item.code === "CSV_UNKNOWN_PROGRAMME")).length, unknownDepartments: rows.filter((row) => row.issues.some((item) => item.code === "CSV_UNKNOWN_DEPARTMENT")).length, unknownCourses: rows.filter((row) => row.issues.some((item) => item.code === "CSV_UNKNOWN_OFFERING")).length, candidateIssues: rows.filter((row) => row.issues.some((item) => item.code.includes("CANDIDATE"))).length, modeIssues: rows.filter((row) => row.issues.some((item) => item.code.includes("MODE"))).length, durationIssues: rows.filter((row) => row.issues.some((item) => item.code.includes("DURATION"))).length, logicalExams: aggregate.events.length, candidateVolume: domainRows.reduce((sum, row) => sum + row.candidateCount, 0) };
  return { previewHash: hashPreview(canonicalPreviewInput(input.academicSessionId, input.semesterId, rows)), headers: parsed.headers, rows, aggregateGroups, mergeSuggestions: suggestionRows(validRows), summary };
}

async function audit(db: Prisma.TransactionClient, actorId: string, action: string, entity: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue } });
}

async function refreshAutoEvents(db: Prisma.TransactionClient, sessionId: string, semesterId: string, actorId: string) {
  const oldEvents: { id: string }[] = []; // Existing logical event IDs are retained across imports.
  if (oldEvents.length) await db.examEvent.deleteMany({ where: { id: { in: oldEvents.map((event) => event.id) } } });
  const offerings = await db.courseOffering.findMany({ where: { academicSessionId: sessionId, semesterId, active: true, examEvents: { none: {} } }, include: offeringInclude });
  const domain = offerings.map((offering) => courseOfferingToDomain(offering));
  const aggregate = aggregateCourseOfferings(domain, { defaultExamMode: "PEN_ON_PAPER" });
  for (const event of aggregate.events) {
    const created = await db.examEvent.create({ data: { academicSessionId: sessionId, semesterId, title: event.title, examMode: event.examMode, durationMinutes: event.durationMinutes, source: "AUTO_AGGREGATED", status: "DRAFT", createdById: actorId, offerings: { create: event.memberOfferings.map((member) => ({ courseOfferingId: member.id })) } } });
    await audit(db, actorId, "EXAM_EVENT_AUTO_AGGREGATED", "ExamEvent", created.id, { candidateCount: event.candidateCount, offeringCount: event.memberOfferings.length });
  }
  return aggregate;
}

export async function commitCourseLoadImport(input: { fileName: string; academicSessionId: string; semesterId: string; csv: string; previewHash: string; commitMode: "CREATE_NEW" | "UPDATE_EXISTING" }, actorId: string) {
  const preview = await previewCourseLoadImport(input);
  if (preview.previewHash !== input.previewHash) throw new AcademicError("CSV_PREVIEW_MISMATCH", "The uploaded data no longer matches the validated preview. Upload and preview the file again.", {}, 409);
  const hardErrors = preview.rows.flatMap((row) => row.issues.filter((item) => item.severity === "ERROR"));
  if (hardErrors.length) throw new AcademicError("COURSE_LOAD_IMPORT_FAILED", "Fix the validation errors before confirming this import.", { errors: hardErrors }, 400);
  if (input.commitMode === "CREATE_NEW" && preview.summary.existingOfferings) throw new AcademicError("CSV_EXISTING_OFFERING", "The preview contains existing offerings. Choose update existing or remove those rows.", { existingOfferings: preview.summary.existingOfferings }, 409);
  return prisma.$transaction(async (db) => {
    let createdOfferings = 0; let updatedOfferings = 0;
    for (const row of preview.rows.filter((candidate) => candidate.status !== "INVALID")) {
      const offering = await db.courseOffering.upsert({ where: { academicSessionId_semesterId_programmeId_level_courseId: { academicSessionId: input.academicSessionId, semesterId: input.semesterId, programmeId: row.programmeId!, level: row.level, courseId: row.courseId! } }, update: { candidateCount: row.candidateCount, examModeOverride: row.examMode, durationMinutesOverride: row.durationMinutes, active: true, source: "CSV_IMPORT" }, create: { academicSessionId: input.academicSessionId, semesterId: input.semesterId, programmeId: row.programmeId!, level: row.level, courseId: row.courseId!, candidateCount: row.candidateCount, examModeOverride: row.examMode, durationMinutesOverride: row.durationMinutes, active: true, source: "CSV_IMPORT" } });
      if (row.status === "NEW") { createdOfferings += 1; await audit(db, actorId, "COURSE_OFFERING_CREATED", "CourseOffering", offering.id, { source: "CSV_IMPORT", rowNumber: row.rowNumber }); }
      else { updatedOfferings += 1; await audit(db, actorId, "COURSE_OFFERING_UPDATED", "CourseOffering", offering.id, { source: "CSV_IMPORT", rowNumber: row.rowNumber, candidateCount: row.candidateCount }); }
    }
    const aggregate = await refreshAutoEvents(db, input.academicSessionId, input.semesterId, actorId);
    const history = await db.courseLoadImport.create({ data: { fileName: input.fileName, academicSessionId: input.academicSessionId, semesterId: input.semesterId, uploadedBy: actorId, totalRows: preview.summary.totalRows, validRows: preview.summary.validRows, invalidRows: preview.summary.invalidRows, duplicateRows: preview.summary.duplicateRows, createdOfferings, updatedOfferings, status: "COMPLETED", completedAt: new Date() } });
    await audit(db, actorId, "COURSE_LOAD_IMPORT_COMPLETED", "CourseLoadImport", history.id, { totalRows: preview.summary.totalRows, createdOfferings, updatedOfferings, logicalExams: aggregate.events.length });
    return { history, summary: { ...preview.summary, createdOfferings, updatedOfferings, logicalExams: aggregate.events.length } };
  });
}

export async function listCourseLoadHistory() { return prisma.courseLoadImport.findMany({ include: { academicSession: true, semester: true, uploader: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }); }

export async function listAggregateCourseOfferings(filters: { academicSessionId?: string; semesterId?: string; programmeId?: string; level?: number; courseId?: string; examMode?: "PEN_ON_PAPER" | "CBT"; active?: boolean } = {}) {
  return prisma.courseOffering.findMany({ where: filters, include: offeringInclude, orderBy: [{ course: { normalizedCode: "asc" } }, { programmeId: "asc" }, { level: "asc" }] });
}

export async function listAggregateExamEvents(filters: { academicSessionId?: string; semesterId?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED" } = {}) {
  return prisma.examEvent.findMany({ where: filters, include: { offerings: { include: { courseOffering: { include: offeringInclude } } } }, orderBy: [{ title: "asc" }, { createdAt: "desc" }] });
}

export async function unmergeManualExamEvent(id: string, actorId: string) {
  return prisma.$transaction(async (db) => {
    const event = await db.examEvent.findUnique({ where: { id }, select: { id: true, source: true, status: true, active: true } });
    if (!event) throw new AcademicError("EXAM_EVENT_NOT_FOUND", "The exam event was not found.", {}, 404);
    if (event.source !== "MANUAL_MERGE" || event.status !== "DRAFT" || !event.active) throw new AcademicError("EXAM_EVENT_UNMERGE_UNAVAILABLE", "Only active draft manual merges can be undone.", {}, 409);
    await db.examEvent.delete({ where: { id } });
    await audit(db, actorId, "EXAM_EVENT_UNMERGED", "ExamEvent", id);
    return { id };
  });
}

export const COURSE_LOAD_TEMPLATE_HEADERS = COURSE_LOAD_HEADERS;
