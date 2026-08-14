import { z } from "zod";

export const generationRequest = z.object({
  academicSessionId: z.string().trim().min(1),
  semesterId: z.string().trim().min(1),
  examPeriodId: z.string().trim().min(1),
  attempts: z.coerce.number().int().min(1).max(100).optional(),
  seed: z.coerce.number().int().min(-2_147_483_648).max(2_147_483_647).optional(),
});

export type GenerationRequest = z.infer<typeof generationRequest>;

export const editRequest = z.object({ generationId: z.string().min(1), scheduleId: z.string().min(1), operation: z.enum(["MOVE_EXAM", "REASSIGN_VENUES", "REASSIGN_INVIGILATORS"]), targetTimeSlotId: z.string().min(1).optional(), venueIds: z.array(z.string().min(1)).max(20).optional(), invigilatorIds: z.array(z.string().min(1)).max(20).optional(), reason: z.string().trim().max(500).optional() });
export const workflowRequest = z.object({ generationId: z.string().min(1), target: z.enum(["UNDER_REVIEW", "APPROVED"]) });
