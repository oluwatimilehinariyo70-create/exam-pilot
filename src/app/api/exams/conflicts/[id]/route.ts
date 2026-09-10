import { requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { setExplicitConflictActive, updateExplicitConflict } from "@/server/exams/aggregate-services";
import { explicitConflictUpdate } from "@/server/exams/schemas";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireResourceManager();
    const parsed = explicitConflictUpdate.safeParse(await request.json());
    if (!parsed.success) return resourceValidation("Provide valid conflict changes.", parsed.error.flatten());
    const { id } = await params;
    return resourceSuccess(await updateExplicitConflict(id, { ...parsed.data, estimatedSharedCandidates: parsed.data.estimatedSharedCandidates ?? undefined, reason: parsed.data.reason ?? undefined }, session.user.id));
  } catch (error) { return resourceError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireResourceManager();
    const body = await request.json();
    if (typeof body.active !== "boolean") return resourceValidation("The active field must be true or false.");
    const { id } = await params;
    return resourceSuccess(await setExplicitConflictActive(id, body.active, session.user.id));
  } catch (error) { return resourceError(error); }
}
