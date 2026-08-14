import { validateHardConstraints } from "../constraints/hard";
import type { CandidateTimetable, SchedulingDataset, TimetableValidationResult } from "../types";

export function validateTimetable(timetable: CandidateTimetable, dataset: SchedulingDataset): TimetableValidationResult { const violations = validateHardConstraints(timetable, dataset); return { valid: violations.length === 0, violations }; }
