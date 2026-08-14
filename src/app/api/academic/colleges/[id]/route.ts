import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager } from "@/server/academic/access";
import { collegeInput } from "@/server/academic/schemas";
import { updateCollege } from "@/server/academic/services";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireInstitutionalManager(); const { id } = await params; const parsed = collegeInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the college details.", parsed.error.flatten()); return jsonSuccess(await updateCollege(id, parsed.data, session.user.id)); } catch (error) { return jsonError(error); }
}
