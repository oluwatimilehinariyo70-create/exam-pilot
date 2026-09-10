import { requireResourceRead } from "@/server/resources/access";
import { courseLoadTemplateCsv } from "@/server/exams/course-load-parser";

export async function GET() {
  await requireResourceRead();
  return new Response(courseLoadTemplateCsv(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="course-load-template.csv"', "Cache-Control": "no-store" } });
}
