import { AggregateConflictsWorkspace } from "@/components/exams/aggregate-conflicts-workspace";
import { getCurrentSession } from "@/lib/authorization";

export default async function AggregateConflictsPage() {
  const session = await getCurrentSession();
  return <AggregateConflictsWorkspace role={session?.user.role ?? "VIEWER"} />;
}
