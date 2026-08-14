import { describe, expect, it } from "vitest";

import { canManageAcademicResource, canManageTimetable, canManageUsers, canPublishTimetable } from "@/lib/roles";

describe("role authorization policy", () => {
  it("allows examination officers to manage timetable work", () => {
    expect(canManageTimetable("EXAM_OFFICER")).toBe(true);
    expect(canPublishTimetable("EXAM_OFFICER")).toBe(false);
  });

  it("limits user administration to administrative roles", () => {
    expect(canManageUsers("SUPER_ADMIN")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("VIEWER")).toBe(false);
  });

  it("keeps viewers read-only", () => {
    expect(canManageTimetable("VIEWER")).toBe(false);
    expect(canPublishTimetable("VIEWER")).toBe(false);
  });

  it("allows examination officers to manage only examination configuration", () => {
    expect(canManageAcademicResource("EXAM_OFFICER", "examination")).toBe(true);
    expect(canManageAcademicResource("EXAM_OFFICER", "institutional")).toBe(false);
    expect(canManageAcademicResource("VIEWER", "examination")).toBe(false);
  });
});
