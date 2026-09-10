import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { buildAggregateSchedulingDataset } from "@/server/timetable/aggregate-dataset-builder";
import { previewCbtBatches } from "@/domain/timetable";

export async function GET(request: Request) {
  try {
    await requireAcademicRead(); const params = new URL(request.url).searchParams; const sessionId = params.get("academicSessionId"); const semesterId = params.get("semesterId"); const examPeriodId = params.get("examPeriodId"); if (!sessionId || !semesterId || !examPeriodId) return jsonValidationError("Select a session, semester, and examination period.");
    const dataset = await buildAggregateSchedulingDataset(sessionId, semesterId, examPeriodId, {}, "FLEXIBLE_INTERVALS"); return jsonSuccess({ period: dataset.examPeriod, policy: dataset.cbtBatchingPolicy ?? null, staffing: dataset.cbtStaffingPolicy ?? null, previews: previewCbtBatches(dataset) });
  } catch (error) { return jsonError(error); }
}
