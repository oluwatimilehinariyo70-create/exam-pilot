import { jsonError, jsonSuccess, jsonValidationError } from "@/server/academic/http";
import { requireExaminationManager, requireAcademicRead } from "@/server/academic/access";
import { bulkTimeSlotInput, listQuery, timeSlotInput } from "@/server/academic/schemas";
import { createTimeSlot, createTimeSlots, listTimeSlots } from "@/server/academic/services";

export async function GET(request: Request) { try { await requireAcademicRead(); const search = new URL(request.url).searchParams; const query = listQuery.parse(Object.fromEntries(search)); return jsonSuccess(await listTimeSlots({ periodId: query.periodId, q: query.q })); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { const session = await requireExaminationManager(); const body = await request.json(); if (Array.isArray(body)) { const parsed = timeSlotInput.array().min(1).safeParse(body); if (!parsed.success) return jsonValidationError("Check the time slot details.", parsed.error.flatten()); return jsonSuccess(await createTimeSlots(parsed.data, session.user.id), 201); } const parsed = timeSlotInput.safeParse(body); if (!parsed.success) return jsonValidationError("Check the time slot details.", parsed.error.flatten()); return jsonSuccess(await createTimeSlot(parsed.data, session.user.id), 201); } catch (error) { return jsonError(error); } }
