import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getCurrentSession } from "@/lib/authorization";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) redirect("/sign-in");
  return <AppShell user={{ name: user.name, email: user.email, role: user.role }}>{children}</AppShell>;
}
