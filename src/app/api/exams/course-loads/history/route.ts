import { requireResourceRead } from "@/server/resources/access";
import { resourceError, resourceSuccess } from "@/server/resources/http";
import { listCourseLoadHistory } from "@/server/exams/course-load-service";

export async function GET() {
  try { await requireResourceRead(); return resourceSuccess(await listCourseLoadHistory()); } catch (error) { return resourceError(error); }
}
