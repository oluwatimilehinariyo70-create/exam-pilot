"use client";

import { useState } from "react";
import { Check, Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = Record<string, any>;
type Session = { label: string; startTime: string; endTime: string };

const defaultSessions: Session[] = [
  { label: "Morning", startTime: "08:30", endTime: "11:30" },
  { label: "Midday", startTime: "12:00", endTime: "14:00" },
  { label: "Afternoon", startTime: "14:30", endTime: "17:30" },
];

export function BulkSlotGenerator({ periods, writable, onComplete }: { periods: Row[]; writable: boolean; onComplete: () => void }) {
  const [periodId, setPeriodId] = useState("");
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [sessions, setSessions] = useState<Session[]>(defaultSessions);
  const [excluded, setExcluded] = useState("");
  const [preview, setPreview] = useState<Row | null>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  const updateSession = (index: number, field: "startTime" | "endTime", value: string) => setSessions((current) => current.map((session, position) => position === index ? { ...session, [field]: value } : session));

  async function generatePreview() {
    setPending(true); setMessage("");
    try {
      const dailySessions = sessions.filter((session) => session.startTime && session.endTime).map(({ startTime, endTime }) => ({ startTime, endTime }));
      const response = await fetch("/api/academic/time-slots/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examPeriodId: periodId, daysOfWeek: days, dailySessions, excludedDates: excluded.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), skipWeekends: true }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Unable to preview slots.");
      setPreview(body.data); setRemoved([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to preview slots."); } finally { setPending(false); }
  }

  async function confirmSlots() {
    if (!preview) return;
    setPending(true); setMessage("");
    try {
      const slots = preview.slots.filter((_slot: Row, index: number) => !removed.includes(index) && !_slot.duplicate && !_slot.collision).map((slot: Row) => ({ examPeriodId: periodId, date: slot.date, startTime: slot.startTime, endTime: slot.endTime }));
      const response = await fetch("/api/academic/time-slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slots) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Unable to save slots.");
      setMessage(`${slots.length} time slots saved.`); setPreview(null); onComplete();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save slots."); } finally { setPending(false); }
  }

  return <section className="rounded-xl border border-teal/20 bg-teal/[0.03] p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-teal/10 p-2 text-teal"><WandSparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-navy">Daily exam sessions</h2><p className="mt-1 text-sm leading-6 text-slate-500">Configure the sessions once, preview them across selected dates, then save the confirmed slots.</p></div></div>{writable ? <div className="mt-5 space-y-4"><div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><div><SelectField label="Examination period" value={periodId} options={periods.map((period) => ({ value: period.id, label: period.name }))} onChange={setPeriodId} /></div><div><span className="text-sm font-semibold text-slate-700">Exam dates</span><div className="mt-2 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((day) => <button type="button" key={day} onClick={() => toggleDay(day)} className={`rounded-md border px-2.5 py-2 text-xs font-semibold ${days.includes(day) ? "border-teal bg-teal text-white" : "border-slate-200 bg-white text-slate-500"}`}>{["", "Mon", "Tue", "Wed", "Thu", "Fri"][day]}</button>)}</div></div></div><div><span className="text-sm font-semibold text-slate-700">Sessions</span><div className="mt-2 space-y-2">{sessions.map((session, index) => <div key={session.label} className="grid items-center gap-2 sm:grid-cols-[7rem_1fr_1fr]"><span className="text-sm font-medium text-slate-600">{session.label}</span><label className="text-xs text-slate-400">Start<input aria-label={`${session.label} start time`} type="time" value={session.startTime} onChange={(event) => updateSession(index, "startTime", event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2 text-sm text-slate-700" /></label><label className="text-xs text-slate-400">End<input aria-label={`${session.label} end time`} type="time" value={session.endTime} onChange={(event) => updateSession(index, "endTime", event.target.value)} className="mt-1 h-9 w-full rounded border border-slate-200 px-2 text-sm text-slate-700" /></label></div>)}</div></div><label className="text-sm font-semibold text-slate-700">Excluded dates <span className="font-normal text-slate-400">(one YYYY-MM-DD per line)</span><textarea value={excluded} onChange={(event) => setExcluded(event.target.value)} rows={2} placeholder="2027-02-05" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal focus:ring-2 focus:ring-teal/20" /></label><Button type="button" onClick={() => void generatePreview()} disabled={pending || !periodId || days.length === 0 || sessions.every((session) => !session.startTime || !session.endTime)} className="gap-2">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Preview sessions</Button></div> : <p className="mt-5 text-sm text-slate-500">Your role can review saved slots but cannot generate new ones.</p>}{message && <p className="mt-4 text-sm font-semibold text-teal">{message}</p>}{preview && <div className="mt-5 rounded-lg border border-slate-200 bg-white"><div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-navy">Preview · {preview.period.name}</p><p className="text-xs text-slate-400">{preview.slots.length} proposed · {preview.existingCount} already saved{preview.collisions.length ? ` · ${preview.collisions.length} overlaps` : ""}</p></div>{writable && <Button size="sm" onClick={() => void confirmSlots()} disabled={pending || preview.slots.filter((slot: Row, index: number) => !removed.includes(index) && !slot.duplicate && !slot.collision).length === 0} className="gap-2"><Check className="h-4 w-4" />Confirm selected slots</Button>}</div><div className="max-h-64 overflow-y-auto p-3">{preview.slots.map((slot: Row, index: number) => <div key={`${slot.date}-${slot.startTime}-${index}`} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${removed.includes(index) ? "bg-slate-100 text-slate-400 line-through" : slot.duplicate || slot.collision ? "bg-amber-50 text-amber-700" : "hover:bg-slate-50"}`}><span className="w-28 font-semibold">{new Date(`${slot.date}T00:00:00Z`).toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "UTC" })}</span><span className="flex-1">{slot.startTime}–{slot.endTime}</span>{slot.duplicate ? <span className="text-xs font-semibold">Already exists</span> : slot.collision ? <span className="text-xs font-semibold">Overlaps saved slot</span> : null}{writable && !slot.duplicate && !slot.collision && <button type="button" onClick={() => setRemoved((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} className="text-xs font-semibold text-slate-400 hover:text-red-600">{removed.includes(index) ? "Restore" : "Remove"}</button>}</div>)}</div></div>}</section>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <label className="text-sm font-semibold text-slate-700">{label}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }

