import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardList, Command, FileClock, GraduationCap, LayoutDashboard, Settings2, ShieldAlert, ShieldCheck, Users, Warehouse, Database, FileSpreadsheet, Calculator } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Academic setup", href: "/academic-setup", icon: GraduationCap },
  { label: "Examination data", href: "/examination-data", icon: Database },
  { label: "Course Loads", href: "/exam-planning/course-loads", icon: FileSpreadsheet },
  { label: "Aggregate Conflicts", href: "/exam-planning/conflicts", icon: ShieldAlert },
  { label: "Exam Calendar", href: "/exam-planning/period", icon: CalendarDays },
  { label: "CBT Planning", href: "/exam-planning/cbt", icon: Calculator },
  { label: "Courses", href: "/examination-data/courses", icon: BookOpen },
  { label: "Students", href: "/examination-data/students", icon: Users },
  { label: "Registrations", href: "/examination-data/registrations", icon: GraduationCap },
  { label: "Venues", href: "/examination-data/venues", icon: Warehouse },
  { label: "Invigilators", href: "/examination-data/invigilators", icon: ShieldCheck },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
  { label: "Generation history", href: "/timetable/history", icon: FileClock },
  { label: "Conflict centre", href: "/timetable/conflicts", icon: ClipboardList },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; email: string; role?: string | null } }) {
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white"><Command className="h-4 w-4" /></div>
          <div><p className="font-bold tracking-tight text-navy">Exam Pilot</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">BOUESTI Science</p></div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6" aria-label="Main navigation">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          {navigation.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy", item.href === "/dashboard" && "bg-slate-100 text-navy")}><Icon className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />{item.label}</Link>; })}
          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Administration</p>
          <Link href="/settings" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy"><Settings2 className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />Settings</Link>
          <Link href="/audit-log" className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy"><FileClock className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />Audit log</Link>
        </nav>
        <div className="border-t border-slate-100 p-4"><div className="mb-3 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy">{user.name}</p><p className="truncate text-xs text-slate-400">{user.role ?? "VIEWER"}</p></div></div><SignOutButton /></div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8"><div className="flex items-center gap-3 lg:hidden"><Command className="h-5 w-5 text-teal" /><span className="font-bold text-navy">Exam Pilot</span></div><div className="ml-auto flex items-center gap-4"><span className="hidden text-sm text-slate-500 sm:block">{user.email}</span><div className="h-2 w-2 rounded-full bg-emerald-500" title="System online" /></div></header>
        <main className="mx-auto max-w-[1600px] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
