import { RegistrationsManager } from "@/components/resources/registrations-manager";
import { getCurrentSession } from "@/lib/authorization";

export default async function RegistrationsPage() { const session = await getCurrentSession(); return <RegistrationsManager role={session?.user.role ?? "VIEWER"} />; }
