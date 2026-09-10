"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Row = Record<string, any>;
function s(value: unknown) { return value == null ? "" : String(value); }
function arr(value: unknown) { return Array.isArray(value) ? value as Row[] : []; }
function formatDate(value: unknown) {
  const date = s(value);
  return date ? new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "UTC" }) : "";
}

export function DiagnosticsCentre() {
  const [generations, setGenerations] = useState<Row[]>([]);
  const [generationId, setGenerationId] = useState("");
  const [report, setReport] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/timetable/history", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load timetable generations.");
        const body = await response.json();
        const rows = arr(body.data);
        setGenerations(rows);
        if (rows[0]?.id) setGenerationId(s(rows[0].id));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load timetable generations."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!generationId) { setReport(null); return; }
    setReportLoading(true);
    setError("");
    void fetch(`/api/timetable/conflicts?generationId=${encodeURIComponent(generationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "Unable to load hall collisions.");
        setReport(body.data ?? null);
      })
      .catch((caught) => { setReport(null); setError(caught instanceof Error ? caught.message : "Unable to load hall collisions."); })
      .finally(() => setReportLoading(false));
  }, [generationId]);

  if (loading) return <div className="p-12 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading hall collisions…</div>;

  const collisions = arr(report?.collisions);
  return <div className="space-y-6">
    <div>
      <p className="mb-2 text-sm font-semibold text-teal">EXAMINATION OPERATIONS</p>
      <h1 className="text-3xl font-bold tracking-tight text-navy">Exam hall collisions</h1>
      <p className="mt-2 text-sm text-slate-500">Find exams scheduled in the same hall at overlapping times so one can be moved.</p>
    </div>

    {error && <div role="alert" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

    {generations.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No timetable generations exist yet.</div> : <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <label className="text-sm font-semibold text-slate-700">Timetable generation
          <select value={generationId} onChange={(event) => setGenerationId(event.target.value)} className="mt-2 h-10 w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 font-normal">
            {generations.map((generation) => <option key={s(generation.id)} value={s(generation.id)}>{s((generation.period as Row)?.name)} · {new Date(s(generation.generatedAt)).toLocaleString()}</option>)}
          </select>
        </label>
      </section>

      {reportLoading ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Checking for collisions…</div> : collisions.length === 0 ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">No exam hall collisions found.</p><p className="mt-1">Every scheduled exam has a separate hall during its assigned time.</p></div></div> : <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-bold text-navy">{collisions.length} collision{collisions.length === 1 ? "" : "s"} to resolve</h2><Link href={`/timetable/generations/${generationId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal">Open timetable <ArrowRight className="h-4 w-4" /></Link></div>{collisions.map((collision, index) => <article key={`${s(collision.scheduleIds?.join("-"))}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Exam hall collision</p><h3 className="mt-1 font-bold text-amber-950">{formatDate(collision.date)} · {s(collision.startTime)}–{s(collision.endTime)}</h3><p className="mt-2 text-sm text-amber-900">{arr(collision.courseCodes).join(" and ")} are assigned at the same time.</p></div><Link href={`/timetable/generations/${generationId}`} className="shrink-0 text-sm font-semibold text-amber-800 hover:text-amber-950">Resolve <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div></article>)}</section>}
    </>}
  </div>;
}
