import { requireResourceRead } from "@/server/resources/access";
import { resourceError, resourceSuccess } from "@/server/resources/http";
import { getAggregateDataReadiness } from "@/server/exams/readiness";

export async function GET(request: Request) {
  try { await requireResourceRead(); const { searchParams } = new URL(request.url); return resourceSuccess(await getAggregateDataReadiness(searchParams.get("academicSessionId") ?? undefined, searchParams.get("semesterId") ?? undefined)); } catch (error) { return resourceError(error); }
}
