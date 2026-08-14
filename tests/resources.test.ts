import { describe, expect, it } from "vitest";

import { parseCsv } from "@/server/resources/csv";
import { availabilityInput, courseCodeKey, courseInput, invigilatorInput, studentInput, venueInput } from "@/server/resources/schemas";

describe("Phase 3 resource validation", () => {
  it("normalizes equivalent course codes to one identity key", () => {
    expect(courseCodeKey("csc 401")).toBe("CSC401");
    expect(courseCodeKey("CSC401")).toBe("CSC401");
    expect(courseInput.safeParse({ code: "CSC 401", title: "Algorithms", creditUnits: 3, level: 400, departmentId: "d", semesterId: "s", estimatedStudentCount: 10, active: true, programmeIds: [] }).success).toBe(true);
  });

  it("rejects invalid student levels and venue capacities", () => {
    expect(studentInput.safeParse({ matricNumber: "2024/CSC/001", name: "Sample", programmeId: "p", level: 450, active: true }).success).toBe(false);
    expect(venueInput.safeParse({ name: "Hall", code: "HALL", capacity: 0, active: true }).success).toBe(false);
  });

  it("parses quoted CSV values and reports missing headers", () => {
    const parsed = parseCsv("matric_number,student_name,programme,level,course_code\n2024/CSC/001,\"Student, A\",BSC-CS,400,CSC 401");
    expect(parsed.rows[0]?.values.student_name).toBe("Student, A");
    expect(() => parseCsv("matric_number,student_name\n1,Sample")).toThrow(/Missing required CSV headers/);
  });

  it("validates availability ranges and invigilator workload settings", () => {
    expect(availabilityInput.safeParse({ date: "2027-02-06", startTime: "12:00", endTime: "09:00", reason: "Maintenance" }).success).toBe(false);
    expect(invigilatorInput.safeParse({ name: "Sample Invigilator", maximumDailyAssignments: 3, active: true }).success).toBe(true);
  });
});
