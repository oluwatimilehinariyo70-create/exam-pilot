import { describe, expect, it } from "vitest";
import { exportValues } from "@/server/timetable/export-service";
import { filterTimetableRows, publicTimetableData } from "@/domain/timetable/public-data";
import type { AggregateSchedulingDataset, AggregateCandidateTimetable } from "@/domain/timetable";

const dataset = { session:{id:"s",name:"2025/2026",active:true}, semester:{id:"m",sessionId:"s",name:"First",active:true}, examPeriod:{id:"p",sessionId:"s",semesterId:"m",name:"Main",startDate:"2026-01-01",endDate:"2026-01-31",active:true}, events:[{id:"e",title:"GST 101",memberCourseCodes:["GST101"],candidateCount:100,cohortKeys:["prog:100"],examMode:"CBT",durationMinutes:60,source:"AUTO_AGGREGATED",offeringIds:["o"],members:[{programmeId:"prog",programmeName:"BSc",level:100,courseCode:"GST101",courseTitle:"GST 101"}]}],timeSlots:[],calendarDays:[],conflictGraph:{events:[],edges:[],metrics:{events:1,edges:0,density:0,hardEdges:0,softEdges:0}} as any,venues:[{id:"v",code:"ICT",name:"ICT Centre",capacity:120,usableComputerCapacity:120,capability:"CBT",active:true}],venueUnavailability:[],invigilators:[],invigilatorUnavailability:[],config:{} as any,schedulingMode:"FLEXIBLE_INTERVALS" as const } as AggregateSchedulingDataset;
const candidate = { assignments:[], sittings:[{eventId:"e",sequenceNumber:1,batchLabel:"A",candidateCount:100,date:"2026-01-05",startTime:"08:00",endTime:"09:00",venues:[{venueId:"v",allocatedCandidates:100,allocatedCapacity:120}],staff:[]}],unscheduledEvents:[],hardViolations:[],softScore:0,metrics:{} as any } as AggregateCandidateTimetable;

describe("public timetable and exports",()=>{
  it("whitelists timetable rows and preserves CBT batch fields",()=>{const data=publicTimetableData(candidate,dataset);expect(data.rows).toHaveLength(1);expect(data.rows[0]).toMatchObject({courseCode:"GST101",mode:"CBT",candidateCount:100,batch:1});expect(JSON.stringify(data)).not.toContain("student");expect(exportValues(data.rows[0])).toContain(1);});
  it("filters by programme, date, venue, and mode",()=>{const row=publicTimetableData(candidate,dataset).rows;expect(filterTimetableRows(row,{programme:"prog",level:"100",date:"2026-01-05",venue:"v",mode:"CBT"})).toHaveLength(1);expect(filterTimetableRows(row,{mode:"PEN_ON_PAPER"})).toHaveLength(0);});
});
