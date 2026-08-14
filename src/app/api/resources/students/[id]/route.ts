import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { studentInput } from "@/server/resources/schemas";
import { getStudent, updateStudent } from "@/server/resources/services";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireResourceRead(); return resourceSuccess(await getStudent((await params).id)); } catch (error) { return resourceError(error); } }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireResourceManager(); const parsed = studentInput.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Check the student details.", parsed.error.flatten()); return resourceSuccess(await updateStudent((await params).id, parsed.data, session.user.id)); } catch (error) { return resourceError(error); } }
