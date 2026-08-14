import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess } from "@/server/academic/http";
import { listGenerationHistory } from "@/server/timetable/generation-service";

export async function GET(request: Request) { try { await requireAcademicRead(); const params = new URL(request.url).searchParams; return jsonSuccess(await listGenerationHistory(params.get("sessionId") ?? undefined, params.get("semesterId") ?? undefined, params.get("examPeriodId") ?? undefined)); } catch (error) { return jsonError(error); } }
