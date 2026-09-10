import { z } from "zod";
import { timeToMinutes } from "@/domain/timetable/intervals";
const id = z.string().trim().min(1).max(200);
const date = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, "A real calendar date is required.");
const time = z.string().refine((s) => Number.isFinite(timeToMinutes(s)), "A valid HH:mm time is required.");
export const revisionActionSchema = z.object({
  generationId: id, expectedVersion: z.number().int().nonnegative(),
  action: z.enum(["PIN", "UNPIN", "REGENERATE_SELECTED", "REGENERATE_UNRESOLVED", "ADD_LATE_COURSES", "CREATE_REVISION", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "SUPERSEDED"]),
  reason: z.string().trim().min(1).max(500), eventId: id.optional(), eventIds: z.array(id).max(500).optional(),
  placement: z.object({ date, startTime: time, endTime: time, timeSlotId: id.nullable(), venueIds: z.array(id).min(1).max(20) }).optional(),
}).strict();
export type RevisionAction = z.infer<typeof revisionActionSchema>;
