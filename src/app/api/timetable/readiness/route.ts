import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { getGenerationReadiness } from "@/server/timetable/generation-service";
import { generationRequest } from "@/server/timetable/schemas";

export async function GET(request: Request) {
  try { await requireAcademicRead(); const parsed = generationRequest.pick({ academicSessionId: true, semesterId: true, examPeriodId: true, schedulingMode: true }).safeParse(Object.fromEntries(new URL(request.url).searchParams)); if (!parsed.success) return jsonValidationError("Provide a valid academic session, semester, examination period, and scheduling mode.", parsed.error.flatten()); return jsonSuccess(await getGenerationReadiness(parsed.data)); } catch (error) { return jsonError(error); }
}
