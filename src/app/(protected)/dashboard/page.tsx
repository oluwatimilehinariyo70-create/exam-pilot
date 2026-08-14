import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, CalendarCheck2, CheckCircle2, Clock3, GraduationCap, Users, Warehouse } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  try {
    const [colleges, departments, programmes, courses, students, registrations, venues, venueCapacity, invigilators, scheduled, activeSession, activeSemester, activePeriod, configuredSlots, unregisteredCourses, latestGeneration] = await prisma.$transaction([
      prisma.college.count({ where: { active: true } }),
      prisma.department.count({ where: { active: true } }),
      prisma.programme.count({ where: { active: true } }),
      prisma.course.count({ where: { active: true } }),
      prisma.student.count(),
      prisma.courseRegistration.count(),
      prisma.venue.count({ where: { active: true } }),
      prisma.venue.aggregate({ where: { active: true }, _sum: { capacity: true } }),
      prisma.invigilator.count({ where: { active: true } }),
      prisma.examSchedule.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.academicSession.findFirst({ where: { active: true }, orderBy: { startYear: "desc" } }),
      prisma.semester.findFirst({ where: { active: true, academicSession: { active: true } }, orderBy: { semesterNumber: "asc" } }),
      prisma.examPeriod.findFirst({ where: { active: true }, orderBy: { startDate: "desc" } }),
      prisma.examTimeSlot.count({ where: { examPeriod: { active: true } } }),
      prisma.course.count({ where: { active: true, registrations: { none: {} } } }),
      prisma.timetableGeneration.findFirst({ orderBy: { generatedAt: "desc" }, select: { id: true, status: true, reviewStatus: true, score: true, metadata: true } }),
    ]);
    const metrics = latestGeneration?.metadata && typeof latestGeneration.metadata === "object" && !Array.isArray(latestGeneration.metadata) && "metrics" in latestGeneration.metadata ? (latestGeneration.metadata as unknown as { metrics?: { scheduledCourses?: number; unscheduledCourses?: number } }).metrics : undefined;
    return { colleges, departments, programmes, courses, students, registrations, venues, totalVenueCapacity: venueCapacity._sum.capacity ?? 0, invigilators, scheduled, session: activeSession?.name ?? "No active session", semester: activeSemester?.name ?? "No current semester", period: activePeriod?.name ?? "No examination period configured", configuredSlots, unregisteredCourses, latestGeneration, scheduledCourses: metrics?.scheduledCourses ?? 0, unscheduledGenerationCourses: metrics?.unscheduledCourses ?? 0, databaseReady: true };
  } catch {
    return { colleges: 0, departments: 0, programmes: 0, courses: 0, students: 0, registrations: 0, venues: 0, totalVenueCapacity: 0, invigilators: 0, scheduled: 0, session: "Database not connected", semester: "Not available", period: "Not available", configuredSlots: 0, unregisteredCourses: 0, latestGeneration: null, scheduledCourses: 0, unscheduledGenerationCourses: 0, databaseReady: false };
  }
}

const statCards = [
  { key: "courses", label: "Active courses", icon: GraduationCap, tone: "teal" },
  { key: "students", label: "Students represented", icon: Users, tone: "blue" },
  { key: "venues", label: "Available venues", icon: Warehouse, tone: "amber" },
  { key: "invigilators", label: "Active invigilators", icon: Activity, tone: "purple" },
] as const;

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-semibold text-teal">OPERATIONS OVERVIEW</p><h1 className="text-3xl font-bold tracking-tight text-navy">Good morning, examination team</h1><p className="mt-2 text-sm text-slate-500">A focused view of your examination planning workspace.</p></div><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><CalendarCheck2 className="h-4 w-4 text-teal" /><span>Active session: <strong className="text-navy">{stats.session}</strong></span></div></div>
      {!stats.databaseReady && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Database connection is not configured</p><p className="mt-1 leading-6">Add DATABASE_URL to your local environment, run Prisma setup, and seed the sample institution data to activate live counts.</p></div></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statCards.map((card) => { const Icon = card.icon; const value = stats[card.key]; return <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-start justify-between"><div className="rounded-lg bg-slate-100 p-2.5 text-teal"><Icon className="h-5 w-5" /></div><ArrowUpRight className="h-4 w-4 text-slate-300" /></div><p className="mt-5 text-3xl font-bold tracking-tight text-navy">{value.toLocaleString()}</p><p className="mt-1 text-sm text-slate-500">{card.label}</p></div>; })}</div>
      <section className="rounded-xl border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-bold text-navy">Academic configuration</h2><p className="mt-1 text-sm text-slate-500">Live setup state that will feed the timetable workflow.</p></div><div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"><SetupMetric label="Active colleges" value={stats.colleges} href="/academic-setup/colleges" /><SetupMetric label="Active departments" value={stats.departments} href="/academic-setup/departments" /><SetupMetric label="Active programmes" value={stats.programmes} href="/academic-setup/programmes" /><SetupMetric label="Configured time slots" value={stats.configuredSlots} href="/academic-setup/time-slots" /><SetupMetric label="Current semester" value={stats.semester} href="/academic-setup/semesters" /><SetupMetric label="Examination period" value={stats.period} href="/academic-setup/exam-periods" /></div></section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-bold text-navy">Examination data</h2><p className="mt-1 text-sm text-slate-500">Live resource state before timetable generation.</p></div><div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"><SetupMetric label="Course registrations" value={stats.registrations} href="/examination-data/registrations" /><SetupMetric label="Total venue capacity" value={stats.totalVenueCapacity} href="/examination-data/venues" /><SetupMetric label="Current semester" value={stats.semester} href="/academic-setup/semesters" /><SetupMetric label="Examination period" value={stats.period} href="/academic-setup/exam-periods" /></div></section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-bold text-navy">Latest timetable generation</h2><p className="mt-1 text-sm text-slate-500">The current generation status for examination operations.</p></div>{stats.latestGeneration ? <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"><SetupMetric label="Generation status" value={`${stats.latestGeneration.reviewStatus} · ${stats.latestGeneration.status}`} href={`/timetable/generations/${stats.latestGeneration.id}`} /><SetupMetric label="Generation score" value={stats.latestGeneration.score ?? "—"} href={`/timetable/generations/${stats.latestGeneration.id}`} /><SetupMetric label="Scheduled courses" value={stats.scheduledCourses} href={`/timetable/generations/${stats.latestGeneration.id}`} /><SetupMetric label="Unscheduled courses" value={stats.unscheduledGenerationCourses} href="/timetable/conflicts" /></div> : <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-navy">No timetable generated yet.</p><p className="mt-1 text-sm text-slate-500">Run readiness checks before starting the first generation.</p></div><Link href="/timetable" className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">Generate timetable</Link></div>}</section>
      {stats.databaseReady && (stats.unregisteredCourses > 0 || stats.period === "No examination period configured") && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-900">Data readiness</h2><div className="mt-3 space-y-2 text-sm text-amber-800">{stats.unregisteredCourses > 0 && <p>{stats.unregisteredCourses} active course{stats.unregisteredCourses === 1 ? " has" : "s have"} no registrations.</p>}{stats.period === "No examination period configured" && <p>No active examination period has been configured.</p>}</div></section>}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-card"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="font-bold text-navy">Timetable readiness</h2><p className="mt-1 text-sm text-slate-500">The checks that matter before generation begins.</p></div><Button variant="outline" size="sm">Open checklist</Button></div><div className="space-y-1 p-3"><ReadinessRow label="Academic session configured" detail={stats.session} complete={stats.databaseReady && stats.session !== "No active session"} /><ReadinessRow label="Examination resources available" detail={`${stats.venues} venues · ${stats.invigilators} invigilators`} complete={stats.databaseReady && stats.venues > 0 && stats.invigilators > 0} /><ReadinessRow label="Course and registration data" detail={`${stats.courses} active courses · ${stats.students} students`} complete={stats.databaseReady && stats.courses > 0} /><ReadinessRow label="Timetable review status" detail={stats.scheduled > 0 ? `${stats.scheduled} examinations scheduled` : "No timetable generated yet"} complete={stats.scheduled > 0} /></div></section>
        <section className="rounded-xl border border-slate-200 bg-white shadow-card"><div className="border-b border-slate-100 px-6 py-5"><h2 className="font-bold text-navy">Next actions</h2><p className="mt-1 text-sm text-slate-500">Keep the setup moving.</p></div><div className="space-y-3 p-5"><ActionRow icon={GraduationCap} label="Configure academic structure" href="/academic-setup" /><ActionRow icon={Users} label="Import student registrations" href="/examination-data/import-registrations" /><ActionRow icon={CalendarCheck2} label="Prepare a timetable" href="/timetable" /></div></section>
      </div>
      <div className="flex items-center gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400"><Clock3 className="h-4 w-4" />Last updated just now <span className="mx-1">·</span><CheckCircle2 className="h-4 w-4 text-emerald-500" />System foundation ready</div>
    </div>
  );
}

function ReadinessRow({ label, detail, complete }: { label: string; detail: string; complete: boolean }) {
  return <div className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-slate-50"><div className={complete ? "rounded-full bg-emerald-100 p-1.5 text-emerald-600" : "rounded-full bg-amber-100 p-1.5 text-amber-600"}>{complete ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700">{label}</p><p className="mt-0.5 truncate text-xs text-slate-400">{detail}</p></div><span className={complete ? "text-xs font-semibold text-emerald-600" : "text-xs font-semibold text-amber-600"}>{complete ? "Ready" : "Pending"}</span></div>;
}

function ActionRow({ icon: Icon, label, href }: { icon: typeof GraduationCap; label: string; href: string }) {
  return <a href={href} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:border-teal/30 hover:bg-teal/5"><span className="rounded-lg bg-teal/10 p-2 text-teal"><Icon className="h-4 w-4" /></span><span className="flex-1 text-sm font-semibold text-slate-700">{label}</span><ArrowUpRight className="h-4 w-4 text-slate-400" /></a>;
}

function SetupMetric({ label, value, href }: { label: string; value: string | number; href: string }) {
  return <a href={href} className="rounded-lg border border-slate-100 p-4 transition hover:border-teal/30 hover:bg-teal/5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 truncate text-lg font-bold text-navy">{typeof value === "number" ? value.toLocaleString() : value}</p></a>;
}
