"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-slate-500">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
