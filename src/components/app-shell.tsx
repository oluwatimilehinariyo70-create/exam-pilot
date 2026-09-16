"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CalendarDays, ClipboardList, Command, FileClock, GraduationCap, LayoutDashboard, Menu, Settings2, ShieldAlert, ShieldCheck, Users, Warehouse, Database, FileSpreadsheet, Calculator, X } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Academic setup", href: "/academic-setup", icon: GraduationCap },
  { label: "Exam period", href: "/exam-planning/period", icon: CalendarDays },
  { label: "Course loads", href: "/exam-planning/course-loads", icon: FileSpreadsheet },
  { label: "Venues", href: "/examination-data/venues", icon: Warehouse },
  { label: "Conflicts", href: "/exam-planning/conflicts", icon: ShieldAlert },
  { label: "CBT planning", href: "/exam-planning/cbt", icon: Calculator },
  { label: "Generate timetable", href: "/timetable", icon: CalendarDays },
  { label: "Review timetable", href: "/timetable/history", icon: ClipboardList },
];

const advancedNavigation = [
  { label: "Examination data", href: "/examination-data", icon: Database },
  { label: "Courses", href: "/examination-data/courses", icon: BookOpen },
  { label: "Students", href: "/examination-data/students", icon: Users },
  { label: "Registrations", href: "/examination-data/registrations", icon: GraduationCap },
  { label: "Invigilators", href: "/examination-data/invigilators", icon: ShieldCheck },
  { label: "Generation history", href: "/timetable/history", icon: FileClock },
  { label: "Conflict centre", href: "/timetable/conflicts", icon: ClipboardList },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; email: string; role?: string | null } }) {
  // The sidebar below is `hidden ... lg:flex` — below the lg breakpoint (1024px) it disappears
  // entirely with no fallback, which was the bug: on any narrower window there was no way to
  // navigate at all. This adds a hamburger-triggered drawer that renders the same nav content
  // below lg, closing itself whenever a link inside it is clicked.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = () => setMobileNavOpen(false);

  const sidebarBody = (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6" aria-label="Main navigation">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        {navigation.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={closeMobileNav} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy", item.href === "/dashboard" && "bg-slate-100 text-navy")}><Icon className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />{item.label}</Link>; })}
        <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Advanced</p>
        {advancedNavigation.map((item) => { const Icon = item.icon; return <Link key={`${item.href}-${item.label}`} href={item.href} onClick={closeMobileNav} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy"><Icon className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />{item.label}</Link>; })}
        <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Administration</p>
        <Link href="/settings" onClick={closeMobileNav} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy"><Settings2 className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />Settings</Link>
        <Link href="/audit-log" onClick={closeMobileNav} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-navy"><FileClock className="h-[18px] w-[18px] text-slate-400 group-hover:text-teal" />Audit log</Link>
      </nav>
      <div className="border-t border-slate-100 p-4"><div className="mb-3 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">{user.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy">{user.name}</p><p className="truncate text-xs text-slate-400">{user.role ?? "VIEWER"}</p></div></div><SignOutButton /></div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper">
      {/* Desktop sidebar (>= lg) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white"><Command className="h-4 w-4" /></div>
          <div><p className="font-bold tracking-tight text-navy">Exam Pilot</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">BOUESTI Science</p></div>
        </div>
        {sidebarBody}
      </aside>

      {/* Mobile nav drawer (< lg) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={closeMobileNav} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white"><Command className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="font-bold tracking-tight text-navy">Exam Pilot</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">BOUESTI Science</p></div>
              <button type="button" onClick={closeMobileNav} aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-navy"><X className="h-5 w-5" /></button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-navy lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="flex items-center gap-3 lg:hidden"><Command className="h-5 w-5 text-teal" /><span className="font-bold text-navy">Exam Pilot</span></div>
          </div>
          <div className="ml-auto flex items-center gap-4"><span className="hidden text-sm text-slate-500 sm:block">{user.email}</span><div className="h-2 w-2 rounded-full bg-emerald-500" title="System online" /></div>
        </header>
        <main className="mx-auto max-w-[1600px] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
