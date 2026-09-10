import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import type { PublicTimetable, PublicTimetableRow } from "@/domain/timetable/public-data";

export type ExportDocument = PublicTimetable & { revisionNumber:number; status:string; publishedAt:string|null };
const headers=["Date","Time","Course Code","Course Title","Programme / Level","Mode","Venue","Candidates","Batch"];
export function exportValues(row:PublicTimetableRow) { return [row.date,`${row.startTime} - ${row.endTime}`,row.courseCode,row.courseTitle,row.programmes.map((p)=>`${p.name} / ${p.level}`).join("; "),row.mode==="CBT"?"CBT":"Written",row.venue,row.candidateCount,row.batch??""]; }

export async function timetablePdf(data:ExportDocument):Promise<Buffer> {
  const doc=new PDFDocument({size:"A4",layout:"landscape",margin:30,bufferPages:true,info:{Title:"BOUESTI Examination Timetable",Author:"BOUESTI"}});
  const chunks:Buffer[]=[];
  const result=new Promise<Buffer>((resolve,reject)=>{doc.on("data",(chunk:Buffer)=>chunks.push(chunk));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  const widths=[62,70,75,115,115,48,100,50,35];
  let y=0;
  const header=()=>{doc.fillColor("#12253f").font("Helvetica-Bold").fontSize(16).text("BOUESTI EXAMINATION TIMETABLE",30,25,{width:770});doc.font("Helvetica").fontSize(9).text(`${data.session} | ${data.semester} | ${data.period}`,30,48,{width:770});doc.text(`Revision ${data.revisionNumber} | ${data.status} | ${data.publishedAt?"Published "+data.publishedAt.slice(0,10):"Unpublished"}`,30,64,{width:770}); y=88; let x=30;doc.font("Helvetica-Bold").fontSize(8);headers.forEach((h,i)=>{doc.rect(x,y,widths[i],30).fill("#e8edf2");doc.fillColor("#12253f").text(h,x+4,y+5,{width:widths[i]-8,height:24});x+=widths[i];});y+=30;doc.font("Helvetica").fontSize(8);};
  const wrap=(value:string,width:number)=>{const lines:string[]=[];let line="";for(const char of value.replace(/[\r\n]+/g," ")){if(doc.widthOfString(line+char)>width){lines.push(line);line=char;}else line+=char;}lines.push(line);return lines;};
  header();
  for(const row of data.rows){const lines=exportValues(row).map((value,i)=>wrap(String(value),widths[i]-8));let offset=0;const count=Math.max(...lines.map((l)=>l.length));while(offset<count){if(y+22>doc.page.height-40){doc.addPage();header();}const fit=Math.max(1,Math.floor((doc.page.height-40-y-10)/11));const take=Math.min(count-offset,fit);const height=take*11+10;let x=30;lines.forEach((cell,i)=>{doc.rect(x,y,widths[i],height).lineWidth(0.3).strokeColor("#cbd5e1").stroke();doc.fillColor("#12253f").text(cell.slice(offset,offset+take).join("\n"),x+4,y+5,{width:widths[i]-8,lineGap:1,height:height-5});x+=widths[i];});y+=height;offset+=take;}}
  if(!data.rows.length)doc.text("No examinations match these filters.",30,y+15);
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fontSize(8).text(`Page ${i+1} of ${pages.count}`,30,doc.page.height-27,{width:770,align:"right",lineBreak:false});}
  doc.end();return result;
}

export async function timetableExcel(data:ExportDocument,diagnostics?:{code:string;message:string}[]):Promise<Buffer> {
  const workbook=new ExcelJS.Workbook();workbook.creator="BOUESTI";workbook.subject=`${data.period} - Revision ${data.revisionNumber}`;
  const add=(name:string,rows:PublicTimetableRow[])=>{const sheet=workbook.addWorksheet(name,{views:[{state:"frozen",ySplit:3}],pageSetup:{orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9}});sheet.mergeCells("A1:I1");sheet.getCell("A1").value=`BOUESTI | ${data.session} | ${data.period}`;sheet.getCell("A1").font={bold:true,size:14};sheet.mergeCells("A2:I2");sheet.getCell("A2").value=`Revision ${data.revisionNumber} | ${data.status} | ${data.publishedAt??"Unpublished"}`;sheet.addRow(headers);sheet.getRow(3).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF12253F"}};rows.forEach((r)=>sheet.addRow(exportValues(r)));sheet.columns.forEach((c,i)=>{c.width=[14,20,22,40,40,12,30,14,10][i];});sheet.autoFilter={from:{row:3,column:1},to:{row:Math.max(3,sheet.rowCount),column:9}};sheet.pageSetup.printTitlesRow="1:3";sheet.eachRow((row,index)=>{if(index>=3){row.eachCell((cell)=>{cell.alignment={vertical:"top",wrapText:true};cell.border={top:{style:"thin",color:{argb:"FFCBD5E1"}},bottom:{style:"thin",color:{argb:"FFCBD5E1"}}};});row.height=index===3?30:Math.max(30,...row.values instanceof Array ? row.values.map((v)=>Math.ceil(String(v??"").length/35)*15):[30]);}});return sheet;};
  add("Full Timetable",data.rows);
  add("Programme View",[...data.rows].sort((a,b)=>(a.programmes[0]?.name??"").localeCompare(b.programmes[0]?.name??"")||a.date.localeCompare(b.date)));
  add("Venue View",[...data.rows].sort((a,b)=>a.venue.localeCompare(b.venue)||a.date.localeCompare(b.date)));
  add("CBT Batches",data.rows.filter((r)=>r.mode==="CBT"));
  if(diagnostics){const sheet=workbook.addWorksheet("Diagnostics",{views:[{state:"frozen",ySplit:1}]});sheet.addRow(["Code","Message"]);sheet.getRow(1).font={bold:true};diagnostics.forEach((d)=>sheet.addRow([d.code,d.message]));sheet.getColumn(1).width=40;sheet.getColumn(2).width=100;sheet.getColumn(2).alignment={wrapText:true};}
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
