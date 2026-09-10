import { requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { courseOfferingUpdate } from "@/server/exams/schemas";
import { setCourseOfferingActive, updateCourseOffering } from "@/server/exams/aggregate-services";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireResourceManager(); const parsed = courseOfferingUpdate.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Provide valid course-offering changes.", parsed.error.flatten()); const { id } = await params; return resourceSuccess(await updateCourseOffering(id, parsed.data, session.user.id)); } catch (error) { return resourceError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireResourceManager(); const { id } = await params; return resourceSuccess(await setCourseOfferingActive(id, false, session.user.id)); } catch (error) { return resourceError(error); }
}
