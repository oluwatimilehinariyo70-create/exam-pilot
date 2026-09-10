import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { getPlannerCapacity } from "@/server/timetable/planner-service";

export async function GET(request: Request) { try { await requireAcademicRead(); const id = new URL(request.url).searchParams.get("examPeriodId"); if (!id) return jsonValidationError("Select an examination period.", {}); return jsonSuccess(await getPlannerCapacity(id)); } catch (error) { return jsonError(error); } }
