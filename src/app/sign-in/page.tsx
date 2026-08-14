"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, Loader2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { signInSchema } from "@/schemas/auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter valid sign-in details.");
      setPending(false);
      return;
    }
    const result = await authClient.signIn.email({ ...parsed.data, callbackURL: "/dashboard" });
    if (result.error) {
      setError(result.error.message ?? "Unable to sign in. Check your credentials and try again.");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen bg-paper">
      <section className="hidden w-[44%] flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-white"><BookOpen className="h-5 w-5" /></div>
          <span className="text-lg font-bold tracking-tight">Exam Pilot</span>
        </div>
        <div className="max-w-md">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">BOUESTI · College of Science</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">A clearer path from exam data to a publishable timetable.</h1>
          <p className="mt-6 text-base leading-7 text-slate-300">Prepare academic data, coordinate examination resources, and keep scheduling decisions reviewable from one secure workspace.</p>
        </div>
        <p className="text-xs text-slate-400">Phase 1 foundation · Internal administration</p>
      </section>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><BookOpen className="h-5 w-5" /></div><span className="text-lg font-bold">Exam Pilot</span></div>
          </div>
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold text-teal">STAFF ACCESS</p>
            <h2 className="text-3xl font-bold tracking-tight text-navy">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage examination planning for your institution.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Work email</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20" placeholder="you@bouesti.edu.ng" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label><span className="text-xs text-slate-400">Minimum 12 characters</span></div>
              <div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20" placeholder="Enter your password" /></div>
            </div>
            {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            <Button type="submit" className="h-11 w-full gap-2" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{pending ? "Signing in…" : "Sign in to workspace"}</Button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">Access is provisioned by an authorised administrator. Contact your examination officer if you need an account.</p>
        </div>
      </section>
    </main>
  );
}
