import { requireExaminationManager } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { applyTimetableEdit } from "@/server/timetable/review-service";
import { editRequest } from "@/server/timetable/schemas";

export async function POST(request: Request) { try { const session = await requireExaminationManager(); const parsed = editRequest.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Provide a valid timetable edit.", parsed.error.flatten()); return jsonSuccess(await applyTimetableEdit(parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }
