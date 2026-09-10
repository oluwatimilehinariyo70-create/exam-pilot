import { requireUser } from "@/lib/authorization";
import { requireExaminationManager } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { revisionActionSchema } from "@/server/timetable/revision-schemas";
import { applyRevisionAction, getRevisionWorkspace } from "@/server/timetable/revision-service";

export async function GET(request: Request) {
  try { await requireUser(); const id=new URL(request.url).searchParams.get("generationId"); if (!id || id.length>200) return jsonValidationError("A generation ID is required."); return jsonSuccess(await getRevisionWorkspace(id)); } catch(error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    const session=await requireExaminationManager();
    const body=await request.text(); if (body.length>65536) return jsonValidationError("Request is too large.");
    let data:unknown; try { data=JSON.parse(body); } catch { return jsonValidationError("Invalid JSON."); }
    const parsed=revisionActionSchema.safeParse(data); if (!parsed.success) return jsonValidationError("Invalid revision action.",parsed.error.flatten());
    return jsonSuccess(await applyRevisionAction(parsed.data,session.user.id,session.user.role ?? "VIEWER"));
  } catch(error) { return jsonError(error); }
}
