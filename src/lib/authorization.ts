import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { type Role } from "@/lib/roles";

export { ROLES, type Role } from "@/lib/roles";

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getCurrentSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true, role: true } });
  return current?.active ? { ...session, user: { ...session.user, role: current.role } } : null;
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user) throw new AuthorizationError("A valid session is required.");
  return session;
}

export async function requireRole(allowedRoles: readonly Role[]) {
  const session = await requireUser();
  const role = (session.user.role ?? "VIEWER") as Role;
  if (!allowedRoles.includes(role)) {
    throw new AuthorizationError("Your role does not allow this action.");
  }
  return session;
}
