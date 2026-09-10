import type { AggregateGenerationConfig } from "./types";

export const DEFAULT_AGGREGATE_GENERATION_CONFIG: AggregateGenerationConfig = {
  maxGenerationAttempts: 20,
  seed: 0,
  minimumInvigilatorsPerVenue: 1,
  maxCohortExamsPerDay: 2,
  cohortBackToBackPenalty: 25,
  cohortDailyOverloadPenalty: 40,
  softConflictPenalty: 60,
  venueWastePenaltyWeight: 0.15,
  venueSplitPenalty: 15,
  invigilatorBalancePenaltyWeight: 2,
  dailyInvigilatorOverloadPenalty: 25,
};

export function resolveAggregateGenerationConfig(input: Partial<AggregateGenerationConfig> = {}): AggregateGenerationConfig {
  return { ...DEFAULT_AGGREGATE_GENERATION_CONFIG, ...input, maxGenerationAttempts: Math.max(1, Math.min(100, input.maxGenerationAttempts ?? DEFAULT_AGGREGATE_GENERATION_CONFIG.maxGenerationAttempts)), maxCohortExamsPerDay: Math.max(1, input.maxCohortExamsPerDay ?? DEFAULT_AGGREGATE_GENERATION_CONFIG.maxCohortExamsPerDay) };
}
