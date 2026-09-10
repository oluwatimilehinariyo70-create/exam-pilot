export type TimeInterval = { date: string; startMinutes: number; endMinutes: number };

export function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : Number.NaN;
}

export function minutesToTime(value: number) {
  if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) return null;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function makeInterval(date: string, startMinutes: number, endMinutes: number): TimeInterval | null {
  if (!date || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) return null;
  return { date, startMinutes, endMinutes };
}

export function intervalDuration(interval: TimeInterval) { return interval.endMinutes - interval.startMinutes; }
export function intervalsOverlap(first: TimeInterval, second: TimeInterval) { return first.date === second.date && first.startMinutes < second.endMinutes && second.startMinutes < first.endMinutes; }
export function intervalContains(container: TimeInterval, inner: TimeInterval) { return container.date === inner.date && container.startMinutes <= inner.startMinutes && container.endMinutes >= inner.endMinutes; }
export function intervalGap(first: TimeInterval, second: TimeInterval) { if (first.date !== second.date) return null; const ordered = first.startMinutes <= second.startMinutes ? [first, second] : [second, first]; return ordered[1].startMinutes - ordered[0].endMinutes; }
export function intervalsAdjacent(first: TimeInterval, second: TimeInterval, requiredGapMinutes = 0) { const gap = intervalGap(first, second); return gap !== null && gap >= requiredGapMinutes; }
export function sortIntervals<T extends TimeInterval>(intervals: T[]) { return intervals.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes); }
