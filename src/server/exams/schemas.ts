import { z } from "zod";

const id = z.string().trim().min(1);
const mode = z.enum(["PEN_ON_PAPER", "CBT"]);
const level = z.coerce.number().int().min(100).max(900).refine((value) => value % 100 === 0, "Level must be a valid whole hundred.");

export const courseLoadPreviewRequest = z.object({
  fileName: z.string().trim().min(1).max(200).regex(/\.csv$/i, "Only .csv files are supported."),
  academicSessionId: id,
  semesterId: id,
  csv: z.string().min(1).max(5_000_000),
});

export const courseLoadConfirmRequest = courseLoadPreviewRequest.extend({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/i),
  commitMode: z.enum(["CREATE_NEW", "UPDATE_EXISTING"]).default("UPDATE_EXISTING"),
});

export const courseOfferingMutation = z.object({
  academicSessionId: id,
  semesterId: id,
  courseId: id,
  programmeId: id,
  level,
  candidateCount: z.coerce.number().int().min(0).max(100_000),
  examModeOverride: mode.optional().nullable(),
  durationMinutesOverride: z.coerce.number().int().positive().max(1_440).optional().nullable(),
  active: z.boolean().default(true),
});

export const courseOfferingUpdate = courseOfferingMutation.partial().extend({
  candidateCount: z.coerce.number().int().min(0).max(100_000).optional(),
  level: level.optional(),
});

export const courseOfferingListQuery = z.object({
  academicSessionId: id.optional(),
  semesterId: id.optional(),
  programmeId: id.optional(),
  courseId: id.optional(),
  level: z.coerce.number().int().optional(),
  examMode: mode.optional(),
  active: z.enum(["true", "false", "all"]).default("all"),
});

export const examEventListQuery = z.object({ academicSessionId: id.optional(), semesterId: id.optional(), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional() });

export const manualMergeRequest = z.object({ offeringIds: z.array(id).min(2).max(50), reason: z.string().trim().min(3).max(500) });

const conflictSeverity = z.enum(["HARD", "SOFT"]);
const conflictType = z.enum(["CARRYOVER", "ELECTIVE_OVERLAP", "DEPARTMENT_RULE", "MANUAL"]);

export const explicitConflictCreate = z.object({
  academicSessionId: id,
  semesterId: id,
  courseAId: id,
  courseBId: id,
  severity: conflictSeverity,
  type: conflictType,
  estimatedSharedCandidates: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const explicitConflictUpdate = explicitConflictCreate.omit({ academicSessionId: true, semesterId: true, courseAId: true, courseBId: true }).partial();
export const explicitConflictListQuery = z.object({ academicSessionId: id, semesterId: id, active: z.enum(["true", "false", "all"]).default("true") });
export const aggregateReadinessQuery = z.object({ academicSessionId: id.optional(), semesterId: id.optional() });

export type CourseLoadPreviewRequest = z.infer<typeof courseLoadPreviewRequest>;
export type CourseLoadConfirmRequest = z.infer<typeof courseLoadConfirmRequest>;
export type CourseOfferingMutation = z.infer<typeof courseOfferingMutation>;
export type ExplicitConflictCreate = z.infer<typeof explicitConflictCreate>;
export type ExplicitConflictUpdate = z.infer<typeof explicitConflictUpdate>;
