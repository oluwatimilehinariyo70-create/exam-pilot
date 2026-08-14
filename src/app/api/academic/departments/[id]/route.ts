import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager } from "@/server/academic/access";
import { departmentInput } from "@/server/academic/schemas";
import { updateDepartment } from "@/server/academic/services";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireInstitutionalManager(); const { id } = await params; const parsed = departmentInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the department details.", parsed.error.flatten()); return jsonSuccess(await updateDepartment(id, parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }
