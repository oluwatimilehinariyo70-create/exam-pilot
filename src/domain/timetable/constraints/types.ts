import type { CandidateTimetable, ConstraintViolation, SchedulingDataset } from "../types";

export type ConstraintContext = { timetable: CandidateTimetable; dataset: SchedulingDataset };
export type ConstraintResult = { valid: boolean; code?: string; message?: string; metadata?: Record<string, unknown> };
export interface HardConstraint { id: string; validate(context: ConstraintContext): ConstraintResult; }
export type SoftConstraintScore = { id: string; penalty: number; details: unknown };
export interface SoftConstraint { id: string; evaluate(timetable: CandidateTimetable, dataset: SchedulingDataset): SoftConstraintScore; }
