import { createCohortKey } from "./identity";
import type { ExamEvent } from "./types";

export type ExamConflictReasonType =
  | "COHORT_OVERLAP"
  | "EXPLICIT_HARD_CONFLICT"
  | "EXPLICIT_SOFT_CONFLICT"
  | "INDIVIDUAL_REGISTRATION_OVERLAP";

export type ExamConflictReason = {
  type: ExamConflictReasonType;
  label: string;
  cohortKey?: string;
  programmeId?: string;
  programmeName?: string;
  level?: number;
  candidateCount?: number;
  conflictId?: string;
  conflictType?: string;
  courseAId?: string;
  courseBId?: string;
  studentCount?: number;
  estimatedSharedCandidates?: number;
  detail?: string;
};

export type EventCohortPopulation = {
  cohortKey: string;
  programmeId: string;
  programmeName: string;
  level: number;
  candidateCount: number;
};

export type ExplicitEventConflict = {
  id: string;
  eventAId: string;
  eventBId: string;
  hard: boolean;
  conflictType: string;
  courseAId?: string;
  courseBId?: string;
  estimatedSharedCandidates?: number;
  reason?: string;
};

export type StudentEventOverlap = {
  eventAId: string;
  eventBId: string;
  sharedStudentCount: number;
  courseAId?: string;
  courseBId?: string;
};

export type ExamEventConflict = {
  eventAId: string;
  eventBId: string;
  hard: boolean;
  reasons: ExamConflictReason[];
  /** Deterministic scheduling weight; this is not necessarily a unique-student count. */
  weight: number;
};

export type ConflictGraphMetrics = {
  events: number;
  edges: number;
  maximumPossibleEdges: number;
  density: number;
  averageDegree: number;
  maximumDegree: number;
  weightedConflictTotal: number;
  maximumWeightedDegree: number;
};

export type ExamConflictGraph = {
  eventIds: string[];
  edges: ExamEventConflict[];
  cohortPopulations: Record<string, EventCohortPopulation[]>;
  metrics: ConflictGraphMetrics;
};

const reasonLabels: Record<ExamConflictReasonType, string> = {
  COHORT_OVERLAP: "Same programme/level cohort",
  EXPLICIT_HARD_CONFLICT: "Known hard conflict",
  EXPLICIT_SOFT_CONFLICT: "Known soft conflict",
  INDIVIDUAL_REGISTRATION_OVERLAP: "Individual registration overlap",
};

export function getConflictReasonLabel(type: ExamConflictReasonType) { return reasonLabels[type]; }

export function getSharedCohorts(first: ExamEvent, second: ExamEvent) {
  const secondCohorts = new Set(second.cohortKeys);
  return [...new Set(first.cohortKeys.filter((cohort) => secondCohorts.has(cohort)))].sort();
}

export function eventsShareCohort(first: ExamEvent, second: ExamEvent) { return getSharedCohorts(first, second).length > 0; }

function eventCohortPopulation(event: ExamEvent): EventCohortPopulation[] {
  const byKey = new Map<string, EventCohortPopulation>();
  for (const offering of event.memberOfferings) {
    const cohortKey = createCohortKey(offering.programmeId, offering.level);
    const existing = byKey.get(cohortKey);
    // A manually merged event may have multiple offerings from one cohort. The
    // maximum is a deterministic effective population and avoids double counting.
    if (!existing || offering.candidateCount > existing.candidateCount) {
      byKey.set(cohortKey, {
        cohortKey,
        programmeId: offering.programmeId,
        programmeName: offering.programmeName,
        level: offering.level,
        candidateCount: Math.max(0, offering.candidateCount),
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.cohortKey.localeCompare(b.cohortKey));
}

function pairKey(eventAId: string, eventBId: string) { return eventAId < eventBId ? `${eventAId}|${eventBId}` : `${eventBId}|${eventAId}`; }
function sortedPair(eventAId: string, eventBId: string): [string, string] { return eventAId < eventBId ? [eventAId, eventBId] : [eventBId, eventAId]; }

function compareReasons(left: ExamConflictReason, right: ExamConflictReason) {
  return left.type.localeCompare(right.type) || (left.cohortKey ?? "").localeCompare(right.cohortKey ?? "") || (left.conflictId ?? "").localeCompare(right.conflictId ?? "");
}

function mergeReason(edge: ExamEventConflict, reason: ExamConflictReason) {
  if (!edge.reasons.some((item) => JSON.stringify(item) === JSON.stringify(reason))) edge.reasons.push(reason);
}

function calculateMetrics(eventIds: string[], edges: ExamEventConflict[]): ConflictGraphMetrics {
  const events = eventIds.length;
  const maximumPossibleEdges = events < 2 ? 0 : (events * (events - 1)) / 2;
  const degrees = new Map(eventIds.map((id) => [id, 0]));
  const weightedDegrees = new Map(eventIds.map((id) => [id, 0]));
  for (const edge of edges) {
    degrees.set(edge.eventAId, (degrees.get(edge.eventAId) ?? 0) + 1);
    degrees.set(edge.eventBId, (degrees.get(edge.eventBId) ?? 0) + 1);
    weightedDegrees.set(edge.eventAId, (weightedDegrees.get(edge.eventAId) ?? 0) + edge.weight);
    weightedDegrees.set(edge.eventBId, (weightedDegrees.get(edge.eventBId) ?? 0) + edge.weight);
  }
  const degreeValues = [...degrees.values()];
  const weightedDegreeValues = [...weightedDegrees.values()];
  return {
    events,
    edges: edges.length,
    maximumPossibleEdges,
    density: maximumPossibleEdges === 0 ? 0 : edges.length / maximumPossibleEdges,
    averageDegree: events === 0 ? 0 : degreeValues.reduce((sum, value) => sum + value, 0) / events,
    maximumDegree: degreeValues.length ? Math.max(...degreeValues) : 0,
    weightedConflictTotal: edges.reduce((sum, edge) => sum + edge.weight, 0),
    maximumWeightedDegree: weightedDegreeValues.length ? Math.max(...weightedDegreeValues) : 0,
  };
}

/**
 * Builds a unified deterministic graph. Cohort weight uses the smaller effective
 * population across two events; duplicate cohort memberships inside one event use
 * the maximum offering count, so merged offerings are never counted twice.
 */
export function buildConflictGraph(events: ExamEvent[], options: { explicitConflicts?: ExplicitEventConflict[]; studentOverlaps?: StudentEventOverlap[] } = {}): ExamConflictGraph {
  const orderedEvents = events.slice().sort((a, b) => a.id.localeCompare(b.id));
  const eventIds = orderedEvents.map((event) => event.id);
  const populations = Object.fromEntries(orderedEvents.map((event) => [event.id, eventCohortPopulation(event)]));
  const populationByEvent = new Map(eventIds.map((id) => [id, new Map((populations[id] ?? []).map((item) => [item.cohortKey, item]))]));
  const edges = new Map<string, ExamEventConflict>();

  const ensureEdge = (eventAId: string, eventBId: string) => {
    if (eventAId === eventBId || !eventIds.includes(eventAId) || !eventIds.includes(eventBId)) return undefined;
    const [eventA, eventB] = sortedPair(eventAId, eventBId);
    const key = pairKey(eventA, eventB);
    const existing = edges.get(key);
    if (existing) return existing;
    const edge: ExamEventConflict = { eventAId: eventA, eventBId: eventB, hard: false, reasons: [], weight: 0 };
    edges.set(key, edge);
    return edge;
  };

  for (let leftIndex = 0; leftIndex < orderedEvents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedEvents.length; rightIndex += 1) {
      const left = orderedEvents[leftIndex];
      const right = orderedEvents[rightIndex];
      const leftPopulation = populationByEvent.get(left.id) ?? new Map();
      const rightPopulation = populationByEvent.get(right.id) ?? new Map();
      const sharedKeys = [...leftPopulation.keys()].filter((key) => rightPopulation.has(key)).sort();
      if (!sharedKeys.length) continue;
      const edge = ensureEdge(left.id, right.id)!;
      edge.hard = true;
      for (const cohortKey of sharedKeys) {
        const leftCohort = leftPopulation.get(cohortKey)!;
        const rightCohort = rightPopulation.get(cohortKey)!;
        const candidateCount = Math.min(leftCohort.candidateCount, rightCohort.candidateCount);
        edge.weight += candidateCount;
        edge.reasons.push({ type: "COHORT_OVERLAP", label: reasonLabels.COHORT_OVERLAP, cohortKey, programmeId: leftCohort.programmeId, programmeName: leftCohort.programmeName, level: leftCohort.level, candidateCount });
      }
    }
  }

  for (const explicit of options.explicitConflicts ?? []) {
    const edge = ensureEdge(explicit.eventAId, explicit.eventBId);
    if (!edge) continue;
    edge.hard = edge.hard || explicit.hard;
    const type: ExamConflictReasonType = explicit.hard ? "EXPLICIT_HARD_CONFLICT" : "EXPLICIT_SOFT_CONFLICT";
    mergeReason(edge, { type, label: reasonLabels[type], conflictId: explicit.id, conflictType: explicit.conflictType, courseAId: explicit.courseAId, courseBId: explicit.courseBId, estimatedSharedCandidates: explicit.estimatedSharedCandidates, detail: explicit.reason });
    if (edge.weight === 0 && explicit.estimatedSharedCandidates !== undefined) edge.weight = Math.max(edge.weight, explicit.estimatedSharedCandidates);
  }

  for (const overlap of options.studentOverlaps ?? []) {
    const edge = ensureEdge(overlap.eventAId, overlap.eventBId);
    if (!edge || !Number.isFinite(overlap.sharedStudentCount) || overlap.sharedStudentCount <= 0) continue;
    mergeReason(edge, { type: "INDIVIDUAL_REGISTRATION_OVERLAP", label: reasonLabels.INDIVIDUAL_REGISTRATION_OVERLAP, courseAId: overlap.courseAId, courseBId: overlap.courseBId, studentCount: Math.floor(overlap.sharedStudentCount) });
    // Cohort weight is primary when present; registration count is primary only for
    // an edge without aggregate cohort weight, avoiding double representation.
    if (edge.weight === 0) edge.weight = Math.floor(overlap.sharedStudentCount);
  }

  const sortedEdges = [...edges.values()].map((edge) => ({ ...edge, reasons: edge.reasons.sort(compareReasons) })).sort((a, b) => a.eventAId.localeCompare(b.eventAId) || a.eventBId.localeCompare(b.eventBId));
  return { eventIds, edges: sortedEdges, cohortPopulations: populations, metrics: calculateMetrics(eventIds, sortedEdges) };
}

export function buildCohortConflictGraph(events: ExamEvent[]) {
  return buildConflictGraph(events);
}

export function getConflictingEvents(graph: ExamConflictGraph, eventId: string) { return graph.edges.filter((edge) => edge.eventAId === eventId || edge.eventBId === eventId); }
export function hasConflict(graph: ExamConflictGraph, eventAId: string, eventBId: string) { const [left, right] = sortedPair(eventAId, eventBId); return graph.edges.some((edge) => edge.eventAId === left && edge.eventBId === right); }
export function getConflictWeight(graph: ExamConflictGraph, eventAId: string, eventBId: string) { const [left, right] = sortedPair(eventAId, eventBId); return graph.edges.find((edge) => edge.eventAId === left && edge.eventBId === right)?.weight ?? 0; }
export function getConflictReasons(graph: ExamConflictGraph, eventAId: string, eventBId: string) { const [left, right] = sortedPair(eventAId, eventBId); return graph.edges.find((edge) => edge.eventAId === left && edge.eventBId === right)?.reasons ?? []; }
export function getEventConflictDegree(graph: ExamConflictGraph, eventId: string) { return getConflictingEvents(graph, eventId).length; }
export function getWeightedConflictDegree(graph: ExamConflictGraph, eventId: string) { return getConflictingEvents(graph, eventId).reduce((sum, edge) => sum + edge.weight, 0); }

export type HighConflictEvent = { eventId: string; conflictDegree: number; weightedConflictDegree: number };

export function summarizeHighConflictEvents(graph: ExamConflictGraph, limit = 10): HighConflictEvent[] {
  return graph.eventIds.map((eventId) => ({ eventId, conflictDegree: getEventConflictDegree(graph, eventId), weightedConflictDegree: getWeightedConflictDegree(graph, eventId) }))
    .sort((a, b) => b.conflictDegree - a.conflictDegree || b.weightedConflictDegree - a.weightedConflictDegree || a.eventId.localeCompare(b.eventId))
    .slice(0, Math.max(0, limit));
}
