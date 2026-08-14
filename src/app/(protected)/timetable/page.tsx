import { getCurrentSession } from "@/lib/authorization";
import { GenerationWizard } from "@/components/timetable/generation-wizard";

export default async function TimetablePage() { const session = await getCurrentSession(); return <GenerationWizard role={session?.user.role ?? "VIEWER"} />; }
