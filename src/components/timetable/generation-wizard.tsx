"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Row = Record<string, any>;
type Option = { value: string; label: string };

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function num(value: unknown) {
  return Number(value ?? 0).toLocaleString();
}

function rows(value: unknown) {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function formatDate(value: unknown) {
  const date = new Date(text(value));
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: unknown) {
  const date = new Date(text(value));
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function venueNames(schedule: Row) {
  return rows(schedule.venues)
    .map((item) => text((item.venue as Row)?.code ?? item.venueId))
    .join(" + ") || "No venue";
}

function invigilatorNames(schedule: Row) {
  return rows(schedule.invigilators)
    .map((item) => text((item.invigilator as Row)?.name ?? item.invigilatorId))
    .join(", ") || "Unassigned";
}

export function GenerationWizard({ role }: { role: string }) {
  const writable = ["SUPER_ADMIN", "ADMIN", "EXAM_OFFICER"].includes(role);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [semesters, setSemesters] = useState<Row[]>([]);
  const [periods, setPeriods] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [attempts, setAttempts] = useState(30);
  const [seed, setSeed] = useState(2025);
  const [phase, setPhase] = useState<"idle" | "checking" | "generating" | "loading">("idle");
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/academic/sessions?active=true").then((response) => response.json()),
      fetch("/api/academic/semesters?active=true").then((response) => response.json()),
      fetch("/api/academic/exam-periods?active=true").then((response) => response.json()),
    ]).then(([sessionBody, semesterBody, periodBody]) => {
      setSessions(sessionBody.data ?? []);
      setSemesters(semesterBody.data ?? []);
      setPeriods(periodBody.data ?? []);
    });
  }, []);

  const compatibleSemesters = useMemo(
    () => semesters.filter((semester) => !sessionId || text(semester.academicSessionId) === sessionId),
    [semesters, sessionId],
  );
  const compatiblePeriods = useMemo(
    () =>
      periods.filter(
        (period) =>
          (!sessionId || text(period.sessionId) === sessionId) &&
          (!semesterId || text(period.semesterId) === semesterId),
      ),
    [periods, sessionId, semesterId],
  );
  const selectedPeriod = compatiblePeriods.find((period) => text(period.id) === periodId);
  const selectedSession = sessions.find((item) => text(item.id) === sessionId);
  const selectedSemester = semesters.find((item) => text(item.id) === semesterId);
  const loading = phase !== "idle";
  const generation = detail?.generation as Row | undefined;
  const candidate = detail?.candidate as Row | undefined;
  const validation = detail?.validation as Row | undefined;
  const schedules = rows(generation?.schedules);
  const metrics = candidate?.metrics as Row | undefined;
  const blockers = rows(readiness?.blockers);
  const warnings = rows(readiness?.warnings);

  function resetOutput() {
    setReadiness(null);
    setDetail(null);
    setError("");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !semesterId || !periodId) {
      setError("Choose the academic session, semester, and exam period to analyze.");
      return;
    }

    setError("");
    setDetail(null);
    setReadiness(null);

    try {
      setPhase("checking");
      const readinessResponse = await fetch(
        `/api/timetable/readiness?academicSessionId=${sessionId}&semesterId=${semesterId}&examPeriodId=${periodId}`,
        { cache: "no-store" },
      );
      const readinessBody = await readinessResponse.json();
      if (!readinessResponse.ok) throw new Error(readinessBody.error?.message ?? "Unable to analyze input data.");
      setReadiness(readinessBody.data);

      if (rows(readinessBody.data?.blockers).length > 0) {
        throw new Error("The input data has blockers. Fix the listed issues before generating a timetable.");
      }

      setPhase("generating");
      const generationResponse = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicSessionId: sessionId, semesterId, examPeriodId: periodId, attempts, seed }),
      });
      const generationBody = await generationResponse.json();
      if (!generationResponse.ok) throw new Error(generationBody.error?.message ?? "Generation failed.");

      const generationId = text(generationBody.data?.generation?.id);
      if (!generationId) throw new Error("Generation completed, but no timetable ID was returned.");

      setPhase("loading");
      const detailResponse = await fetch(`/api/timetable/generations/${generationId}`, { cache: "no-store" });
      const detailBody = await detailResponse.json();
      if (!detailResponse.ok) throw new Error(detailBody.error?.message ?? "Generated timetable could not be loaded.");
      setDetail(detailBody.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal">
                <Sparkles className="h-3.5 w-3.5" />
                Premium timetable analyzer
              </span>
              <Link href="/timetable/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
                <FileClock className="h-4 w-4" />
                History
              </Link>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-navy lg:text-4xl">
              Select the input data, click Analyze, get the exam timetable.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              The engine reads registrations, courses, venues, invigilators, and time slots for the selected period,
              then produces a printable schedule in one run.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Signal icon={Database} label="Inputs" value="Academic data" />
              <Signal icon={BarChart3} label="Checks" value={readiness ? (blockers.length ? "Blocked" : "Ready") : "Automatic"} />
              <Signal icon={CalendarDays} label="Output" value={schedules.length ? `${num(schedules.length)} exams` : "Timetable"} />
            </div>
          </div>

          <form onSubmit={analyze} className="border-t border-slate-200 bg-slate-50 p-6 xl:border-l xl:border-t-0 lg:p-8">
            <div className="flex items-center gap-2 text-sm font-bold text-navy">
              <Clock3 className="h-4 w-4 text-teal" />
              Input data
            </div>
            <div className="mt-5 space-y-4">
              <Select
                label="Academic session"
                value={sessionId}
                options={sessions.map((item) => ({ value: text(item.id), label: text(item.name) }))}
                onChange={(value) => {
                  setSessionId(value);
                  setSemesterId("");
                  setPeriodId("");
                  resetOutput();
                }}
              />
              <Select
                label="Semester"
                value={semesterId}
                options={compatibleSemesters.map((item) => ({ value: text(item.id), label: text(item.name) }))}
                onChange={(value) => {
                  setSemesterId(value);
                  setPeriodId("");
                  resetOutput();
                }}
              />
              <Select
                label="Examination period"
                value={periodId}
                options={compatiblePeriods.map((item) => ({ value: text(item.id), label: text(item.name) }))}
                onChange={(value) => {
                  setPeriodId(value);
                  resetOutput();
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <NumberInput label="Attempts" min={1} max={100} value={attempts} onChange={setAttempts} />
              <NumberInput label="Seed" value={seed} onChange={setSeed} />
            </div>

            <Button disabled={!writable || loading} size="lg" className="mt-6 w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {phase === "checking" ? "Analyzing data" : phase === "generating" ? "Building timetable" : phase === "loading" ? "Preparing output" : "Analyze"}
            </Button>
            {!writable && <p className="mt-3 text-xs text-slate-500">Your role is read-only. An exam officer or administrator can run analysis.</p>}
          </form>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>Analysis stopped</strong>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {readiness && !detail && (
        <ReadinessIssues readiness={readiness} blockers={blockers} warnings={warnings} />
      )}

      {detail && generation && (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Expected output ready</p>
                  <h2 className="mt-1 text-xl font-bold text-navy">{text((generation.period as Row)?.name ?? selectedPeriod?.name)}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {text(selectedSession?.name)} · {text(selectedSemester?.name)} · {validation?.valid ? "Validated timetable" : "Generated with diagnostics"}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Review workspace</p>
              <Link
                href={`/timetable/generations/${text(generation.id)}`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
              >
                Open full review <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Scheduled courses" value={metrics?.scheduledCourses} />
            <Metric label="Unscheduled" value={metrics?.unscheduledCourses} tone={Number(metrics?.unscheduledCourses ?? 0) ? "warn" : "good"} />
            <Metric label="Candidates" value={metrics?.totalCandidates} />
            <Metric label="Hard violations" value={metrics?.hardViolationCount} tone={Number(metrics?.hardViolationCount ?? 0) ? "warn" : "good"} />
            <Metric label="Score" value={generation.score} />
          </section>

          <TimetableSheet schedules={schedules} />
        </>
      )}
    </div>
  );
}

function Signal({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <Icon className="h-5 w-5 text-teal" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-navy">{value}</p>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-teal"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-teal"
      />
    </label>
  );
}

function ReadinessIssues({ readiness, blockers, warnings }: { readiness: Row; blockers: Row[]; warnings: Row[] }) {
  const summary = readiness.summary as Row;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h2 className="font-bold text-navy">Input data needs attention</h2>
          <p className="mt-1 text-sm text-amber-800">
            Courses: {num(summary?.courses)} · Students: {num(summary?.students)} · Registrations: {num(summary?.registrations)} · Time slots: {num(summary?.timeSlots)}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {[...blockers, ...warnings].map((item, index) => (
          <div key={`${text(item.code)}-${index}`} className="rounded-lg border border-white/70 bg-white/70 p-3 text-sm text-slate-700">
            <strong>{text(item.code)}</strong>
            <p className="mt-1">{text(item.message)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: unknown; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-navy";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{num(value)}</p>
    </div>
  );
}

function TimetableSheet({ schedules }: { schedules: Row[] }) {
  const grouped = new Map<string, Row[]>();
  schedules.forEach((schedule) => {
    const slot = schedule.timeSlot as Row;
    grouped.set(text(slot.date), [...(grouped.get(text(slot.date)) ?? []), schedule]);
  });

  if (!schedules.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No timetable assignments were produced.</div>;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 bg-navy px-5 py-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-100">Pen on paper output</p>
        <h2 className="mt-1 text-xl font-bold">Examination timetable</h2>
      </div>
      <div className="divide-y divide-slate-200">
        {[...grouped.entries()].map(([date, items], dayIndex) => (
          <div key={date} className="p-4 lg:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-teal">Day {dayIndex + 1}</p>
                <h3 className="text-lg font-bold text-navy">{formatDate(date)}</h3>
              </div>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                {items.length} exam{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="border border-slate-200 px-3 py-3">Date</th>
                    <th className="border border-slate-200 px-3 py-3">Time</th>
                    <th className="border border-slate-200 px-3 py-3">Course code</th>
                    <th className="border border-slate-200 px-3 py-3">Course title</th>
                    <th className="border border-slate-200 px-3 py-3">Population</th>
                    <th className="border border-slate-200 px-3 py-3">Venue</th>
                    <th className="border border-slate-200 px-3 py-3">Invigilators</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((schedule) => {
                    const slot = schedule.timeSlot as Row;
                    const course = schedule.course as Row;
                    return (
                      <tr key={text(schedule.id)} className="align-top">
                        <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-600">{formatShortDate(slot.date)}</td>
                        <td className="border border-slate-200 px-3 py-3 text-slate-600">{text(slot.startTime)} - {text(slot.endTime)}</td>
                        <td className="border border-slate-200 px-3 py-3 font-bold text-navy">{text(course.code)}</td>
                        <td className="border border-slate-200 px-3 py-3 text-slate-600">{text(course.title)}</td>
                        <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-700">{num(schedule.candidateCount)}</td>
                        <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-700">{venueNames(schedule)}</td>
                        <td className="border border-slate-200 px-3 py-3 text-slate-600">{invigilatorNames(schedule)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
