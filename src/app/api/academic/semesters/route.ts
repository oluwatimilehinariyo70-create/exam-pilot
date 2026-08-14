import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager, requireAcademicRead } from "@/server/academic/access";
import { listQuery, semesterInput } from "@/server/academic/schemas";
import { createSemester, listSemesters } from "@/server/academic/services";

export async function GET(request: Request) { try { await requireAcademicRead(); const search = new URL(request.url).searchParams; const query = listQuery.parse(Object.fromEntries(search)); return jsonSuccess(await listSemesters(query)); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { const session = await requireInstitutionalManager(); const parsed = semesterInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the semester details.", parsed.error.flatten()); return jsonSuccess(await createSemester(parsed.data, session.user.id), 201); } catch (error) { return jsonError(error); } }
