import { requireUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { publicTimetableData,filterTimetableRows } from "@/domain/timetable/public-data";
import type { AggregateCandidateTimetable,AggregateSchedulingDataset } from "@/domain/timetable";
import { getRevisionWorkspace } from "@/server/timetable/revision-service";
import { getPublishedTimetable } from "@/server/timetable/public-service";
import { timetableExcel,timetablePdf,type ExportDocument } from "@/server/timetable/export-service";
import { jsonError,jsonValidationError } from "@/server/academic/http";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
    const params=new URL(request.url).searchParams,format=params.get("format")??"pdf",generationId=params.get("generationId"),revisionId=params.get("revisionId")??undefined;
    if(!["pdf","xlsx"].includes(format))return jsonValidationError("Choose PDF or XLSX.");
    let data:ExportDocument|null=null;let diagnostics:{code:string;message:string}[]|undefined;
    if(generationId){await requireUser();if(revisionId){const revision=await prisma.timetableRevision.findFirst({where:{id:revisionId,generationId}});if(revision)data={...publicTimetableData(revision.candidate as unknown as AggregateCandidateTimetable,revision.dataset as unknown as AggregateSchedulingDataset),revisionNumber:revision.revisionNumber,status:revision.status,publishedAt:revision.publishedAt?.toISOString()??null};}else{const workspace=await getRevisionWorkspace(generationId);data={...workspace.publicData,revisionNumber:workspace.revisionNumber,status:workspace.status,publishedAt:null};if(params.get("diagnostics")==="true")diagnostics=workspace.validation.violations;}}
    else data=await getPublishedTimetable(revisionId);
    if(!data)return new Response("Timetable not found",{status:404});
    data.rows=filterTimetableRows(data.rows,Object.fromEntries(["programme","level","course","date","venue","mode"].map((key)=>[key,params.get(key)??undefined])));
    if(data.rows.length>20000)return jsonValidationError("Narrow your filters to export at most 20,000 rows.");
    const buffer=format==="pdf"?await timetablePdf(data):await timetableExcel(data,diagnostics);
    return new Response(new Uint8Array(buffer),{headers:{"Content-Type":format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="bouesti-timetable-r${data.revisionNumber}.${format}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return jsonError(error);}
}
