import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager } from "@/server/academic/access";
import { sessionInput } from "@/server/academic/schemas";
import { updateSession } from "@/server/academic/services";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireInstitutionalManager(); const { id } = await params; const parsed = sessionInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the academic session details.", parsed.error.flatten()); return jsonSuccess(await updateSession(id, parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }
