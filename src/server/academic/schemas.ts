import { z } from "zod";

const id = z.string().trim().min(1, "A record is required.");
const code = z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, "Use letters, numbers, and hyphens only.");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").refine((value) => { const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Enter a real calendar date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm time.");

export const collegeInput = z.object({ name: z.string().trim().min(2).max(120), code, active: z.boolean().optional().default(true) });
export const departmentInput = z.object({ collegeId: id, name: z.string().trim().min(2).max(120), code, active: z.boolean().optional().default(true) });
export const programmeInput = z.object({ departmentId: id, name: z.string().trim().min(2).max(160), code, active: z.boolean().optional().default(true) });
export const sessionInput = z.object({
  name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Use the format YYYY/YYYY."),
  startYear: z.coerce.number().int().min(2000).max(2200),
  endYear: z.coerce.number().int().min(2001).max(2201),
  active: z.boolean().optional().default(false),
}).refine((value) => value.endYear === value.startYear + 1, { message: "End year must be one year after start year.", path: ["endYear"] }).refine((value) => value.name === `${value.startYear}/${value.endYear}`, { message: "Session name must match the start and end years.", path: ["name"] });
export const semesterInput = z.object({ academicSessionId: id, name: z.string().trim().min(2).max(80), semesterNumber: z.coerce.number().int().min(1).max(3), active: z.boolean().optional().default(true) });
export const examPeriodInput = z.object({ sessionId: id, semesterId: id, name: z.string().trim().min(3).max(160), startDate: dateOnly, endDate: dateOnly, active: z.boolean().optional().default(true), cbtBatchingEnabled: z.boolean().optional(), cbtMinimumBatchGapMinutes: z.coerce.number().int().min(0).max(240).optional(), cbtMaxBatchesPerDay: z.coerce.number().int().min(1).max(20).nullable().optional(), cbtRequireSameDay: z.boolean().optional(), cbtAllowMultiDay: z.boolean().optional(), cbtPreferMaximumCapacityPerBatch: z.boolean().optional(), cbtMinimumInvigilatorsPerVenue: z.coerce.number().int().min(0).max(10).optional(), cbtMinimumTechnicalSupportPerVenue: z.coerce.number().int().min(0).max(10).optional(), cbtAdditionalSupportPerCandidates: z.coerce.number().int().min(1).max(1000).nullable().optional() }).refine((value) => value.endDate >= value.startDate, { message: "End date must be on or after start date.", path: ["endDate"] });
export const timeSlotInput = z.object({ examPeriodId: id, date: dateOnly, startTime: time, endTime: time }).refine((value) => value.endTime > value.startTime, { message: "End time must be after start time.", path: ["endTime"] });

export const bulkTimeSlotInput = z.object({
  examPeriodId: id,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  dailySessions: z.array(z.object({ startTime: time, endTime: time }).refine((value) => value.endTime > value.startTime, { message: "End time must be after start time.", path: ["endTime"] })).min(1),
  excludedDates: z.array(dateOnly).default([]),
  skipWeekends: z.boolean().default(true),
});

export const listQuery = z.object({ q: z.string().trim().max(100).optional(), active: z.enum(["true", "false", "all"]).default("all"), collegeId: id.optional(), departmentId: id.optional(), sessionId: id.optional(), periodId: id.optional() });

export type CollegeInput = z.infer<typeof collegeInput>;
export type DepartmentInput = z.infer<typeof departmentInput>;
export type ProgrammeInput = z.infer<typeof programmeInput>;
export type SessionInput = z.infer<typeof sessionInput>;
export type SemesterInput = z.infer<typeof semesterInput>;
export type ExamPeriodInput = z.infer<typeof examPeriodInput>;
export type TimeSlotInput = z.infer<typeof timeSlotInput>;
export type BulkTimeSlotInput = z.infer<typeof bulkTimeSlotInput>;

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
