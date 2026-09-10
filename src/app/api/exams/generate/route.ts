import { requireExaminationManager } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { generateAndPersistAggregateTimetable } from "@/server/timetable/aggregate-generation-service";
import { generationRequest } from "@/server/timetable/schemas";

export async function POST(request: Request) {
  try {
    const session = await requireExaminationManager();
    const parsed = generationRequest.safeParse(await request.json());
    if (!parsed.success) return jsonValidationError("Provide a valid academic session, semester, and examination period.", parsed.error.flatten());
    return jsonSuccess(await generateAndPersistAggregateTimetable(parsed.data, session.user.id), 201);
  } catch (error) { return jsonError(error); }
}
