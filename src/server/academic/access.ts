import { requireRole, requireUser } from "@/lib/authorization";

export const INSTITUTIONAL_MANAGERS = ["SUPER_ADMIN", "ADMIN"] as const;
export const EXAMINATION_MANAGERS = ["SUPER_ADMIN", "ADMIN", "EXAM_OFFICER"] as const;

export async function requireAcademicRead() {
  return requireUser();
}

export async function requireInstitutionalManager() {
  return requireRole(INSTITUTIONAL_MANAGERS);
}

export async function requireExaminationManager() {
  return requireRole(EXAMINATION_MANAGERS);
}
