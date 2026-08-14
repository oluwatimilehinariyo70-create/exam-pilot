import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { courseInput } from "@/server/resources/schemas";
import { getCourse, updateCourse } from "@/server/resources/services";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireResourceRead(); return resourceSuccess(await getCourse((await params).id)); } catch (error) { return resourceError(error); } }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireResourceManager(); const parsed = courseInput.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Check the course details.", parsed.error.flatten()); return resourceSuccess(await updateCourse((await params).id, parsed.data, session.user.id)); } catch (error) { return resourceError(error); } }
