import { requireResourceRead } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { buildAggregateConflictDataset } from "@/server/exams/conflict-graph-service";
import { explicitConflictListQuery } from "@/server/exams/schemas";

export async function GET(request: Request) {
  try {
    await requireResourceRead();
    const parsed = explicitConflictListQuery.pick({ academicSessionId: true, semesterId: true }).safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return resourceValidation("Select an academic session and semester.", parsed.error.flatten());
    const dataset = await buildAggregateConflictDataset(parsed.data.academicSessionId, parsed.data.semesterId);
    return resourceSuccess({ events: dataset.events, graph: dataset.graph, issues: dataset.issues, studentPrecisionAvailable: dataset.studentPrecisionAvailable, registrationCount: dataset.registrationCount });
  } catch (error) { return resourceError(error); }
}
