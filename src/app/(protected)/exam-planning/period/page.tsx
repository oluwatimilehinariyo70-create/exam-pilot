import { ExamPeriodPlanner } from "@/components/exams/exam-period-planner";
import { getCurrentSession } from "@/lib/authorization";

export default async function ExamPeriodPlannerPage() {
  const session = await getCurrentSession();
  return <ExamPeriodPlanner role={session?.user.role ?? "VIEWER"} />;
}
