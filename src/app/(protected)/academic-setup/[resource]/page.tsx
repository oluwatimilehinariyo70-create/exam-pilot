import { notFound } from "next/navigation";

import { AcademicResourceManager } from "@/components/academic/academic-resource-manager";
import { getCurrentSession } from "@/lib/authorization";

const resources = ["colleges", "departments", "programmes", "sessions", "semesters", "exam-periods", "time-slots"] as const;
type AcademicResource = (typeof resources)[number];

export default async function AcademicResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!resources.includes(resource as AcademicResource)) notFound();
  const session = await getCurrentSession();
  if (!session?.user) notFound();
  return <AcademicResourceManager resource={resource as AcademicResource} role={session.user.role ?? "VIEWER"} />;
}
