import type { AggregateCandidateTimetable, AggregateSchedulingDataset } from "./aggregate/types";

export type PublicTimetableRow = {
  eventId: string; date: string; startTime: string; endTime: string;
  courseCode: string; courseTitle: string; programmes: { id: string; name: string; level: number }[];
  mode: string; venueId: string; venue: string; candidateCount: number; batch: number | null;
};
export type PublicTimetable = { session: string; semester: string; period: string; rows: PublicTimetableRow[] };
export type TimetableFilters = { programme?: string; level?: string; course?: string; date?: string; venue?: string; mode?: string };

/** Explicit allowlist: this object is safe for unauthenticated users and exports. */
export function publicTimetableData(candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset): PublicTimetable {
  const rows: PublicTimetableRow[] = [];
  const add = (eventId: string, date: string, startTime: string, endTime: string, venueId: string, count: number, batch: number | null) => {
    const event = dataset.events.find((e) => e.id === eventId);
    if (!event) return;
    const programmes = event.members?.map((m) => ({ id: m.programmeId, name: m.programmeName, level: m.level })) ?? event.cohortKeys.map((key) => { const pos = key.lastIndexOf(":"); return { id: key.slice(0,pos), name: key.slice(0,pos), level: Number(key.slice(pos+1)) }; });
    rows.push({ eventId, date, startTime, endTime, courseCode: event.memberCourseCodes.join(" / "), courseTitle: event.title, programmes: [...new Map(programmes.map((p) => [p.id+":"+p.level,p])).values()], mode: event.examMode, venueId, venue: dataset.venues.find((v) => v.id === venueId)?.name ?? venueId, candidateCount: count, batch });
  };
  for (const a of candidate.assignments) {
    const slot = dataset.timeSlots.find((s) => s.id === a.timeSlotId);
    let remaining = dataset.events.find((e) => e.id === a.eventId)?.candidateCount ?? 0;
    for (const v of a.venues) { const count = Math.min(remaining, v.allocatedCandidates ?? v.allocatedCapacity); remaining -= count; add(a.eventId,slot?.date ?? a.date,slot?.startTime ?? a.startTime,slot?.endTime ?? a.endTime,v.venueId,count,null); }
  }
  for (const s of candidate.sittings ?? []) for (const v of s.venues) add(s.eventId,s.date,s.startTime,s.endTime,v.venueId,v.allocatedCandidates,s.sequenceNumber);
  rows.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.courseCode.localeCompare(b.courseCode) || a.venue.localeCompare(b.venue));
  return { session: dataset.session.name, semester: dataset.semester.name, period: dataset.examPeriod.name, rows };
}

export function filterTimetableRows(rows: PublicTimetableRow[], filters: TimetableFilters) {
  return rows.filter((r) => (!filters.programme && !filters.level || r.programmes.some((p) => (!filters.programme || p.id === filters.programme) && (!filters.level || String(p.level) === filters.level))) && (!filters.course || r.courseCode.toLowerCase().includes(filters.course.toLowerCase())) && (!filters.date || r.date === filters.date) && (!filters.venue || r.venueId === filters.venue) && (!filters.mode || r.mode === filters.mode));
}
