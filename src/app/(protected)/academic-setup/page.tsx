import Link from "next/link";
import { ArrowRight, BookOpen, Building2, CalendarClock, CalendarDays, Layers3, Network, School } from "lucide-react";

import { getCurrentSession } from "@/lib/authorization";

const areas = [
  { slug: "colleges", label: "Colleges", description: "Set up the institutions represented in this deployment.", icon: Building2, tone: "bg-blue-50 text-blue-700" },
  { slug: "departments", label: "Departments", description: "Organise academic units under each college.", icon: Network, tone: "bg-teal/10 text-teal" },
  { slug: "programmes", label: "Programmes", description: "Define the programmes that own student cohorts.", icon: School, tone: "bg-violet-50 text-violet-700" },
  { slug: "sessions", label: "Academic sessions", description: "Manage the university academic year and active session.", icon: CalendarDays, tone: "bg-amber-50 text-amber-700" },
  { slug: "semesters", label: "Semesters", description: "Create semester periods inside an academic session.", icon: Layers3, tone: "bg-rose-50 text-rose-700" },
  { slug: "exam-periods", label: "Examination periods", description: "Define the examination window for a session and semester.", icon: CalendarClock, tone: "bg-emerald-50 text-emerald-700" },
  { slug: "time-slots", label: "Time slots", description: "Configure deterministic examination sessions, individually or in bulk.", icon: BookOpen, tone: "bg-sky-50 text-sky-700" },
];

export default async function AcademicSetupPage() {
  const session = await getCurrentSession();
  return <div className="space-y-8"><div><p className="mb-2 text-sm font-semibold text-teal">ACADEMIC SETUP</p><h1 className="text-3xl font-bold tracking-tight text-navy">Build the academic structure</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Configure the relationships the timetable engine will rely on. Work from left to right: institution, academic year, then examination window.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map((area) => { const Icon = area.icon; return <Link href={`/academic-setup/${area.slug}`} key={area.slug} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-teal/40"><div className="flex items-start justify-between"><span className={`rounded-xl p-3 ${area.tone}`}><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal" /></div><h2 className="mt-5 font-bold text-navy">{area.label}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{area.description}</p></Link>; })}</div><div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card"><div className="rounded-full bg-slate-100 p-2 text-slate-500"><BookOpen className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-navy">Signed in as {session?.user.name}</p><p className="mt-1 text-sm leading-6 text-slate-500">Your role is enforced on the server for every mutation. Viewers can inspect configuration; examination officers can manage examination periods and time slots.</p></div></div></div>;
}
