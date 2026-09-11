import type { ExamConflictGraph, ExamEventConflict } from "../../exams";

export type AggregateExamMode = "PEN_ON_PAPER" | "CBT";
export type AggregateEventSource = "AUTO_AGGREGATED" | "MANUAL_MERGE";
export type AggregateSchedulingMode = "FIXED_SESSIONS" | "FLEXIBLE_INTERVALS";
export type CbtBatchingPolicy = { enabled: boolean; minimumBatchGapMinutes: number; maxBatchesPerDay?: number | null; requireSameDay: boolean; allowMultiDay: boolean; preferMaximumCapacityPerBatch: boolean };
export type CbtStaffingPolicy = { minimumInvigilatorsPerVenue: number; minimumTechnicalSupportPerVenue: number; additionalSupportPerCandidates?: number | null };

export type SchedulingExamEvent = {
  id: string;
  title: string;
  memberCourseCodes: string[];
  candidateCount: number;
  cohortKeys: string[];
  examMode: AggregateExamMode;
  durationMinutes: number;
  source: AggregateEventSource;
  offeringIds: string[];
  members?: { programmeId: string; programmeName: string; level: number; courseCode: string; courseTitle: string }[];
};

export type AggregateTimeSlot = { id: string; examPeriodId: string; date: string; startTime: string; endTime: string };
export type AggregateCalendarDay = { id?: string; examPeriodId: string; date: string; enabled: boolean; dayType: string; startTime: string; endTime: string; turnaroundMinutesOverride?: number | null; blackoutType?: string | null; reason?: string | null };
export type AggregateTimePolicy = { defaultDayStartTime: string; defaultDayEndTime: string; defaultTurnaroundMinutes: number; writtenTurnaroundMinutes: number; cbtTurnaroundMinutes: number; timeGranularityMinutes: number };
export type AggregateVenueCapability = "WRITTEN" | "CBT" | "BOTH";
export type AggregateVenue = { id: string; code: string; name: string; capacity: number; examCapacity?: number | null; computerCapacity?: number | null; usableComputerCapacity?: number | null; capability: AggregateVenueCapability; venueGroup?: string | null; active: boolean };
export type AggregateInvigilator = { id: string; staffId: string | null; name: string; active: boolean; maximumDailyAssignments: number; maximumTotalAssignments?: number | null; role?: string };
export type AggregateUnavailablePeriod = { resourceId: string; date: string; startTime: string; endTime: string; reason?: string | null };

export type AggregateGenerationConfig = {
  maxGenerationAttempts: number;
  seed: number;
  minimumInvigilatorsPerVenue: number;
  maxCohortExamsPerDay: number;
  cohortBackToBackPenalty: number;
  cohortDailyOverloadPenalty: number;
  softConflictPenalty: number;
  venueWastePenaltyWeight: number;
  venueSplitPenalty: number;
  invigilatorBalancePenaltyWeight: number;
  dailyInvigilatorOverloadPenalty: number;
};

export type CbtSittingVenueAssignment = { venueId: string; allocatedCandidates: number; allocatedCapacity: number };
export type CbtSittingStaffAssignment = { staffId: string; assignmentType: "INVIGILATOR" | "TECHNICAL_SUPPORT"; venueId?: string };
export type CbtSitting = { id?: string; eventId: string; sequenceNumber: number; batchLabel?: string; candidateCount: number; date: string; startTime: string; endTime: string; venues: CbtSittingVenueAssignment[]; staff: CbtSittingStaffAssignment[] };
export type CbtBatchPlan = { eventId: string; requiredBatches: number; sittings: CbtSitting[]; diagnostics: AggregateConstraintViolation[] };

export type AggregateSchedulingDataset = {
  session: { id: string; name: string; active: boolean };
  semester: { id: string; sessionId: string; name: string; active: boolean };
  examPeriod: { id: string; sessionId: string; semesterId: string; name: string; startDate: string; endDate: string; active: boolean };
  events: SchedulingExamEvent[];
  timeSlots: AggregateTimeSlot[];
  calendarDays?: AggregateCalendarDay[];
  timePolicy?: AggregateTimePolicy;
  schedulingMode?: AggregateSchedulingMode;
  conflictGraph: ExamConflictGraph;
  venues: AggregateVenue[];
  venueUnavailability: AggregateUnavailablePeriod[];
  invigilators: AggregateInvigilator[];
  invigilatorUnavailability: AggregateUnavailablePeriod[];
  config: AggregateGenerationConfig;
  cbtBatchingPolicy?: CbtBatchingPolicy;
  cbtStaffingPolicy?: CbtStaffingPolicy;
  /** Existing assignments supplied by regeneration so halls can share residual seats. */
  initialVenueUsage?: { slotId?: string; venueId: string; date: string; startTime: string; endTime: string; allocatedCandidates: number; turnaroundMinutes?: number }[];
};

/** A venue row carries both the room's effective capacity and this event's exact seat allocation. */
export type AggregateVenueAssignment = { venueId: string; allocatedCapacity: number; allocatedCandidates?: number | null };
export type AggregateInvigilatorAssignment = { invigilatorId: string; venueId?: string };
export type AggregateExamAssignment = { eventId: string; timeSlotId: string | null; date: string; startTime: string; endTime: string; venues: AggregateVenueAssignment[]; invigilators: AggregateInvigilatorAssignment[] };
export type AggregateConstraintViolation = { code: string; message: string; metadata: Record<string, unknown> };
export type AggregateSlotEvaluation = { eventId: string; timeSlotId: string; date?: string; startTime?: string; endTime?: string; feasible: boolean; hardViolations: AggregateConstraintViolation[]; softPenalty: number; venuePreview?: AggregateVenueAllocation; invigilatorPreview?: AggregateInvigilatorAllocation };
export type AggregateVenueAllocation = { success: boolean; venueAssignments: AggregateVenueAssignment[]; totalCapacity: number; candidateCount: number; unusedCapacity: number; failureCode?: string; failureReason?: string };
export type AggregateInvigilatorAllocation = { success: boolean; invigilators: AggregateInvigilatorAssignment[]; attempted: number; failureCode?: string; failureReason?: string };
export type AggregateEventDiagnostic = { eventId: string; title: string; candidateCount: number; examMode: AggregateExamMode; durationMinutes: number; conflictingEvents: { eventId: string; hard: boolean; weight: number; reasons: unknown[] }[]; attemptedSlots: AggregateSlotEvaluation[] };
export type UnscheduledAggregateEvent = { eventId: string; title: string; reason: "NO_FEASIBLE_SLOT"; diagnostics: AggregateEventDiagnostic };
export type AggregateTimetableMetrics = { totalEvents: number; scheduledEvents: number; unscheduledEvents: number; candidateWorkload: number; penOnPaperEvents: number; cbtEvents: number; hardViolationCount: number; softConflictOverlapCount: number; cohortBackToBackCount: number; cohortDailyOverloadCount: number; averageVenueUtilization: number; totalUnusedCapacity: number; cbtCapacityUtilization: number; venueSplitCount: number; invigilatorDailyOverloadCount: number; invigilatorAssignmentMin: number; invigilatorAssignmentMax: number; invigilatorAssignmentAverage: number; invigilatorWorkloadVariance: number; cbtSittings?: number; batchedCbtEvents?: number; maximumBatchesForEvent?: number; averageBatchesPerCbtEvent?: number; technicalSupportAssignmentCount?: number; technicalSupportWorkloadVariance?: number };
export type AggregateCandidateTimetable = { assignments: AggregateExamAssignment[]; sittings?: CbtSitting[]; unscheduledEvents: UnscheduledAggregateEvent[]; hardViolations: AggregateConstraintViolation[]; softScore: number; metrics: AggregateTimetableMetrics };

export type { ExamEventConflict, ExamConflictGraph };
