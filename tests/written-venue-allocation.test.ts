import { describe, expect, it } from "vitest";
import { allocateAggregateVenues } from "@/domain/timetable/aggregate/allocation";
import type { AggregateTimeSlot, AggregateVenue } from "@/domain/timetable/aggregate/types";

const slot: AggregateTimeSlot = { id: "slot", examPeriodId: "period", date: "2026-01-10", startTime: "09:00", endTime: "12:00" };
const none: never[] = [];
function venue(id: string, capacity: number, examCapacity = capacity): AggregateVenue { return { id, code: id, name: id, capacity, examCapacity, capability: "WRITTEN", active: true }; }
function allocate(count: number, halls: AggregateVenue[], used = new Map<string, number>()) { return allocateAggregateVenues(count, "PEN_ON_PAPER", slot, halls, none, used, 10); }

describe("written venue seat allocation", () => {
  it("shares LLT1 across compatible events and reports exact remaining seats", () => {
    const halls = [venue("LLT1", 300)]; const used = new Map<string, number>();
    for (const count of [120, 70, 45]) { const result = allocate(count, halls, used); expect(result.success).toBe(true); const row = result.venueAssignments[0]!; used.set(row.venueId, (used.get(row.venueId) ?? 0) + row.allocatedCandidates!); }
    expect(used.get("LLT1")).toBe(235); expect(300 - used.get("LLT1")!).toBe(65);
  });

  it("packs 240 and 60 candidates into a 300-seat hall without overfill", () => {
    const halls = [venue("LLT1", 300)]; const used = new Map<string, number>();
    for (const count of [240, 60]) { const result = allocate(count, halls, used); expect(result.success).toBe(true); const row = result.venueAssignments[0]!; used.set(row.venueId, (used.get(row.venueId) ?? 0) + row.allocatedCandidates!); }
    expect(used.get("LLT1")).toBe(300);
  });

  it("uses residual capacity and a second hall instead of overfilling", () => {
    const result = allocate(70, [venue("LLT1", 300), venue("S1", 60)], new Map([["LLT1", 240]]));
    expect(result.success).toBe(true); expect(result.venueAssignments).toHaveLength(2); expect(result.venueAssignments.reduce((sum, row) => sum + (row.allocatedCandidates ?? 0), 0)).toBe(70); expect(result.venueAssignments.find((row) => row.venueId === "LLT1")?.allocatedCandidates).toBeLessThanOrEqual(60);
  });

  it("splits a 450-candidate event exactly across LLT1 and Navates 2", () => {
    const result = allocate(450, [venue("LLT1", 300), venue("NAVATES2", 160)]);
    expect(result.success).toBe(true); expect(result.venueAssignments.map((row) => row.venueId)).toEqual(["LLT1", "NAVATES2"]); expect(result.venueAssignments.reduce((sum, row) => sum + (row.allocatedCandidates ?? 0), 0)).toBe(450);
  });

  it("enforces usable operational capacity below official capacity", () => {
    expect(allocate(281, [venue("LLT1", 300, 280)]).success).toBe(false);
    expect(allocate(280, [venue("LLT1", 300, 280)]).venueAssignments[0]?.allocatedCandidates).toBe(280);
  });

  it("conserves candidates and is deterministic for identical inputs", () => {
    const halls = [venue("NSC", 200), venue("CAFE", 180), venue("LLT1", 300)];
    const first = allocate(450, halls); const second = allocate(450, halls);
    expect(first).toEqual(second); expect(first.venueAssignments.reduce((sum, row) => sum + (row.allocatedCandidates ?? 0), 0)).toBe(450);
  });
});
