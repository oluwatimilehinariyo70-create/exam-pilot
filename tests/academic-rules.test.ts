import { describe, expect, it } from "vitest";

import { hasOverlappingSlots } from "@/server/academic/rules";
import { examPeriodInput, sessionInput, timeSlotInput } from "@/server/academic/schemas";

describe("academic setup validation", () => {
  it("requires consecutive academic years", () => {
    expect(sessionInput.safeParse({ name: "2026/2027", startYear: 2026, endYear: 2027, active: true }).success).toBe(true);
    expect(sessionInput.safeParse({ name: "2026/2028", startYear: 2026, endYear: 2028, active: true }).success).toBe(false);
  });

  it("rejects examination periods whose end date precedes their start", () => {
    expect(examPeriodInput.safeParse({ sessionId: "session", semesterId: "semester", name: "First semester exams", startDate: "2027-02-10", endDate: "2027-02-01", active: true }).success).toBe(false);
  });

  it("accepts valid time ranges and rejects reversed ranges", () => {
    expect(timeSlotInput.safeParse({ examPeriodId: "period", date: "2027-02-01", startTime: "09:00", endTime: "12:00" }).success).toBe(true);
    expect(timeSlotInput.safeParse({ examPeriodId: "period", date: "2027-02-01", startTime: "14:00", endTime: "09:00" }).success).toBe(false);
  });

  it("detects overlaps only on the same date", () => {
    expect(hasOverlappingSlots([{ date: new Date("2027-02-01T00:00:00Z"), startTime: "09:00", endTime: "12:00" }, { date: new Date("2027-02-01T00:00:00Z"), startTime: "11:00", endTime: "14:00" }])).toBe(true);
    expect(hasOverlappingSlots([{ date: new Date("2027-02-01T00:00:00Z"), startTime: "09:00", endTime: "12:00" }, { date: new Date("2027-02-02T00:00:00Z"), startTime: "09:00", endTime: "12:00" }])).toBe(false);
  });
});
