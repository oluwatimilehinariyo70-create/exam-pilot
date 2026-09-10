import { requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";
import { courseLoadConfirmRequest } from "@/server/exams/schemas";
import { commitCourseLoadImport } from "@/server/exams/course-load-service";

export async function POST(request: Request) {
  try {
    const session = await requireResourceManager();
    const parsed = courseLoadConfirmRequest.safeParse(await request.json());
    if (!parsed.success) return resourceValidation("Confirm a matching validated course-load preview.", parsed.error.flatten());
    return resourceSuccess(await commitCourseLoadImport(parsed.data, session.user.id), 201);
  } catch (error) { return resourceError(error); }
}
