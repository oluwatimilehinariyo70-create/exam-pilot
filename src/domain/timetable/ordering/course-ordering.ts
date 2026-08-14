import type { ConflictGraph } from "../graph/conflict-graph";
import type { SchedulingCourse, SchedulingDataset } from "../types";

export function courseCandidateCounts(dataset: SchedulingDataset) {
  const counts = new Map<string, number>();
  for (const registration of dataset.registrations) counts.set(registration.courseId, (counts.get(registration.courseId) ?? 0) + 1);
  return counts;
}

export function orderCourses(courses: SchedulingCourse[], dataset: SchedulingDataset, graph: ConflictGraph, scheduledIds: Set<string> = new Set(), seed = 0) {
  const counts = courseCandidateCounts(dataset); const saturation = new Map<string, number>();
  for (const course of courses) saturation.set(course.id, 0);
  return [...courses].filter((course) => !scheduledIds.has(course.id)).sort((a, b) => {
    const saturationDifference = (saturation.get(b.id) ?? 0) - (saturation.get(a.id) ?? 0); if (saturationDifference) return saturationDifference;
    const degreeDifference = graph.getCourseDegree(b.id) - graph.getCourseDegree(a.id); if (degreeDifference) return degreeDifference;
    const candidateDifference = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0); if (candidateDifference) return candidateDifference;
    const seededA = stableSeed(a.id, seed); const seededB = stableSeed(b.id, seed); if (seededA !== seededB) return seededA - seededB;
    return a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
  });
}

function stableSeed(value: string, seed: number) { let hash = seed | 0; for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0; return Math.abs(hash); }
