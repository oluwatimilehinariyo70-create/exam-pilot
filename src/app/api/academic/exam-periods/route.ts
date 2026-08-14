import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireExaminationManager, requireAcademicRead } from "@/server/academic/access";
import { examPeriodInput, listQuery } from "@/server/academic/schemas";
import { createExamPeriod, listExamPeriods } from "@/server/academic/services";

export async function GET(request: Request) { try { await requireAcademicRead(); const search = new URL(request.url).searchParams; const query = listQuery.parse(Object.fromEntries(search)); return jsonSuccess(await listExamPeriods(query)); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { const session = await requireExaminationManager(); const parsed = examPeriodInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the examination period details.", parsed.error.flatten()); return jsonSuccess(await createExamPeriod(parsed.data, session.user.id), 201); } catch (error) { return jsonError(error); } }
