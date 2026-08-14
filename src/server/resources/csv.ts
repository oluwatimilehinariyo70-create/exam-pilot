import { AcademicError } from "@/server/academic/errors";

export const REQUIRED_IMPORT_HEADERS = ["matric_number", "student_name", "programme", "level", "course_code"] as const;

export type CsvRecord = { rowNumber: number; values: Record<string, string> };

export function parseCsv(text: string): { headers: string[]; rows: CsvRecord[] } {
  if (text.length > 10_000_000) throw new AcademicError("CSV_TOO_LARGE", "CSV files must be smaller than 10 MB.", {}, 413);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else { quoted = !quoted; } continue; }
    if (!quoted && (char === "," || char === "\n" || char === "\r")) { if (char === "\r" && text[index + 1] === "\n") index += 1; row.push(cell.trim()); cell = ""; if (char !== ",") { records.push(row); row = []; } continue; }
    cell += char;
  }
  if (quoted) throw new AcademicError("CSV_INVALID_ROW", "The CSV contains an unclosed quoted value.");
  if (cell.length || row.length) { row.push(cell.trim()); records.push(row); }
  const headers = (records.shift() ?? []).map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  const missing = REQUIRED_IMPORT_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new AcademicError("CSV_INVALID_HEADERS", `Missing required CSV headers: ${missing.join(", ")}.`, { missing });
  return { headers, rows: records.filter((values) => values.some(Boolean)).map((values, index) => ({ rowNumber: index + 2, values: Object.fromEntries(headers.map((header, headerIndex) => [header, (values[headerIndex] ?? "").trim()]) ) })) };
}
