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
type GenerationMode = "LEGACY_REGISTRATION" | "AGGREGATE_EVENT";
type SchedulingMode = "FIXED_SESSIONS" | "FLEXIBLE_INTERVALS";
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

const readinessCopy: Record<string, string> = {
  NO_COURSE_OFFERINGS: "No course loads are ready for this session. Load course offerings before generating.",
  MISSING_CANDIDATE_COUNT: "Some course loads are missing candidate counts. Complete the candidate totals in Course Loads.",
  UNRESOLVED_EXAM_MODE: "Some course loads do not have an examination mode. Set the mode in Course Loads.",
  UNRESOLVED_DURATION: "Some course loads do not have an exam duration. Set the duration in Course Loads.",
  INCOMPATIBLE_AUTO_AGGREGATION: "Some course loads cannot be combined into compatible exam events. Review Course Loads.",
  NO_EXAM_EVENTS: "No exam events are ready yet. Confirm the compatible course loads first.",
  UNMATERIALIZED_OFFERING: "Some course loads are not included in an exam event. Review Course Loads.",
  INVALID_EXPLICIT_CONFLICT: "A recorded academic conflict does not match the selected course loads. Review Conflicts.",
  INACTIVE_RESOURCE: "The selected examination period is inactive. Choose an active period.",
  NO_FEASIBLE_SLOT: "No usable examination session is available for the selected period.",
  EVENT_DURATION_EXCEEDS_SLOT: "An examination is longer than every preferred session. Add a suitable session in Exam Period.",
  INSUFFICIENT_VENUE_CAPACITY: "Written hall capacity is not enough for one or more examinations. Review Venues.",
  INSUFFICIENT_INVIGILATORS: "At least one active invigilator is required before generating.",
  NO_CBT_VENUES: "No active CBT venue has usable computer capacity.",
  NO_CBT_TECHNICAL_SUPPORT: "No active technical-support staff are available for CBT sittings.",
  CBT_BATCHING_DISABLED_FOR_OVERSIZED_EVENT: "A CBT examination is larger than the available computers and batching is disabled.",
};

const readinessActions: Record<string, { href: string; label: string }> = {
  NO_COURSE_OFFERINGS: { href: "/exam-planning/course-loads", label: "Open Course Loads" },
  MISSING_CANDIDATE_COUNT: { href: "/exam-planning/course-loads", label: "Open Course Loads" },
  UNRESOLVED_EXAM_MODE: { href: "/exam-planning/course-loads", label: "Open Course Loads" },
  UNRESOLVED_DURATION: { href: "/exam-planning/course-loads", label: "Open Course Loads" },
  INCOMPATIBLE_AUTO_AGGREGATION: { href: "/exam-planning/course-loads", label: "Open Course Loads" },
  INVALID_EXPLICIT_CONFLICT: { href: "/exam-planning/conflicts", label: "Open Conflicts" },
  EVENT_DURATION_EXCEEDS_SLOT: { href: "/exam-planning/period", label: "Open Exam Period" },
  INSUFFICIENT_VENUE_CAPACITY: { href: "/examination-data/venues", label: "Open Venues" },
};

function issueMessage(item: Row) {
  return readinessCopy[text(item.code)] ?? (text(item.message) || "This setup item needs attention before generation.");
}

function issueAction(item: Row) {
  return readinessActions[text(item.code)];
}

function practicalReason(item: Row) {
  const diagnostics = item.diagnostics as Row | undefined;
  const attempted = rows(diagnostics?.attemptedSlots);
  // Attempted slots don't carry their own start/end time (SlotEvaluation / AggregateSlotEvaluation
  // never populate those fields), so duration has to be read from each slot's own hard violations
  // rather than recomputed here. The engine already flags this exact case with
  // EVENT_DURATION_EXCEEDS_SLOT when it evaluates a slot for the aggregate engine.
  if (attempted.length && attempted.every((slot) => rows(slot.hardViolations).some((violation) => text(violation.code) === "EVENT_DURATION_EXCEEDS_SLOT"))) {
    return `No ${Number(diagnostics?.durationMinutes ?? 0)}-minute examination session remained.`;
  }
  if (text(item.reason) === "NO_FEASIBLE_SLOT") return "No valid examination session remained after academic, venue, and invigilator checks.";
  return issueMessage(item);
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
  const [generationMode, setGenerationMode] = useState<GenerationMode>("AGGREGATE_EVENT");
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>("FIXED_SESSIONS");
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
  const unscheduled = rows(candidate?.unscheduledEvents ?? candidate?.unscheduledCourses);
  const hardViolations = rows(validation?.violations);
  const sessionsUsed = new Set(schedules.map((schedule) => `${text(schedule.date ?? (schedule.timeSlot as Row)?.date)}|${text(schedule.startTime ?? (schedule.timeSlot as Row)?.startTime)}|${text(schedule.endTime ?? (schedule.timeSlot as Row)?.endTime)}`)).size;
  const hallsUsed = new Set(schedules.flatMap((schedule) => rows(schedule.venues).map((venue) => text(venue.venueId)))).size;

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
        `${generationMode === "AGGREGATE_EVENT" ? "/api/exams/generate/readiness" : "/api/timetable/readiness"}?academicSessionId=${sessionId}&semesterId=${semesterId}&examPeriodId=${periodId}&schedulingMode=${schedulingMode}`,
        { cache: "no-store" },
      );
      const readinessBody = await readinessResponse.json();
      if (!readinessResponse.ok) throw new Error(readinessBody.error?.message ?? "Unable to analyze input data.");
      setReadiness(readinessBody.data);

      if (rows(readinessBody.data?.blockers).length > 0) {
        throw new Error("The input data has blockers. Fix the listed issues before generating a timetable.");
      }

      setPhase("generating");
      const generationResponse = await fetch(generationMode === "AGGREGATE_EVENT" ? "/api/exams/generate" : "/api/timetable/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicSessionId: sessionId, semesterId, examPeriodId: periodId, attempts, seed, schedulingMode }),
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
                Timetable generation
              </span>
              <Link href="/timetable/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
                <FileClock className="h-4 w-4" />
                History
              </Link>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-navy lg:text-4xl">
              Check readiness, then generate the exam timetable.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Start with BOUESTI&apos;s preferred examination sessions. The review opens as soon as generation finishes.
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
              Timetable setup
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Data source<select value={generationMode} onChange={(event) => { setGenerationMode(event.target.value as GenerationMode); resetOutput(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-teal"><option value="AGGREGATE_EVENT">Course loads and exam events (recommended)</option><option value="LEGACY_REGISTRATION">Legacy registration timetable</option></select></label>
              {generationMode === "AGGREGATE_EVENT" && <label className="block text-sm font-semibold text-slate-700">Session timing<select value={schedulingMode} onChange={(event) => { setSchedulingMode(event.target.value as SchedulingMode); resetOutput(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-teal"><option value="FIXED_SESSIONS">Preferred sessions (recommended)</option><option value="FLEXIBLE_INTERVALS">Custom intervals (advanced)</option></select></label>}<p className="mt-1 text-xs leading-5 text-slate-500">Preferred sessions use the times configured for the examination period.</p>
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

            <details className="rounded-lg border border-slate-200 bg-white px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Advanced generation options</summary><div className="mt-3 grid grid-cols-2 gap-3">
              <NumberInput label="Attempts" min={1} max={100} value={attempts} onChange={setAttempts} />
              <NumberInput label="Seed" value={seed} onChange={setSeed} />
            </div></details>

            <Button disabled={!writable || loading || !sessionId || !semesterId || !periodId} size="lg" className="mt-6 w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {phase === "checking" ? "Checking readiness" : phase === "generating" ? "Generating timetable" : phase === "loading" ? "Opening review" : "Generate timetable"}
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
        <ReadinessIssues blockers={blockers} warnings={warnings} />
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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Metric label={generationMode === "AGGREGATE_EVENT" ? "Scheduled events" : "Scheduled courses"} value={generationMode === "AGGREGATE_EVENT" ? metrics?.scheduledEvents : metrics?.scheduledCourses} />
            <Metric label="Unscheduled" value={generationMode === "AGGREGATE_EVENT" ? metrics?.unscheduledEvents : metrics?.unscheduledCourses} tone={Number((generationMode === "AGGREGATE_EVENT" ? metrics?.unscheduledEvents : metrics?.unscheduledCourses) ?? 0) ? "warn" : "good"} />
            <Metric label="Candidates" value={generationMode === "AGGREGATE_EVENT" ? metrics?.candidateWorkload : metrics?.totalCandidates} />
            <Metric label="Sessions used" value={sessionsUsed} />
            <Metric label="Halls used" value={hallsUsed} />
            <Metric label="Hard violations" value={metrics?.hardViolationCount} tone={Number(metrics?.hardViolationCount ?? 0) ? "warn" : "good"} />
            <Metric label="Score" value={generation.score} />
          </section>

          {(unscheduled.length > 0 || hardViolations.length > 0) && <GenerationIssues unscheduled={unscheduled} violations={hardViolations} />}

          <TimetableSheet schedules={schedules} aggregate={generationMode === "AGGREGATE_EVENT"} />
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

function ReadinessIssues({ blockers, warnings }: { blockers: Row[]; warnings: Row[] }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h2 className="font-bold text-navy">Fix these items before generating</h2>
          <p className="mt-1 text-sm text-amber-800">
            {blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} must be resolved before generation.` : "No blockers found. Review the warnings below before continuing."}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {[...blockers, ...warnings].map((item, index) => (
          <div key={`${text(item.code)}-${index}`} className="rounded-lg border border-white/70 bg-white/70 p-3 text-sm text-slate-700">
            <strong>{item.severity === "WARNING" ? "Review recommended" : "Action required"}</strong>
            <p className="mt-1">{issueMessage(item)}</p>
            {issueAction(item) && <Link className="mt-2 inline-flex text-xs font-semibold text-teal hover:text-navy" href={issueAction(item)!.href}>{issueAction(item)!.label} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>}
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

function GenerationIssues({ unscheduled, violations }: { unscheduled: Row[]; violations: Row[] }) {
  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
    <h2 className="font-bold text-navy">Examinations needing attention</h2>
    <p className="mt-1 text-sm text-amber-800">Review these practical reasons before opening the full timetable review.</p>
    <div className="mt-4 space-y-2">
      {unscheduled.map((item, index) => <div key={`unscheduled-${index}`} className="rounded-lg border border-white/70 bg-white/70 p-3 text-sm text-slate-700"><strong>{text(item.title ?? item.eventId ?? item.code ?? "Examination")}</strong><p className="mt-1">{practicalReason(item)}</p></div>)}
      {violations.map((item, index) => <div key={`violation-${index}`} className="rounded-lg border border-white/70 bg-white/70 p-3 text-sm text-slate-700"><strong>Timetable check</strong><p className="mt-1">{text(item.message) || "This timetable check needs attention before opening the full review."}</p></div>)}
    </div>
  </section>;
}

function TimetableSheet({ schedules, aggregate = false }: { schedules: Row[]; aggregate?: boolean }) {
  const grouped = new Map<string, Row[]>();
  schedules.forEach((schedule) => {
    const slot = schedule.timeSlot as Row | null;
    const date = text(schedule.date ?? slot?.date);
    grouped.set(date, [...(grouped.get(date) ?? []), schedule]);
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
                    {!aggregate && <><th className="border border-slate-200 px-3 py-3">Population</th><th className="border border-slate-200 px-3 py-3">Venue</th><th className="border border-slate-200 px-3 py-3">Invigilators</th></>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((schedule) => {
                    const slot = schedule.timeSlot as Row | null;
                    const course = schedule.course as Row;
                    const event = (schedule.eventSummary ?? schedule.event) as Row;
                    return (
                      <tr key={text(schedule.id)} className="align-top">
                        <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-600">{formatShortDate(schedule.date ?? slot?.date)}</td>
                        <td className="border border-slate-200 px-3 py-3 text-slate-600">{text(schedule.startTime ?? slot?.startTime)} - {text(schedule.endTime ?? slot?.endTime)}</td>
                        <td className="border border-slate-200 px-3 py-3 font-bold text-navy">{aggregate ? text(event?.title ?? schedule.eventId) : text(course?.code)}</td>
                        <td className="border border-slate-200 px-3 py-3 text-slate-600">{aggregate ? text(event?.examMode) : text(course?.title)}</td>
                        {!aggregate && <><td className="border border-slate-200 px-3 py-3 font-semibold text-slate-700">{num(schedule.candidateCount)}</td><td className="border border-slate-200 px-3 py-3 font-semibold text-slate-700">{venueNames(schedule)}</td><td className="border border-slate-200 px-3 py-3 text-slate-600">{invigilatorNames(schedule)}</td></>}
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
