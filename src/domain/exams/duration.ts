import type { DurationPolicy, DurationResolution, DurationResolutionInput } from "./types";

function positiveMinutes(value: number | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive whole number of minutes.`);
  return value;
}

function policyDuration(policy: DurationPolicy, input: DurationResolutionInput) {
  const byUnits = input.examMode === "CBT" ? policy.cbtByCreditUnits : policy.penOnPaperByCreditUnits;
  const configured = input.creditUnits === undefined ? undefined : byUnits?.[input.creditUnits];
  if (configured !== undefined) return positiveMinutes(configured, "Configured duration")!;
  return positiveMinutes(input.examMode === "CBT" ? policy.defaultCbtMinutes : policy.defaultPenOnPaperMinutes, "Default duration")!;
}

/** Resolve duration without persistence or institutional defaults. */
export function resolveEffectiveDuration(input: DurationResolutionInput, policy: DurationPolicy): DurationResolution {
  const event = positiveMinutes(input.eventDurationMinutes, "Event duration");
  if (event !== undefined) return { durationMinutes: event, source: "EVENT_OVERRIDE" };
  const offering = positiveMinutes(input.offeringDurationMinutes, "Offering duration");
  if (offering !== undefined) return { durationMinutes: offering, source: "OFFERING_OVERRIDE" };
  const course = positiveMinutes(input.courseDefaultDurationMinutes, "Course default duration");
  if (course !== undefined) return { durationMinutes: course, source: "COURSE_DEFAULT" };
  const configured = input.creditUnits === undefined
    ? undefined
    : (input.examMode === "CBT" ? policy.cbtByCreditUnits : policy.penOnPaperByCreditUnits)?.[input.creditUnits];
  if (configured !== undefined) return { durationMinutes: positiveMinutes(configured, "Configured duration")!, source: "CREDIT_UNIT_POLICY" };
  return { durationMinutes: policyDuration(policy, input), source: "MODE_DEFAULT" };
}
