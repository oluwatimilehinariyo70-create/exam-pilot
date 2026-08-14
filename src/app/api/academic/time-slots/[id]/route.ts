import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireExaminationManager } from "@/server/academic/access";
import { timeSlotInput } from "@/server/academic/schemas";
import { deleteTimeSlot, updateTimeSlot } from "@/server/academic/services";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireExaminationManager(); const { id } = await params; return jsonSuccess(await deleteTimeSlot(id, session.user.id)); } catch (error) { return jsonError(error); } }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireExaminationManager(); const { id } = await params; const parsed = timeSlotInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the time slot details.", parsed.error.flatten()); return jsonSuccess(await updateTimeSlot(id, parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }
