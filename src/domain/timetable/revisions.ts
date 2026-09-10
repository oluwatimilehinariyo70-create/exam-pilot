export type RevisionStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PUBLISHED" | "SUPERSEDED";
export function canTransitionRevision(from: RevisionStatus, to: RevisionStatus, role: string, valid: boolean) {
  const manager = ["SUPER_ADMIN", "ADMIN", "EXAM_OFFICER"].includes(role);
  const approver = ["SUPER_ADMIN", "ADMIN"].includes(role);
  if (from === "DRAFT" && to === "UNDER_REVIEW") return manager;
  if (from === "UNDER_REVIEW" && to === "APPROVED") return approver && valid;
  if (from === "APPROVED" && to === "PUBLISHED") return approver && valid;
  if (from === "PUBLISHED" && to === "SUPERSEDED") return approver;
  return false;
}
export function updatePins(pins: string[], eventId: string, pin: boolean) { return pin ? [...new Set([...pins,eventId])].sort() : pins.filter((id) => id !== eventId); }
