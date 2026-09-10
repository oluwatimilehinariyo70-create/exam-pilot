import { parseCsv, type CsvRecord } from "@/server/resources/csv";
import { canonicalCourseCodeKey, normalizeCourseDisplayCode } from "@/domain/exams/identity";

export const COURSE_LOAD_HEADERS = [
  "programme",
  "department",
  "level",
  "course_code",
  "course_title",
  "credit_units",
  "candidate_count",
  "exam_mode",
  "duration_minutes",
] as const;

export const COURSE_LOAD_MAX_BYTES = 5_000_000;
export const COURSE_LOAD_MAX_ROWS = 20_000;

export type CourseLoadIssueCode =
  | "CSV_INVALID_ROW"
  | "CSV_INVALID_LEVEL"
  | "CSV_INVALID_CANDIDATE_COUNT"
  | "CSV_INVALID_CREDIT_UNITS"
  | "CSV_INVALID_MODE"
  | "CSV_INVALID_DURATION"
  | "CSV_UNKNOWN_PROGRAMME"
  | "CSV_UNKNOWN_DEPARTMENT"
  | "CSV_UNKNOWN_OFFERING"
  | "CSV_DUPLICATE_OFFERING_ROW"
  | "CSV_UNKNOWN_PROGRAMME"
  | "CSV_UNKNOWN_DEPARTMENT"
  | "CSV_UNKNOWN_OFFERING"
  | "CSV_DUPLICATE_OFFERING_ROW";

export type CourseLoadIssue = {
  rowNumber: number;
  code: CourseLoadIssueCode;
  field: string;
  message: string;
  value?: string;
};

export type NormalizedCourseLoadRow = {
  rowNumber: number;
  programme: string;
  department: string;
  level: number;
  courseCode: string;
  canonicalCourseCode: string;
  courseTitle: string;
  creditUnits: number;
  candidateCount: number;
  examMode?: "PEN_ON_PAPER" | "CBT";
  durationMinutes?: number;
};

export type ParsedCourseLoadRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized?: NormalizedCourseLoadRow;
  issues: CourseLoadIssue[];
};

export type ParsedCourseLoadCsv = {
  headers: string[];
  rows: ParsedCourseLoadRow[];
};

function issue(record: CsvRecord, code: CourseLoadIssueCode, field: string, message: string, value?: string): CourseLoadIssue {
  return { rowNumber: record.rowNumber, code, field, message, value };
}

export function normalizeCourseLoadLevel(value: string): number | undefined {
  const match = value.trim().match(/^(\d{3})\s*(?:L|LEVEL)?$/i);
  if (!match) return undefined;
  const level = Number(match[1]);
  return level >= 100 && level <= 900 && level % 100 === 0 ? level : undefined;
}

export function normalizeExamMode(value: string): "PEN_ON_PAPER" | "CBT" | undefined {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PEN_ON_PAPER" || normalized === "WRITTEN") return "PEN_ON_PAPER";
  if (normalized === "CBT") return "CBT";
  return undefined;
}

function parseWholeNumber(value: string) {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseCourseLoadCsv(text: string): ParsedCourseLoadCsv {
  const parsed = parseCsv(text, COURSE_LOAD_HEADERS, COURSE_LOAD_MAX_BYTES);
  if (parsed.rows.length > COURSE_LOAD_MAX_ROWS) {
    return {
      headers: parsed.headers,
      rows: [{ rowNumber: COURSE_LOAD_MAX_ROWS + 2, raw: {}, issues: [{ rowNumber: COURSE_LOAD_MAX_ROWS + 2, code: "CSV_INVALID_ROW", field: "file", message: `Course-load files cannot exceed ${COURSE_LOAD_MAX_ROWS.toLocaleString()} rows.` }] }],
    };
  }
  return {
    headers: parsed.headers,
    rows: parsed.rows.map((record) => {
      const values = record.values;
      const issues: CourseLoadIssue[] = [];
      const level = normalizeCourseLoadLevel(values.level ?? "");
      if (level === undefined) issues.push(issue(record, "CSV_INVALID_LEVEL", "level", "Level must be 100, 200, 300, 400, 500, or another valid whole hundred.", values.level));
      const creditUnits = parseWholeNumber(values.credit_units ?? "");
      if (creditUnits === undefined || creditUnits < 1 || creditUnits > 12) issues.push(issue(record, "CSV_INVALID_CREDIT_UNITS", "credit_units", "Credit units must be a whole number from 1 to 12.", values.credit_units));
      const candidateCount = parseWholeNumber(values.candidate_count ?? "");
      if (candidateCount === undefined || candidateCount < 0) issues.push(issue(record, "CSV_INVALID_CANDIDATE_COUNT", "candidate_count", "Candidate count must be a non-negative whole number.", values.candidate_count));
      const modeValue = values.exam_mode?.trim() ?? "";
      const examMode = modeValue ? normalizeExamMode(modeValue) : undefined;
      if (modeValue && !examMode) issues.push(issue(record, "CSV_INVALID_MODE", "exam_mode", "Exam mode must be PEN_ON_PAPER, CBT, written, or blank.", modeValue));
      const durationValue = values.duration_minutes?.trim() ?? "";
      const durationMinutes = durationValue ? parseWholeNumber(durationValue) : undefined;
      if (durationValue && (durationMinutes === undefined || durationMinutes <= 0)) issues.push(issue(record, "CSV_INVALID_DURATION", "duration_minutes", "Duration must be a positive whole number of minutes or blank.", durationValue));
      if (!values.programme?.trim()) issues.push(issue(record, "CSV_INVALID_ROW", "programme", "Programme is required."));
      if (!values.department?.trim()) issues.push(issue(record, "CSV_INVALID_ROW", "department", "Department is required."));
      if (!values.course_code?.trim()) issues.push(issue(record, "CSV_INVALID_ROW", "course_code", "Course code is required."));
      if (!values.course_title?.trim()) issues.push(issue(record, "CSV_INVALID_ROW", "course_title", "Course title is required."));
      if (issues.length) return { rowNumber: record.rowNumber, raw: values, issues };
      const courseCode = normalizeCourseDisplayCode(values.course_code);
      return {
        rowNumber: record.rowNumber,
        raw: values,
        issues,
        normalized: {
          rowNumber: record.rowNumber,
          programme: values.programme.trim(),
          department: values.department.trim(),
          level: level!,
          courseCode,
          canonicalCourseCode: canonicalCourseCodeKey(courseCode),
          courseTitle: values.course_title.trim(),
          creditUnits: creditUnits!,
          candidateCount: candidateCount!,
          examMode,
          durationMinutes,
        },
      };
    }),
  };
}

export function csvFormulaSafeValue(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function courseLoadTemplateCsv() {
  const rows: string[][] = [
    [...COURSE_LOAD_HEADERS],
    ["Computer Science", "Computer Science", "200", "PHY202", "Physics II", "2", "150", "PEN_ON_PAPER", "120"],
    ["Mathematics", "Mathematics", "200L", "PHY202", "Physics II", "2", "50", "PEN_ON_PAPER", "120"],
    ["Computer Science", "Computer Science", "200", "CSC202", "Discrete Structures", "3", "180", "PEN_ON_PAPER", "180"],
    ["Mathematics", "Mathematics", "200", "MTH202", "Discrete Mathematics", "3", "120", "PEN_ON_PAPER", "180"],
  ];
  return `${rows.map((row) => row.map((value) => csvFormulaSafeValue(value)).join(",")).join("\r\n")}\r\n`;
}
