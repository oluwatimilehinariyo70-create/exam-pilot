export const ROLES = ["SUPER_ADMIN", "ADMIN", "EXAM_OFFICER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export function canManageTimetable(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "EXAM_OFFICER";
}

export function canPublishTimetable(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canManageUsers(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export type AcademicResource = "institutional" | "examination";

export function canManageAcademicResource(role: Role, resource: AcademicResource) {
  if (resource === "examination") return role === "SUPER_ADMIN" || role === "ADMIN" || role === "EXAM_OFFICER";
  return role === "SUPER_ADMIN" || role === "ADMIN";
}
