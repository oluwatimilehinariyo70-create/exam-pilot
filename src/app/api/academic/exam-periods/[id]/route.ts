import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireExaminationManager } from "@/server/academic/access";
import { examPeriodInput } from "@/server/academic/schemas";
import { updateExamPeriod } from "@/server/academic/services";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireExaminationManager(); const { id } = await params; const parsed = examPeriodInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the examination period details.", parsed.error.flatten()); return jsonSuccess(await updateExamPeriod(id, parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }
