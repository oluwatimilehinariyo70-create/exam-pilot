"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { getRevisionWorkspace } from "@/server/timetable/revision-service";
import type { RevisionAction } from "@/server/timetable/revision-schemas";

type Workspace = Awaited<ReturnType<typeof getRevisionWorkspace>>;
type Placement = NonNullable<RevisionAction["placement"]>;
const field="rounded border border-slate-300 bg-white px-3 py-2 text-sm";

export function RevisionWorkspace({ generationId, role }: { generationId:string; role:string }) {
  const [data,setData]=useState<Workspace|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[reason,setReason]=useState(""),[selected,setSelected]=useState<string[]>([]);
  const [editing,setEditing]=useState<{eventId:string;placement:Placement}|null>(null);
  const load=useCallback(async()=>{ try { const response=await fetch(`/api/timetable/revisions?generationId=${encodeURIComponent(generationId)}`,{cache:"no-store"}); const body=await response.json(); if(!response.ok) throw new Error(body.error?.message ?? "Unable to load revisions."); setData(body.data); } catch(e) {setError(e instanceof Error?e.message:"Unable to load revisions.");} },[generationId]);
  useEffect(()=>{void load();},[load]);
  async function act(action:RevisionAction["action"], extra:Partial<RevisionAction>={}) {
    if(!data) return; if(!reason.trim()) {setError("Enter a reason for this action.");return;}
    setBusy(true);setError("");
    try {const response=await fetch("/api/timetable/revisions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({generationId,expectedVersion:data.version,action,reason,...extra})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message ?? "Action failed.");setData(body.data.workspace);setEditing(null);setSelected([]);setReason("");}catch(e){setError(e instanceof Error?e.message:"Action failed.");}finally{setBusy(false);}
  }
  if(!data) return <div role="status" className="rounded-xl border bg-white p-8">{error || "Loading timetable revisions…"}</div>;
  const manager=["SUPER_ADMIN","ADMIN","EXAM_OFFICER"].includes(role),approver=["SUPER_ADMIN","ADMIN"].includes(role),editable=["DRAFT","UNDER_REVIEW"].includes(data.status);
  const patch=(change:Partial<Placement>)=>setEditing((current)=>current?{...current,placement:{...current.placement,...change}}:null);
  return <div className="space-y-6">
    <Link href="/timetable/history" className="text-sm font-semibold text-teal">← Generation history</Link>
    <header><h1 className="text-3xl font-bold text-navy">{data.publicData.period}</h1><p className="mt-2 text-slate-600">{data.publicData.session} · {data.publicData.semester} · Revision {data.revisionNumber} · {data.status}</p><p className="mt-1 text-sm text-slate-500">{data.dataset.schedulingMode === "FLEXIBLE_INTERVALS" ? "Flexible intervals" : "Fixed sessions"} · {data.dataset.events.length} examinations · {data.pinnedEventIds.length} pinned</p></header>
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error}</p>}
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <p className={data.validation.valid?"text-emerald-700":"text-amber-800"}>{data.validation.valid?"All examinations are assigned and validation passes.":`${data.validation.violations.length} diagnostics need attention before approval.`}</p>
      {manager && <><label className="block text-sm font-semibold">Reason / change summary<input value={reason} maxLength={500} onChange={(e)=>setReason(e.target.value)} placeholder="Describe this change or review decision" className={`${field} mt-2 w-full`} /></label><div className="flex flex-wrap gap-2">
        {editable && <><Button disabled={busy||!selected.length} onClick={()=>void act("REGENERATE_SELECTED",{eventIds:selected})}>Regenerate selected</Button><Button variant="outline" disabled={busy} onClick={()=>void act("REGENERATE_UNRESOLVED")}>Regenerate unresolved</Button></>}
        <Button variant="outline" disabled={busy} onClick={()=>void act("ADD_LATE_COURSES")}>Place late-added courses</Button>
        {!editable && <Button disabled={busy} onClick={()=>void act("CREATE_REVISION")}>Create draft revision</Button>}
        {data.status==="DRAFT" && <Button disabled={busy} onClick={()=>void act("UNDER_REVIEW")}>Submit for review</Button>}
        {data.status==="UNDER_REVIEW" && approver && <Button disabled={busy||!data.validation.valid} onClick={()=>void act("APPROVED")}>Approve</Button>}
        {data.status==="APPROVED" && approver && <Button disabled={busy||!data.validation.valid} onClick={()=>void act("PUBLISHED")}>Publish</Button>}
        {data.status==="PUBLISHED" && approver && <Button variant="outline" disabled={busy} onClick={()=>void act("SUPERSEDED")}>Unpublish / supersede</Button>}
      </div></>}
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal"><Link href={`/api/timetable/export?generationId=${encodeURIComponent(generationId)}&format=pdf`}>Download PDF</Link><Link href={`/api/timetable/export?generationId=${encodeURIComponent(generationId)}&format=xlsx`}>Download Excel</Link><Link href="/public/timetable">Public timetable</Link></div>
    </section>
    {editing && <section className="space-y-3 rounded-xl border border-teal bg-white p-5"><h2 className="font-bold">Pin date, time, and venues</h2>
      {data.dataset.schedulingMode!=="FLEXIBLE_INTERVALS" ? <label className="block">Fixed session<select className={`${field} ml-3`} value={editing.placement.timeSlotId??""} onChange={(e)=>{const slot=data.dataset.timeSlots.find((s)=>s.id===e.target.value);if(slot)patch({timeSlotId:slot.id,date:slot.date,startTime:slot.startTime,endTime:slot.endTime});}}>{data.dataset.timeSlots.map((s)=><option key={s.id} value={s.id}>{s.date} {s.startTime}–{s.endTime}</option>)}</select></label> : <div className="flex flex-wrap gap-3"><label>Date<input type="date" aria-label="Pinned date" className={field} value={editing.placement.date} onChange={(e)=>patch({date:e.target.value})}/></label><label>Start<input type="time" aria-label="Pinned start" className={field} value={editing.placement.startTime} onChange={(e)=>patch({startTime:e.target.value})}/></label><label>End<input type="time" aria-label="Pinned end" className={field} value={editing.placement.endTime} onChange={(e)=>patch({endTime:e.target.value})}/></label></div>}
      <fieldset><legend className="font-semibold">Venues</legend><div className="flex flex-wrap gap-4">{data.dataset.venues.filter((v)=>v.capability!=="CBT").map((v)=><label key={v.id} className="flex gap-2"><input type="checkbox" checked={editing.placement.venueIds.includes(v.id)} onChange={(e)=>patch({venueIds:e.target.checked?[...editing.placement.venueIds,v.id]:editing.placement.venueIds.filter((id)=>id!==v.id)})}/>{v.name}</label>)}</div></fieldset>
      <div className="flex gap-2"><Button disabled={busy} onClick={()=>void act("PIN",editing)}>Validate and pin</Button><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button></div>
    </section>}
    <section className="space-y-4">{data.dataset.events.map((event)=>{const rows=data.publicData.rows.filter((r)=>r.eventId===event.id),pinned=data.pinnedEventIds.includes(event.id),assignment=data.candidate.assignments.find((a)=>a.eventId===event.id);return <article key={event.id} className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4"><div className="flex items-center gap-3">{manager&&editable&&<input type="checkbox" aria-label={`Select ${event.title}`} checked={selected.includes(event.id)} disabled={pinned} onChange={(e)=>setSelected(e.target.checked?[...selected,event.id]:selected.filter((id)=>id!==event.id))}/>}<div><h2 className="font-bold text-navy">{event.memberCourseCodes.join(" / ")} · {event.title}</h2><p className="text-sm text-slate-600">{event.examMode} · {event.candidateCount} candidates {pinned?"· Pinned":""}</p></div></div>{manager&&editable&&rows.length>0&&<Button variant="outline" disabled={busy} onClick={()=>pinned?void act("UNPIN",{eventId:event.id}):assignment?setEditing({eventId:event.id,placement:{date:assignment.date,startTime:assignment.startTime,endTime:assignment.endTime,timeSlotId:assignment.timeSlotId,venueIds:assignment.venues.map((v)=>v.venueId)}}):void act("PIN",{eventId:event.id})}>{pinned?"Unpin":"Pin"}</Button>}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Date","Time","Batch","Venue","Candidates"].map((label)=><th key={label} className="px-4 py-2">{label}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t"><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3">{r.startTime}–{r.endTime}</td><td className="px-4 py-3">{r.batch??"—"}</td><td className="px-4 py-3">{r.venue}</td><td className="px-4 py-3">{r.candidateCount}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-4 text-amber-800">Unscheduled. Regenerate unresolved examinations to attempt placement.</p>}</div></article>;})}</section>
    {!data.validation.valid&&<section className="rounded-xl border bg-amber-50 p-5"><h2 className="font-bold">Diagnostics</h2><ul className="mt-3 list-disc space-y-2 pl-5">{data.validation.violations.map((v,i)=><li key={i}>{v.code}: {v.message} {String(v.metadata.eventId??v.metadata.eventAId??"")}</li>)}</ul></section>}
    <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Revision history</h2><div className="mt-3 space-y-2">{data.history.length?data.history.map((r)=><div key={r.id} className="flex flex-wrap justify-between gap-2 border-t pt-2"><span>Revision {r.revisionNumber} · {r.status} · {r.reason}</span><Link className="text-sm text-teal" href={`/api/timetable/export?generationId=${encodeURIComponent(generationId)}&revisionId=${r.id}&format=pdf`}>Historical PDF</Link></div>):<p>Revision 1 · Initial generated timetable</p>}</div></section>
  </div>;
}
