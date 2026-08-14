import { requireExaminationManager } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { transitionGeneration } from "@/server/timetable/review-service";
import { workflowRequest } from "@/server/timetable/schemas";

export async function POST(request: Request) { try { const session = await requireExaminationManager(); const parsed = workflowRequest.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Provide a valid workflow transition.", parsed.error.flatten()); return jsonSuccess(await transitionGeneration(parsed.data.generationId, parsed.data.target, session.user.id)); } catch (error) { return jsonError(error); } }
