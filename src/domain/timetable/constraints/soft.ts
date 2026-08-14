import type { TimetableEngineConfig } from "../config";
import type { CandidateTimetable, SchedulingDataset } from "../types";
import type { SoftConstraintScore } from "./types";

export function evaluateSoftConstraints(timetable: CandidateTimetable, dataset: SchedulingDataset, config: TimetableEngineConfig): SoftConstraintScore[] {
  const metrics = timetable.metrics;
  return [
    { id: "STUDENT_BACK_TO_BACK", penalty: metrics.studentBackToBackCount * config.studentBackToBackPenalty, details: { count: metrics.studentBackToBackCount } },
    { id: "STUDENT_DAILY_OVERLOAD", penalty: metrics.studentDailyOverloadCount * config.studentDailyOverloadPenalty, details: { count: metrics.studentDailyOverloadCount, threshold: config.maxStudentExamsPerDay } },
    { id: "VENUE_WASTE", penalty: metrics.totalUnusedSeats * config.venueWastePenaltyWeight, details: { unusedSeats: metrics.totalUnusedSeats } },
    { id: "VENUE_SPLITTING", penalty: metrics.venueSplitCount * config.venueSplitPenalty, details: { splitCount: metrics.venueSplitCount } },
    { id: "INVIGILATOR_BALANCE", penalty: metrics.invigilatorWorkloadVariance * config.invigilatorBalancePenaltyWeight, details: { variance: metrics.invigilatorWorkloadVariance } },
    { id: "INVIGILATOR_DAILY_OVERLOAD", penalty: 0, details: { configured: true } },
    { id: "EXAM_DISTRIBUTION", penalty: Math.max(0, (dataset.timeSlots.length - 1) / 2 - timetable.assignments.length), details: { configured: true } },
  ];
}
