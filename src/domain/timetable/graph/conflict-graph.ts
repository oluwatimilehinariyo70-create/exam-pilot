import type { CourseConflictEdge, SchedulingDataset } from "../types";

export class ConflictGraph {
  private readonly adjacency = new Map<string, Map<string, CourseConflictEdge>>();

  constructor(edges: CourseConflictEdge[], courseIds: string[]) {
    for (const id of [...courseIds].sort()) this.adjacency.set(id, new Map());
    for (const edge of edges) {
      this.adjacency.get(edge.courseAId)?.set(edge.courseBId, edge);
      this.adjacency.get(edge.courseBId)?.set(edge.courseAId, edge);
    }
  }

  getConflictingCourses(courseId: string) { return [...(this.adjacency.get(courseId)?.values() ?? [])].sort((a, b) => a.courseBId.localeCompare(b.courseBId)); }
  getConflictWeight(courseAId: string, courseBId: string) { return this.adjacency.get(courseAId)?.get(courseBId)?.sharedStudentCount ?? 0; }
  getCourseDegree(courseId: string) { return this.adjacency.get(courseId)?.size ?? 0; }
  hasConflict(courseAId: string, courseBId: string) { return this.getConflictWeight(courseAId, courseBId) > 0; }
  get edges() { return [...this.adjacency.values()].flatMap((edges) => [...edges.values()]).filter((edge, index, all) => all.findIndex((candidate) => candidate.courseAId === edge.courseAId && candidate.courseBId === edge.courseBId) === index).sort((a, b) => `${a.courseAId}|${a.courseBId}`.localeCompare(`${b.courseAId}|${b.courseBId}`)); }
}

export function buildConflictGraph(dataset: SchedulingDataset) {
  const registrationsByStudent = new Map<string, string[]>();
  for (const registration of dataset.registrations) {
    const courses = registrationsByStudent.get(registration.studentId) ?? [];
    courses.push(registration.courseId);
    registrationsByStudent.set(registration.studentId, courses);
  }
  const pairCounts = new Map<string, { a: string; b: string; count: number; students: string[] }>();
  for (const [studentId, courses] of [...registrationsByStudent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const uniqueCourses = [...new Set(courses)].sort();
    for (let i = 0; i < uniqueCourses.length; i += 1) for (let j = i + 1; j < uniqueCourses.length; j += 1) {
      const a = uniqueCourses[i]; const b = uniqueCourses[j]; const key = `${a}|${b}`;
      const pair = pairCounts.get(key) ?? { a, b, count: 0, students: [] };
      pair.count += 1; pair.students.push(studentId); pairCounts.set(key, pair);
    }
  }
  const edges = [...pairCounts.values()].map((pair) => ({ courseAId: pair.a, courseBId: pair.b, sharedStudentCount: pair.count, sharedStudentIds: pair.students.sort() }));
  return new ConflictGraph(edges, dataset.courses.map((course) => course.id));
}
