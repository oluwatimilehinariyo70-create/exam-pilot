import { describe, expect, it } from "vitest";

import { courseLoadTemplateCsv, normalizeCourseLoadLevel, normalizeExamMode, parseCourseLoadCsv } from "@/server/exams/course-load-parser";

const header = "programme,department,level,course_code,course_title,credit_units,candidate_count,exam_mode,duration_minutes";

describe("course-load CSV workflow", () => {
  it("parses the canonical template without student identity fields", () => {
    const parsed = parseCourseLoadCsv(courseLoadTemplateCsv());
    expect(parsed.headers).toEqual(["programme", "department", "level", "course_code", "course_title", "credit_units", "candidate_count", "exam_mode", "duration_minutes"]);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows.every((row) => row.normalized)).toBe(true);
  });

  it("normalizes course-load levels and exam modes", () => {
    expect(normalizeCourseLoadLevel("200L")).toBe(200);
    expect(normalizeCourseLoadLevel("200 Level")).toBe(200);
    expect(normalizeCourseLoadLevel("250")).toBeUndefined();
    expect(normalizeExamMode("pen on paper")).toBe("PEN_ON_PAPER");
    expect(normalizeExamMode("written")).toBe("PEN_ON_PAPER");
    expect(normalizeExamMode("CBT")).toBe("CBT");
    expect(normalizeExamMode("online")).toBeUndefined();
  });

  it("rejects malformed candidate, credit, mode, and duration values with row-level issues", () => {
    const parsed = parseCourseLoadCsv(`${header}\nComputer Science,Computer Science,200,PHY202,Physics II,2.5,12.4,online,-5`);
    expect(parsed.rows[0].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["CSV_INVALID_CREDIT_UNITS", "CSV_INVALID_CANDIDATE_COUNT", "CSV_INVALID_MODE", "CSV_INVALID_DURATION"]));
    expect(parsed.rows[0].normalized).toBeUndefined();
  });

  it("accepts extra harmless columns and blank duration", () => {
    const parsed = parseCourseLoadCsv(`${header},notes\nComputer Science,Computer Science,200,PHY-202,Physics II,2,150,PEN_ON_PAPER,,internal`);
    expect(parsed.rows[0].issues).toHaveLength(0);
    expect(parsed.rows[0].normalized).toMatchObject({ courseCode: "PHY-202", candidateCount: 150, durationMinutes: undefined });
  });

  it("does not execute formula-like values", () => {
    const parsed = parseCourseLoadCsv(`${header}\n=Computer Science,Computer Science,200,PHY202,Physics II,2,150,PEN_ON_PAPER,120`);
    expect(parsed.rows[0].normalized?.programme).toBe("=Computer Science");
  });
});
