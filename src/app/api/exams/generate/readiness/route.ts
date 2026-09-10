import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { getAggregateGenerationReadiness } from "@/server/timetable/aggregate-generation-service";
import { generationRequest } from "@/server/timetable/schemas";

export async function GET(request: Request) {
  try {
    await requireAcademicRead();
    const parsed = generationRequest.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return jsonValidationError("Select a session, semester, and examination period.", parsed.error.flatten());
    return jsonSuccess(await getAggregateGenerationReadiness(parsed.data));
  } catch (error) { return jsonError(error); }
}
