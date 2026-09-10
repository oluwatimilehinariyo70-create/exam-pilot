import { requireAcademicRead, requireExaminationManager } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { getPlanner, previewPlanner, savePlanner } from "@/server/timetable/planner-service";
import { plannerPreviewRequest, plannerSaveRequest } from "@/server/timetable/schemas";

export async function GET(request: Request) { try { await requireAcademicRead(); const id = new URL(request.url).searchParams.get("examPeriodId"); if (!id) return jsonValidationError("Select an examination period.", {}); return jsonSuccess(await getPlanner(id)); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { const session = await requireExaminationManager(); const body = await request.json(); const parsed = plannerSaveRequest.safeParse(body); if (!parsed.success) return jsonValidationError("Provide a valid examination calendar.", parsed.error.flatten()); return jsonSuccess(await savePlanner(parsed.data, session.user.id)); } catch (error) { return jsonError(error); } }

export async function PUT(request: Request) { try { await requireAcademicRead(); const parsed = plannerPreviewRequest.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Provide valid planner settings.", parsed.error.flatten()); return jsonSuccess(await previewPlanner(parsed.data)); } catch (error) { return jsonError(error); } }
