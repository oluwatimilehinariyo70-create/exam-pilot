import { describe, expect, it } from "vitest";
import { editRequest, workflowRequest } from "@/server/timetable/schemas";

describe("timetable review request schemas", () => {
  it("accepts a move operation with a reason", () => {
    const result = editRequest.safeParse({
      generationId: "generation-1",
      scheduleId: "schedule-1",
      operation: "MOVE_EXAM",
      targetTimeSlotId: "slot-2",
      reason: "Avoid a student conflict identified during review",
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed edit identifiers and unsupported operations", () => {
    const result = editRequest.safeParse({
      generationId: "",
      scheduleId: "schedule-1",
      operation: "DELETE_EXAM",
    });

    expect(result.success).toBe(false);
  });

  it("restricts workflow transitions to review and approval", () => {
    expect(workflowRequest.safeParse({ generationId: "generation-1", target: "UNDER_REVIEW" }).success).toBe(true);
    expect(workflowRequest.safeParse({ generationId: "generation-1", target: "DRAFT" }).success).toBe(false);
  });
});
