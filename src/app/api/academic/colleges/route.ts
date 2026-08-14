import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager, requireAcademicRead } from "@/server/academic/access";
import { collegeInput, listQuery } from "@/server/academic/schemas";
import { createCollege, listColleges } from "@/server/academic/services";

export async function GET(request: Request) {
  try { await requireAcademicRead(); const search = new URL(request.url).searchParams; const query = listQuery.parse(Object.fromEntries(search)); return jsonSuccess(await listColleges(query)); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { const session = await requireInstitutionalManager(); const parsed = collegeInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the college details.", parsed.error.flatten()); return jsonSuccess(await createCollege(parsed.data, session.user.id), 201); } catch (error) { return jsonError(error); }
}
