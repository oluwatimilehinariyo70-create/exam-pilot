import { requireAcademicRead } from "@/server/academic/access";
import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { getGenerationHallCollisions } from "@/server/timetable/review-service";

export async function GET(request: Request) {
  try {
    await requireAcademicRead();
    const generationId = new URL(request.url).searchParams.get("generationId");
    if (!generationId) return jsonValidationError("Provide a generation ID.");
    return jsonSuccess(await getGenerationHallCollisions(generationId));
  } catch (error) {
    return jsonError(error);
  }
}
