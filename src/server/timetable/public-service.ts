import { prisma } from "@/lib/prisma";
import type { PublicTimetable } from "@/domain/timetable/public-data";

export async function getPublishedTimetable(revisionId?:string) {
  const revision=await prisma.timetableRevision.findFirst({where:{status:"PUBLISHED",publicationKey:{not:null},...(revisionId?{id:revisionId}:{})},orderBy:[{publishedAt:"desc"},{id:"desc"}],select:{id:true,revisionNumber:true,publishedAt:true,publicSnapshot:true,status:true}});
  if(!revision?.publicSnapshot)return null;
  return { ...(revision.publicSnapshot as unknown as PublicTimetable),revisionId:revision.id,revisionNumber:revision.revisionNumber,publishedAt:revision.publishedAt?.toISOString()??null,status:revision.status };
}
