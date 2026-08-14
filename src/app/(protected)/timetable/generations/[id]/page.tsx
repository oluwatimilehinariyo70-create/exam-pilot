import { getCurrentSession } from "@/lib/authorization";
import { ReviewWorkspace } from "@/components/timetable/review-workspace";

export default async function GenerationDetailPage({ params }: { params: Promise<{ id: string }> }) { const session = await getCurrentSession(); return <ReviewWorkspace generationId={(await params).id} role={session?.user.role ?? "VIEWER"} />; }
