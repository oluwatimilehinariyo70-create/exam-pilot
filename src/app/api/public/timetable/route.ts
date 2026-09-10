import { getPublishedTimetable } from "@/server/timetable/public-service";
import { filterTimetableRows } from "@/domain/timetable/public-data";
export const dynamic="force-dynamic";
export async function GET(request:Request){const params=new URL(request.url).searchParams;const data=await getPublishedTimetable(params.get("revisionId")??undefined);return Response.json({data:data?{...data,rows:filterTimetableRows(data.rows,Object.fromEntries(["programme","level","course","date","venue","mode"].map((key)=>[key,params.get(key)??undefined])))}:null},{headers:{"Cache-Control":"no-store"}});}
