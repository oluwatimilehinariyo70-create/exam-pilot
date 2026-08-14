import { ArrowLeft, Construction, ShieldCheck } from "lucide-react";
import Link from "next/link";

const moduleContent: Record<string, { title: string; description: string; phase: string }> = {
  "academic-setup": { title: "Academic setup", description: "The institutional hierarchy, sessions, semesters, exam periods, and time slots will be managed here.", phase: "Phase 2" },
  courses: { title: "Courses", description: "Course records, programme relationships, activation, and bulk import will be managed here.", phase: "Phase 3" },
  students: { title: "Students & registration", description: "CSV preview, validation, duplicate detection, and registration import will be managed here.", phase: "Phase 3" },
  venues: { title: "Venues", description: "Venue capacity, availability, and active status will be managed here.", phase: "Phase 3" },
  invigilators: { title: "Invigilators", description: "Staff records, availability, and assignment load will be managed here.", phase: "Phase 3" },
  timetable: { title: "Timetable", description: "Generation, review, manual edits, approval, publication, and history will be managed here.", phase: "Phase 5" },
  conflicts: { title: "Conflict centre", description: "Hard constraint failures and missing-data issues will be reviewed here.", phase: "Phase 5" },
  settings: { title: "Settings", description: "Institution configuration, access policy, and environment-aware settings will be managed here.", phase: "Phase 7" },
  "audit-log": { title: "Audit log", description: "Critical administrative changes will be searchable here.", phase: "Phase 7" },
};

export default async function ModulePlaceholder({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const content = moduleContent[module] ?? { title: "Workspace module", description: "This module is part of the Exam Pilot roadmap.", phase: "Upcoming phase" };
  return <div className="mx-auto flex min-h-[65vh] max-w-2xl items-center justify-center"><div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card"><div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal"><Construction className="h-7 w-7" /></div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-teal">{content.phase}</p><h1 className="text-3xl font-bold tracking-tight text-navy">{content.title}</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{content.description}</p><div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-left"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" /><p className="text-xs leading-5 text-slate-500">Phase 1 establishes the secure application shell and data foundation. Functional workflows are intentionally delivered in their approved phases.</p></div><Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-teal hover:text-navy"><ArrowLeft className="h-4 w-4" />Back to overview</Link></div></div>;
}
