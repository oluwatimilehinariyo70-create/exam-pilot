import { RegistrationImportManager } from "@/components/resources/registration-import-manager";
import { getCurrentSession } from "@/lib/authorization";

export default async function RegistrationImportPage() { const session = await getCurrentSession(); return <RegistrationImportManager role={session?.user.role ?? "VIEWER"} />; }
