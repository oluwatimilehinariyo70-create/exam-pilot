import { z } from "zod";

export const generationRequest = z.object({
  academicSessionId: z.string().trim().min(1),
  semesterId: z.string().trim().min(1),
  examPeriodId: z.string().trim().min(1),
  attempts: z.coerce.number().int().min(1).max(100).optional(),
  seed: z.coerce.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
  schedulingMode: z.enum(["FIXED_SESSIONS", "FLEXIBLE_INTERVALS"]).default("FIXED_SESSIONS"),
});

export type GenerationRequest = z.infer<typeof generationRequest>;

export const plannerMode = z.enum(["WHOLE_MONTH", "CUSTOM_RANGE", "SELECTED_DATES"]);
export const plannerPolicyInput = z.object({ defaultDayStartTime: z.string().regex(/^\d{2}:\d{2}$/), defaultDayEndTime: z.string().regex(/^\d{2}:\d{2}$/), defaultTurnaroundMinutes: z.coerce.number().int().min(0).max(240), writtenTurnaroundMinutes: z.coerce.number().int().min(0).max(240), cbtTurnaroundMinutes: z.coerce.number().int().min(0).max(240), timeGranularityMinutes: z.coerce.number().int().min(5).max(120), weekdays: z.array(z.boolean()).length(7), cbtBatchingEnabled: z.boolean().optional().default(false), cbtMinimumBatchGapMinutes: z.coerce.number().int().min(0).max(240).optional().default(30), cbtMaxBatchesPerDay: z.coerce.number().int().min(1).max(20).nullable().optional(), cbtRequireSameDay: z.boolean().optional().default(true), cbtAllowMultiDay: z.boolean().optional().default(false), cbtPreferMaximumCapacityPerBatch: z.boolean().optional().default(true), cbtMinimumInvigilatorsPerVenue: z.coerce.number().int().min(0).max(10).optional().default(1), cbtMinimumTechnicalSupportPerVenue: z.coerce.number().int().min(0).max(10).optional().default(1), cbtAdditionalSupportPerCandidates: z.coerce.number().int().min(1).max(1000).nullable().optional() });
export const plannerPreviewRequest = z.object({ examPeriodId: z.string().min(1), mode: plannerMode, startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), selectedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(), policy: plannerPolicyInput });
export const plannerSaveRequest = plannerPreviewRequest.extend({ days: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), enabled: z.boolean(), dayType: z.string().min(1).max(40), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), turnaroundMinutesOverride: z.number().int().min(0).max(240).nullable().optional(), blackoutType: z.enum(["PUBLIC_HOLIDAY", "UNIVERSITY_EVENT", "NO_EXAMS", "OTHER"]).nullable().optional(), reason: z.string().max(500).nullable().optional() })).min(1) });

export const editRequest = z.object({ generationId: z.string().min(1), scheduleId: z.string().min(1), operation: z.enum(["MOVE_EXAM", "REASSIGN_VENUES", "REASSIGN_INVIGILATORS"]), targetTimeSlotId: z.string().min(1).optional(), venueIds: z.array(z.string().min(1)).max(20).optional(), invigilatorIds: z.array(z.string().min(1)).max(20).optional(), reason: z.string().trim().max(500).optional() });
export const workflowRequest = z.object({ generationId: z.string().min(1), target: z.enum(["UNDER_REVIEW", "APPROVED"]) });
