import { requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { courseLoadPreviewRequest } from "@/server/exams/schemas";
import { previewCourseLoadImport } from "@/server/exams/course-load-service";

export async function POST(request: Request) {
  try {
    await requireResourceManager();
    const parsed = courseLoadPreviewRequest.safeParse(await request.json());
    if (!parsed.success) return resourceValidation("Provide a CSV file, session, semester, and valid course-load headers.", parsed.error.flatten());
    return resourceSuccess(await previewCourseLoadImport(parsed.data));
  } catch (error) { return resourceError(error); }
}
