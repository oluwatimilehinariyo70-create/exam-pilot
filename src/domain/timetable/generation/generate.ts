import { resolveEngineConfig, type TimetableEngineConfig } from "../config";
import { validateHardConstraints } from "../constraints/hard";
import { buildConflictGraph, type ConflictGraph } from "../graph/conflict-graph";
import { orderCourses, courseCandidateCounts } from "../ordering/course-ordering";
import { scoreTimetable } from "../scoring/score";
import type { CandidateTimetable, ConstraintViolation, CourseDiagnostic, ExamAssignment, SchedulingDataset, SlotEvaluation, UnscheduledCourse } from "../types";
import { allocateInvigilators } from "../allocation/invigilators";
import { allocateVenues } from "../allocation/venues";

type MutableState = { assignments: ExamAssignment[]; slotCourses: Map<string, Set<string>>; slotVenues: Map<string, Set<string>>; slotInvigilators: Map<string, Set<string>>; dailyInvigilators: Map<string, number> };

export function generateTimetable(dataset: SchedulingDataset, inputConfig: Partial<TimetableEngineConfig> = {}): CandidateTimetable {
  const config = resolveEngineConfig(inputConfig); let best: CandidateTimetable | null = null;
  for (let attempt = 0; attempt < config.maxGenerationAttempts; attempt += 1) { const candidate = generateAttempt(dataset, config, attempt); if (!best || candidate.hardViolations.length < best.hardViolations.length || (candidate.hardViolations.length === best.hardViolations.length && candidate.softScore < best.softScore)) best = candidate; if (candidate.hardViolations.length === 0 && candidate.unscheduledCourses.length === 0 && attempt === 0) break; }
  return best!;
}

function generateAttempt(dataset: SchedulingDataset, config: TimetableEngineConfig, attempt: number): CandidateTimetable {
  const graph = buildConflictGraph(dataset); const counts = courseCandidateCounts(dataset); const state: MutableState = { assignments: [], slotCourses: new Map(), slotVenues: new Map(), slotInvigilators: new Map(), dailyInvigilators: new Map() }; const unscheduledCourses: UnscheduledCourse[] = [];
  const courses = orderCourses(dataset.courses.filter((course) => course.active), dataset, graph, new Set(), config.seed + attempt);
  for (const course of courses) { const evaluations: SlotEvaluation[] = []; let selected: { assignment: ExamAssignment; evaluation: SlotEvaluation } | null = null; for (const slot of dataset.timeSlots.slice().sort((a, b) => `${a.date}|${a.startTime}|${a.id}`.localeCompare(`${b.date}|${b.startTime}|${b.id}`))) { const evaluation = evaluateSlot(course.id, counts.get(course.id) ?? 0, slot, state, graph, dataset, config); evaluations.push(evaluation); if (!evaluation.feasible) continue; const venue = evaluation.venueAllocation!; const invigilator = evaluation.invigilatorAllocation!; const assignment: ExamAssignment = { courseId: course.id, timeSlotId: slot.id, venues: venue.venueAssignments, invigilators: invigilator.invigilators }; if (!selected || evaluation.softPenalty < selected.evaluation.softPenalty || (evaluation.softPenalty === selected.evaluation.softPenalty && slot.id.localeCompare(selected.assignment.timeSlotId) < 0)) selected = { assignment, evaluation }; }
    if (!selected) { const diagnostics: CourseDiagnostic = { courseId: course.id, candidateCount: counts.get(course.id) ?? 0, conflictingCourses: graph.getConflictingCourses(course.id).map((edge) => ({ courseId: edge.courseAId === course.id ? edge.courseBId : edge.courseAId, sharedStudentCount: edge.sharedStudentCount })), attemptedSlots: evaluations }; unscheduledCourses.push({ courseId: course.id, code: course.code, reason: "NO_FEASIBLE_SLOT", diagnostics }); continue; }
    commitAssignment(selected.assignment, selected.evaluation, state, slotDate(dataset, selected.assignment.timeSlotId));
  }
  const provisional: CandidateTimetable = { assignments: state.assignments, unscheduledCourses, hardViolations: [], softScore: 0, metrics: {} as CandidateTimetable["metrics"] }; provisional.hardViolations = validateHardConstraints(provisional, dataset); const score = scoreTimetable(provisional, dataset, config); provisional.softScore = score.penalty; provisional.metrics = score.metrics; return provisional;
}

function evaluateSlot(courseId: string, candidateCount: number, slot: SchedulingDataset["timeSlots"][number], state: MutableState, graph: ConflictGraph, dataset: SchedulingDataset, config: TimetableEngineConfig): SlotEvaluation {
  const hardViolations: ConstraintViolation[] = graph.getConflictingCourses(courseId).filter((edge) => state.slotCourses.get(slot.id)?.has(edge.courseAId === courseId ? edge.courseBId : edge.courseAId)).map((edge) => ({ code: "STUDENT_CLASH", message: "A conflicting course is already assigned to this slot.", metadata: { courseA: courseId, courseB: edge.courseAId === courseId ? edge.courseBId : edge.courseAId, sharedStudentCount: edge.sharedStudentCount, timeSlot: slot.id } }));
  const venueAllocation = allocateVenues(candidateCount, slot, dataset.venues, dataset.venueUnavailability, state.slotVenues.get(slot.id) ?? new Set(), config.venueSplitPenalty); if (!venueAllocation.success) hardViolations.push({ code: "NO_VENUE_CAPACITY", message: "No available venue combination can seat the registered candidates.", metadata: { courseId, candidateCount, timeSlot: slot.id, reason: venueAllocation.failureReason } });
  const invigilatorAllocation = venueAllocation.success ? allocateInvigilators(slot, venueAllocation.venueAssignments.map((venue) => venue.venueId), dataset.invigilators, dataset.invigilatorUnavailability, state.slotInvigilators.get(slot.id) ?? new Set(), state.dailyInvigilators, config.minimumInvigilatorsPerVenue) : { success: false, invigilators: [], attempted: 0, failureReason: "NO_VENUES" };
  if (!invigilatorAllocation.success) hardViolations.push({ code: "INSUFFICIENT_INVIGILATORS", message: "Not enough available invigilators can cover the selected venues.", metadata: { courseId, timeSlot: slot.id, attempted: invigilatorAllocation.attempted } });
  const softPenalty = venueAllocation.success ? venueAllocation.unusedCapacity * config.venueWastePenaltyWeight + Math.max(0, venueAllocation.venueAssignments.length - 1) * config.venueSplitPenalty : Number.MAX_SAFE_INTEGER;
  return { timeSlotId: slot.id, feasible: hardViolations.length === 0, hardViolations, softPenalty, venueAllocation, invigilatorAllocation };
}

function slotDate(dataset: SchedulingDataset, slotId: string) { return dataset.timeSlots.find((slot) => slot.id === slotId)?.date ?? slotId; }
function commitAssignment(assignment: ExamAssignment, evaluation: SlotEvaluation, state: MutableState, date: string) { state.assignments.push(assignment); const courses = state.slotCourses.get(assignment.timeSlotId) ?? new Set<string>(); courses.add(assignment.courseId); state.slotCourses.set(assignment.timeSlotId, courses); const venues = state.slotVenues.get(assignment.timeSlotId) ?? new Set<string>(); assignment.venues.forEach((venue) => venues.add(venue.venueId)); state.slotVenues.set(assignment.timeSlotId, venues); const invigilators = state.slotInvigilators.get(assignment.timeSlotId) ?? new Set<string>(); assignment.invigilators.forEach((invigilator) => invigilators.add(invigilator.invigilatorId)); state.slotInvigilators.set(assignment.timeSlotId, invigilators); for (const invigilator of assignment.invigilators) state.dailyInvigilators.set(`${invigilator.invigilatorId}|${date}`, (state.dailyInvigilators.get(`${invigilator.invigilatorId}|${date}`) ?? 0) + 1); void evaluation; }
