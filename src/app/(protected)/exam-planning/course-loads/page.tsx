import { getCurrentSession } from "@/lib/authorization";
import { CourseLoadsWorkspace } from "@/components/exams/course-loads-workspace";

export default async function CourseLoadsPage() {
  const session = await getCurrentSession();
  return <CourseLoadsWorkspace role={session?.user.role ?? "VIEWER"} />;
}
