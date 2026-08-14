export type TimetableEngineConfig = {
  maxStudentExamsPerDay: number;
  studentBackToBackPenalty: number;
  studentDailyOverloadPenalty: number;
  venueWastePenaltyWeight: number;
  venueSplitPenalty: number;
  invigilatorBalancePenaltyWeight: number;
  dailyInvigilatorOverloadPenalty: number;
  minimumInvigilatorsPerVenue: number;
  maxGenerationAttempts: number;
  seed: number;
};

export const DEFAULT_ENGINE_CONFIG: TimetableEngineConfig = {
  maxStudentExamsPerDay: 2,
  studentBackToBackPenalty: 20,
  studentDailyOverloadPenalty: 35,
  venueWastePenaltyWeight: 0.15,
  venueSplitPenalty: 15,
  invigilatorBalancePenaltyWeight: 2,
  dailyInvigilatorOverloadPenalty: 25,
  minimumInvigilatorsPerVenue: 1,
  maxGenerationAttempts: 20,
  seed: 0,
};

export function resolveEngineConfig(input: Partial<TimetableEngineConfig> = {}): TimetableEngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG, ...input, maxGenerationAttempts: Math.max(1, Math.min(100, input.maxGenerationAttempts ?? DEFAULT_ENGINE_CONFIG.maxGenerationAttempts)) };
}
