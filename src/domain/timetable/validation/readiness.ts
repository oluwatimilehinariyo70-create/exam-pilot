import { buildConflictGraph } from "../graph/conflict-graph";
import type { GenerationReadiness, ReadinessIssue, SchedulingDataset } from "../types";

function issue(code: string, message: string, metadata: Record<string, unknown> = {}): ReadinessIssue { return { code, message, metadata }; }

export function validateGenerationReadiness(dataset: SchedulingDataset): GenerationReadiness {
  const blockers: ReadinessIssue[] = []; const warnings: ReadinessIssue[] = [];
  const graph = buildConflictGraph(dataset); const totalVenueCapacity = dataset.venues.filter((venue) => venue.active).reduce((sum, venue) => sum + venue.capacity, 0);
  if (!dataset.courses.length) blockers.push(issue("NO_COURSES", "No courses are available for generation."));
  if (!dataset.timeSlots.length) blockers.push(issue("NO_TIME_SLOTS", "No examination time slots are configured."));
  if (!dataset.venues.filter((venue) => venue.active).length) blockers.push(issue("NO_VENUES", "No active venues are available."));
  if (!dataset.invigilators.filter((invigilator) => invigilator.active).length) blockers.push(issue("NO_INVIGILATORS", "No active invigilators are available."));
  if (!dataset.registrations.length) blockers.push(issue("NO_REGISTRATIONS", "No course registrations are available."));
  if (dataset.courses.some((course) => dataset.registrations.filter((registration) => registration.courseId === course.id).length > totalVenueCapacity)) blockers.push(issue("COURSE_EXCEEDS_TOTAL_VENUE_CAPACITY", "At least one course exceeds the total active venue capacity.", { totalVenueCapacity }));
  if (!dataset.examPeriod.active || !dataset.timeSlots.every((slot) => slot.examPeriodId === dataset.examPeriod.id)) blockers.push(issue("INVALID_EXAM_PERIOD", "The selected examination period or its time slots are invalid."));
  const courseCounts = new Map(dataset.registrations.map((registration) => [registration.courseId, 0]));
  for (const registration of dataset.registrations) courseCounts.set(registration.courseId, (courseCounts.get(registration.courseId) ?? 0) + 1);
  for (const course of dataset.courses) if (!courseCounts.get(course.id)) warnings.push(issue("COURSE_WITHOUT_REGISTRATIONS", `${course.code} has no registrations.`, { courseId: course.id }));
  for (const invigilator of dataset.invigilators) if (!dataset.invigilatorUnavailability.some((period) => period.resourceId === invigilator.id)) warnings.push(issue("INVIGILATOR_WITHOUT_AVAILABILITY", `${invigilator.name} has no availability restrictions configured.`, { invigilatorId: invigilator.id }));
  for (const venue of dataset.venues) if (!venue.name) warnings.push(issue("VENUE_WITHOUT_LOCATION", `${venue.code} has incomplete venue information.`, { venueId: venue.id }));
  const possiblePairs = Math.max(1, (dataset.courses.length * (dataset.courses.length - 1)) / 2); const conflictDensity = graph.edges.length / possiblePairs;
  if (conflictDensity > 0.25) warnings.push(issue("HIGH_CONFLICT_DENSITY", "The course conflict graph is dense and may require more time slots.", { conflictDensity }));
  if (dataset.invigilators.filter((invigilator) => invigilator.active).length < dataset.venues.filter((venue) => venue.active).length) warnings.push(issue("LOW_INVIGILATOR_COUNT", "There are fewer active invigilators than active venues."));
  return { ready: blockers.length === 0, blockers, warnings, summary: { courses: dataset.courses.length, students: dataset.students.length, registrations: dataset.registrations.length, timeSlots: dataset.timeSlots.length, venues: dataset.venues.length, totalVenueCapacity, invigilators: dataset.invigilators.length, conflictEdges: graph.edges.length, conflictDensity } };
}
