import { requireResourceRead, requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { examEventListQuery, manualMergeRequest } from "@/server/exams/schemas";
import { listAggregateExamEvents } from "@/server/exams/course-load-service";
import { manuallyMergeCourseOfferings } from "@/server/exams/aggregate-services";

export async function GET(request: Request) {
  try { await requireResourceRead(); const { searchParams } = new URL(request.url); const parsed = examEventListQuery.safeParse(Object.fromEntries(searchParams.entries())); if (!parsed.success) return resourceValidation("Invalid aggregate event filters.", parsed.error.flatten()); return resourceSuccess(await listAggregateExamEvents(parsed.data)); } catch (error) { return resourceError(error); }
}

export async function POST(request: Request) {
  try { const session = await requireResourceManager(); const parsed = manualMergeRequest.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Select at least two offerings and provide a merge reason.", parsed.error.flatten()); return resourceSuccess(await manuallyMergeCourseOfferings(parsed.data.offeringIds, parsed.data.reason, { actorId: session.user.id }), 201); } catch (error) { return resourceError(error); }
}
