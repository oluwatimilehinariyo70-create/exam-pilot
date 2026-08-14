import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireExaminationManager } from "@/server/academic/access";
import { bulkTimeSlotInput } from "@/server/academic/schemas";
import { previewTimeSlots } from "@/server/academic/services";

export async function POST(request: Request) { try { await requireExaminationManager(); const parsed = bulkTimeSlotInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the bulk time slot settings.", parsed.error.flatten()); return jsonSuccess(await previewTimeSlots(parsed.data)); } catch (error) { return jsonError(error); } }
