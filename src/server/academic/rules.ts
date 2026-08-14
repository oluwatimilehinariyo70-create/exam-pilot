export type SlotLike = { date: Date; startTime: string; endTime: string };

export function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function slotsOverlap(first: SlotLike, second: SlotLike) {
  if (first.date.toISOString().slice(0, 10) !== second.date.toISOString().slice(0, 10)) return false;
  return toMinutes(first.startTime) < toMinutes(second.endTime) && toMinutes(second.startTime) < toMinutes(first.endTime);
}

export function hasOverlappingSlots(slots: SlotLike[]) {
  for (let index = 0; index < slots.length; index += 1) {
    for (let other = index + 1; other < slots.length; other += 1) {
      if (slotsOverlap(slots[index], slots[other])) return true;
    }
  }
  return false;
}
