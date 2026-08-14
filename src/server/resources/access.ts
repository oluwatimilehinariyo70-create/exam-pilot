import { requireRole, requireUser } from "@/lib/authorization";

export const RESOURCE_MANAGERS = ["SUPER_ADMIN", "ADMIN", "EXAM_OFFICER"] as const;

export async function requireResourceRead() { return requireUser(); }
export async function requireResourceManager() { return requireRole(RESOURCE_MANAGERS); }
