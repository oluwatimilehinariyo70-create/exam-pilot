import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { compareGenerations } from "@/server/timetable/review-service";

export async function GET(request: Request) { try { await requireAcademicRead(); const params = new URL(request.url).searchParams; const first = params.get("firstId"); const second = params.get("secondId"); if (!first || !second) return jsonValidationError("Provide two generation IDs to compare."); return jsonSuccess(await compareGenerations(first, second)); } catch (error) { return jsonError(error); } }
