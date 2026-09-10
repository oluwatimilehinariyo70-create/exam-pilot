import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { courseOfferingListQuery, courseOfferingMutation } from "@/server/exams/schemas";
import { listAggregateCourseOfferings } from "@/server/exams/course-load-service";
import { createCourseOffering } from "@/server/exams/aggregate-services";

export async function GET(request: Request) {
  try { await requireResourceRead(); const { searchParams } = new URL(request.url); const parsed = courseOfferingListQuery.safeParse(Object.fromEntries(searchParams.entries())); if (!parsed.success) return resourceValidation("Invalid course-offering filters.", parsed.error.flatten()); const filters = { ...parsed.data, active: parsed.data.active === "all" ? undefined : parsed.data.active === "true" }; return resourceSuccess(await listAggregateCourseOfferings(filters)); } catch (error) { return resourceError(error); }
}

export async function POST(request: Request) {
  try { const session = await requireResourceManager(); const parsed = courseOfferingMutation.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Provide a valid course offering.", parsed.error.flatten()); return resourceSuccess(await createCourseOffering(parsed.data, session.user.id), 201); } catch (error) { return resourceError(error); }
}
