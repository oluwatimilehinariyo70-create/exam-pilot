import { requireResourceManager } from "@/server/resources/access";
import { resourceError, resourceSuccess } from "@/server/resources/http";
import { unmergeManualExamEvent } from "@/server/exams/course-load-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const session = await requireResourceManager(); const { id } = await params; return resourceSuccess(await unmergeManualExamEvent(id, session.user.id)); } catch (error) { return resourceError(error); }
}
