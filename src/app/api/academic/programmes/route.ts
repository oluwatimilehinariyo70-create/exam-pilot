import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireInstitutionalManager, requireAcademicRead } from "@/server/academic/access";
import { listQuery, programmeInput } from "@/server/academic/schemas";
import { createProgramme, listProgrammes } from "@/server/academic/services";

export async function GET(request: Request) { try { await requireAcademicRead(); const search = new URL(request.url).searchParams; const query = listQuery.parse(Object.fromEntries(search)); return jsonSuccess(await listProgrammes(query)); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { const session = await requireInstitutionalManager(); const parsed = programmeInput.safeParse(await request.json()); if (!parsed.success) return jsonValidationError("Check the programme details.", parsed.error.flatten()); return jsonSuccess(await createProgramme(parsed.data, session.user.id), 201); } catch (error) { return jsonError(error); } }
