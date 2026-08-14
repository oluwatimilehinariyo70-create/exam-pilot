import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess } from "@/server/academic/http";
import { getGenerationDetail } from "@/server/timetable/review-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireAcademicRead(); return jsonSuccess(await getGenerationDetail((await params).id)); } catch (error) { return jsonError(error); } }
