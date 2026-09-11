import { z } from "zod";
import { canonicalCourseCodeKey, normalizeCourseDisplayCode } from "@/domain/exams/identity";

const id = z.string().trim().min(1);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value, "Enter a real calendar date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm.");
const level = z.coerce.number().int().min(100).max(999).refine((value) => value % 100 === 0, "Level must be a valid academic level such as 100, 200, or 400.");

export const courseInput = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/),
  title: z.string().trim().min(2).max(180),
  creditUnits: z.coerce.number().int().min(1).max(12),
  level,
  departmentId: id,
  semesterId: id,
  estimatedStudentCount: z.coerce.number().int().min(0).max(100000).default(0),
  active: z.boolean().default(true),
  programmeIds: z.array(id).default([]),
});

export const studentInput = z.object({
  matricNumber: z.string().trim().min(2).max(60),
  name: z.string().trim().max(160).optional().or(z.literal("")),
  programmeId: id,
  level,
  active: z.boolean().default(true),
});

export const registrationInput = z.object({ studentId: id, courseId: id, sessionId: id, semesterId: id });
export const availabilityInput = z.object({ date: dateOnly, startTime: time, endTime: time, reason: z.string().trim().max(240).optional().or(z.literal("")) }).refine((value) => value.endTime > value.startTime, { message: "End time must be after start time.", path: ["endTime"] });
export const venueInput = z.object({ name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/), location: z.string().trim().max(160).optional().or(z.literal("")), capacity: z.coerce.number().int().min(1).max(100000), examCapacity: z.coerce.number().int().min(1).max(100000).optional(), active: z.boolean().default(true) }).superRefine((value, ctx) => { if (value.examCapacity != null && value.examCapacity > value.capacity) ctx.addIssue({ code: "too_big", maximum: value.capacity, type: "number", inclusive: true, path: ["examCapacity"], message: "Usable written capacity cannot exceed official capacity." }); });
export const invigilatorInput = z.object({ staffId: z.string().trim().max(60).optional().or(z.literal("")), name: z.string().trim().min(2).max(160), email: z.string().trim().email().optional().or(z.literal("")), departmentId: id.optional().or(z.literal("")), active: z.boolean().default(true), maximumDailyAssignments: z.coerce.number().int().min(1).max(20).default(2) });

export const resourceListQuery = z.object({ q: z.string().trim().max(100).optional(), active: z.enum(["true", "false", "all"]).default("all"), collegeId: id.optional(), departmentId: id.optional(), programmeId: id.optional(), semesterId: id.optional(), sessionId: id.optional(), courseId: id.optional(), studentId: id.optional(), level: z.coerce.number().int().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });

export const importRequest = z.object({ fileName: z.string().trim().min(1).max(200).refine((value) => value.toLowerCase().endsWith(".csv"), "Only .csv files are supported."), sessionId: id, semesterId: id, csv: z.string().max(10_000_000) });
export const importConfirmRequest = z.object({ fileName: z.string().trim().min(1).max(200), sessionId: id, semesterId: id, rows: z.array(z.object({ matricNumber: z.string(), name: z.string().optional(), programmeId: id, level: z.number().int(), courseId: id, rowNumber: z.number().int() })).max(10000), duplicateRows: z.number().int().min(0), totalRows: z.number().int().min(0), invalidRows: z.number().int().min(0), confirm: z.literal(true) });

export type CourseInput = z.infer<typeof courseInput>;
export type StudentInput = z.infer<typeof studentInput>;
export type RegistrationInput = z.infer<typeof registrationInput>;
export type AvailabilityInput = z.infer<typeof availabilityInput>;
export type VenueInput = z.infer<typeof venueInput>;
export type InvigilatorInput = z.infer<typeof invigilatorInput>;
export type ImportRequest = z.infer<typeof importRequest>;
export type ImportConfirmRequest = z.infer<typeof importConfirmRequest>;

export function normalizeCourseCode(value: string) { return normalizeCourseDisplayCode(value); }
export function courseCodeKey(value: string) { return canonicalCourseCodeKey(value); }
export function normalizeMatricNumber(value: string) { return value.trim(); }
export function dateValue(value: string) { return new Date(`${value}T00:00:00.000Z`); }
export function timeToMinutes(value: string) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }
export function activeWhere(active: "true" | "false" | "all") { return active === "all" ? {} : { active: active === "true" }; }
