import Link from "next/link";
import { ArrowRight, BookOpen, FileSpreadsheet, GraduationCap, ShieldCheck, Upload, Users, Warehouse } from "lucide-react";

const areas = [
  { href: "/examination-data/courses", label: "Courses", text: "Courses, programme relationships, and registration counts.", icon: BookOpen },
  { href: "/examination-data/students", label: "Students", text: "Scheduling-relevant student records and registration details.", icon: Users },
  { href: "/examination-data/registrations", label: "Course registrations", text: "Review and manage student-course registrations.", icon: GraduationCap },
  { href: "/examination-data/import-registrations", label: "Import registrations", text: "Preview and confirm local CSV imports transactionally.", icon: Upload },
  { href: "/examination-data/venues", label: "Venues", text: "Capacity, location, and unavailability periods.", icon: Warehouse },
  { href: "/examination-data/invigilators", label: "Invigilators", text: "Staff workload limits and unavailable periods.", icon: ShieldCheck },
];

export default function ExaminationDataPage() { return <div className="space-y-8"><div><p className="mb-2 text-sm font-semibold text-teal">EXAMINATION DATA</p><h1 className="text-3xl font-bold tracking-tight text-navy">Prepare the scheduling data</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Keep course, student, registration, venue, and invigilator data clean before the timetable engine is introduced.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map(({ href, label, text, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-teal/40"><div className="flex items-start justify-between"><span className="rounded-xl bg-teal/10 p-3 text-teal"><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-teal" /></div><h2 className="mt-5 font-bold text-navy">{label}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></Link>)}</div><div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card"><FileSpreadsheet className="mt-0.5 h-5 w-5 text-teal" /><div><p className="font-semibold text-navy">Import format</p><p className="mt-1 text-sm leading-6 text-slate-500">CSV imports require matric_number, student_name, programme, level, and course_code. Unknown programmes or courses are rejected during preview.</p></div></div></div>; }
