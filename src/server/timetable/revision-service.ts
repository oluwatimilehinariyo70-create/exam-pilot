import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AcademicError } from "@/server/academic/errors";
import { getGenerationDetail } from "./review-service";
import { buildAggregateSchedulingDataset } from "./aggregate-dataset-builder";
import { createExamEventFromOfferings } from "@/server/exams/aggregate-services";
import { validateCompleteAggregateTimetable, type AggregateCandidateTimetable, type AggregateSchedulingDataset } from "@/domain/timetable";
import { regenerateAggregateEvents } from "@/domain/timetable/aggregate/regeneration";
import { canTransitionRevision, updatePins, type RevisionStatus } from "@/domain/timetable/revisions";
import { publicTimetableData } from "@/domain/timetable/public-data";
import type { RevisionAction } from "./revision-schemas";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const conflict = (message: string, details: Record<string,unknown> = {}) => new AcademicError("TIMETABLE_NOT_EDITABLE", message, details, 409);

export async function getRevisionWorkspace(generationId: string) {
  const generation = await prisma.timetableGeneration.findUnique({ where: { id: generationId } });
  if (!generation) throw new AcademicError("NOT_FOUND", "Timetable not found.", {}, 404);
  if (generation.generationMode !== "AGGREGATE_EVENT") throw conflict("Revision workflows require an aggregate examination generation.");
  const history = await prisma.timetableRevision.findMany({ where: { generationId }, orderBy: { revisionNumber: "desc" } });
  const current = history[0];
  let candidate: AggregateCandidateTimetable, dataset: AggregateSchedulingDataset;
  if (current) { candidate = current.candidate as unknown as AggregateCandidateTimetable; dataset = current.dataset as unknown as AggregateSchedulingDataset; }
  else { const detail = await getGenerationDetail(generationId); candidate = detail.candidate as AggregateCandidateTimetable; dataset = generation.inputSnapshot as unknown as AggregateSchedulingDataset; }
  if (!dataset?.events) throw conflict("This generation has no usable input snapshot. Generate an aggregate timetable first.");
  return { generationId, version: generation.revision, revisionNumber: current?.revisionNumber ?? 1, revisionId: current?.id ?? null, status: (current?.status ?? generation.reviewStatus) as RevisionStatus, candidate, dataset, pinnedEventIds: current?.pinnedEventIds ?? [], validation: validateCompleteAggregateTimetable(candidate, dataset), publicData: publicTimetableData(candidate,dataset), history: history.map((r) => ({ id:r.id, revisionNumber:r.revisionNumber, status:r.status, reason:r.reason, createdAt:r.createdAt, publishedAt:r.publishedAt })) };
}

export async function applyRevisionAction(input: RevisionAction, actorId: string, role: string) {
  if (!["SUPER_ADMIN","ADMIN","EXAM_OFFICER"].includes(role)) throw new AcademicError("UNAUTHORIZED","A timetable manager is required.",{},403);
  const before = await getRevisionWorkspace(input.generationId);
  if (before.version !== input.expectedVersion) throw conflict("This timetable changed. Reload before editing.");
  let candidate = structuredClone(before.candidate), dataset = before.dataset;
  let pins = [...before.pinnedEventIds];
  let diagnostics: unknown[] = [];
  const transition = ["UNDER_REVIEW","APPROVED","PUBLISHED","SUPERSEDED"].includes(input.action);
  if (transition) {
    if (!canTransitionRevision(before.status,input.action as RevisionStatus,role,before.validation.valid)) throw new AcademicError("WORKFLOW_TRANSITION_INVALID","This transition requires the appropriate role, review status, and a complete valid timetable.",{ violations:before.validation.violations },409);
  } else {
    if (!["DRAFT","UNDER_REVIEW"].includes(before.status) && !["CREATE_REVISION","ADD_LATE_COURSES"].includes(input.action)) throw conflict("Create a new draft revision before editing an approved or historical timetable.");
    if (input.action === "PIN" || input.action === "UNPIN") {
      if (!input.eventId || !dataset.events.some((e) => e.id === input.eventId)) throw conflict("Select an examination in this revision.");
      if (!candidate.assignments.some((a) => a.eventId === input.eventId) && !candidate.sittings?.some((s) => s.eventId === input.eventId)) throw conflict("Only scheduled examinations can be pinned.");
      if (input.placement) {
        const assignment = candidate.assignments.find((a) => a.eventId === input.eventId);
        if (!assignment) throw conflict("CBT pins preserve the complete set of existing batch assignments. Regenerate the event to change its batches.");
        const slot = dataset.timeSlots.find((s) => s.id === input.placement!.timeSlotId);
        if (dataset.schedulingMode !== "FLEXIBLE_INTERVALS" && (!slot || slot.date !== input.placement.date || slot.startTime !== input.placement.startTime || slot.endTime !== input.placement.endTime)) throw conflict("Choose a fixed slot belonging to this examination period.");
        Object.assign(assignment,{ date:input.placement.date,startTime:input.placement.startTime,endTime:input.placement.endTime,timeSlotId:input.placement.timeSlotId });
        assignment.venues = input.placement.venueIds.map((id) => { const venue=dataset.venues.find((v)=>v.id===id); if (!venue) throw conflict("Venue not found."); return { venueId:id,allocatedCapacity:venue.examCapacity ?? venue.capacity }; });
        assignment.invigilators = assignment.invigilators.map((person,index)=>({...person,venueId:assignment.venues[index % assignment.venues.length].venueId}));
      }
      pins = updatePins(pins,input.eventId,input.action === "PIN");
      const validation = validateCompleteAggregateTimetable(candidate,dataset,false);
      if (!validation.valid) throw conflict("The proposed pin conflicts with this timetable.",{ violations:validation.violations });
    }
    if (input.action === "ADD_LATE_COURSES") {
      const missing = await prisma.courseOffering.findMany({ where: { academicSessionId:dataset.session.id,semesterId:dataset.semester.id,active:true,examEvents:{ none:{} } }, select:{ id:true } });
      for (const offering of missing) await createExamEventFromOfferings([offering.id],{ actorId });
      const live = await buildAggregateSchedulingDataset(dataset.session.id,dataset.semester.id,dataset.examPeriod.id,dataset.config,dataset.schedulingMode);
      // Keep historical event definitions and resources; add new logical events and conflict edges.
      dataset = { ...dataset,events:[...dataset.events,...live.events.filter((e)=>!dataset.events.some((old)=>old.id===e.id))],conflictGraph:live.conflictGraph };
    }
    if (["REGENERATE_SELECTED","REGENERATE_UNRESOLVED","ADD_LATE_COURSES"].includes(input.action)) {
      if (input.action === "REGENERATE_SELECTED" && (!input.eventIds?.length || input.eventIds.some((id)=>!dataset.events.some((e)=>e.id===id)))) throw conflict("Select one or more examination events from this revision.");
      const result = regenerateAggregateEvents(dataset,candidate,pins,input.action === "REGENERATE_SELECTED" ? "SELECTED" : input.action === "ADD_LATE_COURSES" ? "LATE_COURSES" : "UNRESOLVED",input.eventIds);
      candidate=result.candidate; diagnostics=result.diagnostics;
    }
  }
  const result = await prisma.$transaction(async (db) => {
    const claim=await db.timetableGeneration.updateMany({where:{id:input.generationId,revision:input.expectedVersion},data:{revision:{increment:1}}});
    if (claim.count !== 1) throw conflict("Another operator changed this timetable. Reload and retry.");
    let revisionId=before.revisionId;
    if (!revisionId) { const baseline=await db.timetableRevision.create({ data:{ generationId:input.generationId,revisionNumber:1,status:before.status,reason:"Initial generated timetable",createdBy:actorId,candidate:json(before.candidate),dataset:json(before.dataset),pinnedEventIds:before.pinnedEventIds } }); revisionId=baseline.id; }
    if (transition) {
      const target=input.action as RevisionStatus;
      const publicationKey=dataset.session.id+"|"+dataset.semester.id+"|"+dataset.examPeriod.id;
      if (target === "PUBLISHED") await db.timetableRevision.updateMany({where:{publicationKey,status:"PUBLISHED"},data:{status:"SUPERSEDED",publicationKey:null}});
      await db.timetableRevision.update({ where:{id:revisionId},data:{status:target,...(target === "APPROVED" ? {approvedAt:new Date(),approvedBy:actorId}:{}),...(target === "PUBLISHED" ? {publishedAt:new Date(),publishedBy:actorId,publicationKey,publicSnapshot:json(publicTimetableData(candidate,dataset))}:{}),...(target === "SUPERSEDED" ? {publicationKey:null}:{})} });
    } else {
      const created=await db.timetableRevision.create({data:{generationId:input.generationId,revisionNumber:before.revisionNumber+1,status:"DRAFT",reason:input.reason,createdBy:actorId,candidate:json(candidate),dataset:json(dataset),pinnedEventIds:pins}}); revisionId=created.id;
    }
    await db.auditLog.create({data:{actorId,action:"TIMETABLE_"+input.action,entity:"TimetableRevision",entityId:revisionId,metadata:json({generationId:input.generationId,reason:input.reason,previousRevision:before.revisionNumber,eventId:input.eventId,eventIds:input.eventIds})}});
    return {revisionId,diagnostics};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
  return {...result,workspace:await getRevisionWorkspace(input.generationId)};
}
