import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { createExplicitConflict, listExplicitConflicts } from "@/server/exams/aggregate-services";
import { explicitConflictCreate, explicitConflictListQuery } from "@/server/exams/schemas";

export async function GET(request: Request) {
  try {
    await requireResourceRead();
    const parsed = explicitConflictListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return resourceValidation("Select an academic session and semester.", parsed.error.flatten());
    return resourceSuccess(await listExplicitConflicts(parsed.data.academicSessionId, parsed.data.semesterId, parsed.data.active === "all" ? undefined : parsed.data.active === "true"));
  } catch (error) { return resourceError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireResourceManager();
    const parsed = explicitConflictCreate.safeParse(await request.json());
    if (!parsed.success) return resourceValidation("Provide two courses, a severity, a type, and an optional reason.", parsed.error.flatten());
    return resourceSuccess(await createExplicitConflict({ ...parsed.data, actorId: session.user.id, estimatedSharedCandidates: parsed.data.estimatedSharedCandidates ?? undefined, reason: parsed.data.reason ?? undefined }), 201);
  } catch (error) { return resourceError(error); }
}
