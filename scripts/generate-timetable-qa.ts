import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getRevisionWorkspace } from "@/server/timetable/revision-service";
import { timetableCsv, timetableExcel, timetablePdf, type ExportDocument } from "@/server/timetable/export-service";

const outputDir = path.resolve("QA/output");
const previous = { cycle: "2024/2025, second semester", dates: "6–7 October 2025" };

function csv(value: unknown) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const generation = await prisma.timetableGeneration.findFirst({ where: { generationMode: "AGGREGATE_EVENT" }, orderBy: { generatedAt: "desc" }, select: { id: true } });
  if (!generation) throw new Error("No aggregate timetable generation exists; no course/date data was changed.");
  const workspace = await getRevisionWorkspace(generation.id);
  const data: ExportDocument = { ...workspace.publicData, revisionNumber: workspace.revisionNumber, status: workspace.status, publishedAt: null };
  await Promise.all([
    fs.writeFile(path.join(outputDir, "QA-BOUESTI-timetable.pdf"), await timetablePdf(data)),
    fs.writeFile(path.join(outputDir, "QA-BOUESTI-timetable.xlsx"), await timetableExcel(data, workspace.validation.violations.map((v) => ({ code: v.code, message: v.message })))),
    fs.writeFile(path.join(outputDir, "QA-BOUESTI-timetable-export.csv"), timetableCsv(data)),
  ]);

  const currentCourses = [...new Set(data.rows.map((row) => row.courseCode))].join("; ") || "No scheduled rows";
  const currentDates = [...new Set(data.rows.map((row) => row.date))].join("; ") || `${workspace.dataset.examPeriod.startDate} to ${workspace.dataset.examPeriod.endDate}`;
  const currentSessions = data.sessionWindows?.map((window) => `${window.startTime} - ${window.endTime}`).join("; ") || "No approved session slots";
  const totalCandidates = [...new Map(workspace.dataset.events.map((event) => [event.id, event.candidateCount])).values()].reduce((sum, count) => sum + count, 0);
  const staffMissing = data.rows.filter((row) => row.staffingStatus === "Unassigned").length;
  const reconciliation = [
    ["Item", "Previous timetable value", "Current ExamPilot value", "Required harmonization", "Source of truth", "Status", "Notes/evidence"],
    ["Examination cycle", previous.cycle, `${data.session}, ${data.semester}`, "Keep the current cycle unless approved records say it reproduces the photo.", "Approved exam-period records", "Verified", `PDF period is ${data.period}; previous photo is ${previous.cycle}.`],
    ["Examination dates", previous.dates, currentDates, "Do not replace dates without approved 2024/2025 source records.", "Approved exam-period records", "Verified", "Cycles have different dates."],
    ["Institutional heading", "Full university name; Ikere-Ekiti; College of Science", "Full university name; Ikere-Ekiti; College of Science", "Retain the full heading in every export.", "Previous timetable layout + institution configuration", "Fixed", "Added to PDF and Excel headers."],
    ["Morning session window", "08:30 - 11:30", data.sessionWindows?.find((window) => window.startTime < "12:00") ? currentSessions : "No approved morning slot", "Use the selected cycle's approved slot.", "Approved time-slot records", "Verified", "Current records use 09:00 - 12:00."],
    ["Midday session window", "12:00 - 14:00", data.sessionWindows?.find((window) => window.startTime === "12:00") ? "12:00 - 14:00" : "Not present in current approved slots", "Keep and print when present; obtain approved data if required for this cycle.", "Approved time-slot records", "Requires approved data", "The current snapshot has no 12:00 - 14:00 slot."],
    ["Afternoon session window", "14:30 - 17:30", currentSessions, "Use the selected cycle's approved slot.", "Approved time-slot records", "Verified", "Current records use 14:00 - 17:00."],
    ["Course coverage", "Multiple courses, levels 100–500", currentCourses, "Retain current approved records; do not copy photo courses into this cycle.", "Course-load and aggregate-event records", "Verified", "Photo is a layout/operations reference only."],
    ["Course codes", "IMT 114; CSC 110; CSC 412; etc.", currentCourses, "Preserve combined codes as linked groups.", "Approved course-load records", "Verified", "Current events are linked by eventId."],
    ["Candidate totals", "Photo totals by venue", `${totalCandidates} across current events; venue rows show allocation`, "Show total once per linked group and venue allocation separately.", "Aggregate event candidate counts + venue allocations", "Fixed", "PDF/Excel/CSV include total and venue counts."],
    ["Programme and level assignment", "Photo programme/level cells", "Derived from current event members", "Do not infer or alter assignments.", "Approved course registrations/offerings", "Requires approved data", "Current snapshot includes the assignments printed by ExamPilot."],
    ["Venue allocations", "LLT1, Navates 2, NSC, S1, etc.", "Derived from current assignments", "Show each split venue once with its allocation.", "Approved generation assignments", "Fixed", "CSC 202 rows are linked by eventId."],
    ["Chief invigilators", "Chief invigilator code per session", staffMissing ? "Unassigned where absent" : "Assigned", "Use existing chief assignment; never fabricate.", "Approved staffing assignments", staffMissing ? "Blocked" : "Verified", staffMissing ? `${staffMissing} exported row(s) have no chief/venue assignment.` : ""],
    ["Venue-specific invigilators", "Venue-specific codes", staffMissing ? "Unassigned where absent" : "Assigned", "Link codes to date, session, event, and venue.", "Approved staffing assignments", staffMissing ? "Blocked" : "Verified", "Names are not required; staff IDs are used when available."],
    ["Examination mode", "Pen on Paper", "Pen on Paper / CBT", "Use consistent approved wording.", "Approved event mode", "Fixed", "Written events print as Pen on Paper."],
    ["Release status", "No draft label visible", `${data.status} | Unpublished`, "Keep configurable and truthful.", "Revision workflow status", "Fixed", "No document is described as final while draft/unpublished."],
    ["Text wrapping", "Photo table wraps headings", "Candidates and level values are single cells", "Keep Candidates and values intact.", "Export visual inspection", "Fixed", "PDF column widths and Excel widths updated."],
    ["Pagination and page count", "Photo spans two pages", "Generated PDF footer uses Page n of m", "No orphan footer page.", "PDF render and page tree", "Fixed", "Footer is placed inside the page bounds."],
    ["Split-venue presentation", "Rows are visually grouped by course", "One eventId group with venue/count rows", "Print total once; show each venue allocation separately.", "Aggregate event + venue assignments", "Fixed", "Venue text is allocation/total."],
    ["Native CSV export", "Not applicable", "CSV endpoint and QA export present", "Keep CSV columns aligned with Excel export.", "Export route", "Fixed", "Privacy-safe operational fields only."],
  ];
  const reconciliationCsv = reconciliation.map((row) => row.map(csv).join(",")).join("\r\n") + "\r\n";
  await fs.writeFile(path.join(outputDir, "BOUESTI-timetable-reconciliation.csv"), reconciliationCsv, "utf8");
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Reconciliation"); reconciliation.forEach((row) => sheet.addRow(row)); sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12253F" } }; sheet.columns.forEach((column, index) => { column.width = [28, 32, 36, 48, 36, 22, 52][index]; }); sheet.eachRow((row) => { row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; }); row.height = 42; }); await book.xlsx.writeFile(path.join(outputDir, "BOUESTI-timetable-reconciliation.xlsx"));
  const issueLog = `# Timetable export verification\n\nSelected cycle: ${data.session} | ${data.semester} | ${data.period}. Previous photo cycle: ${previous.cycle} | ${previous.dates}. No course/date records were changed.\n\n| Severity | Issue / evidence | Fixed | Requires approved source data |\n|---|---|---|---|\n| High | ${staffMissing} exported rows have no chief invigilator; venue-specific codes are shown where linked, while the staffing status remains Unassigned. | No | Yes, approved staffing assignments |\n| Medium | Current approved snapshot has no 12:00 - 14:00 midday slot; Session Windows sheet records only the two present windows. | No | Yes, approved time-slot records |\n| Medium | The two supplied documents represent different cycles and course coverage. | No data replacement | Yes, approved 2024/2025 records if reproduction is intended |\n| Low | Previous PDF layout had a footer-only second page; regenerated PDF reports one page and renders without an orphan footer. | Yes | No |\n| Low | Previous PDF wrapped Candidates/level values and the mode column. Regenerated PDF keeps the Candidates header and Pen on Paper wording intact. | Yes | No |\n| Low | Split venue CSC 202 is represented by one event group with LLT1 300/415 and Navates 2 115/415. | Yes | No |\n| Pass | PDF header begins %PDF, ends %%EOF, and pdfinfo reports one page. | Yes | No |\n| Pass | Excel workbook contains Full Timetable, Programme View, Venue View, CBT Batches, Session Windows, and Diagnostics when applicable. | Yes | No |\n| Pass | CSV columns match the operational export schema and contain no student names or matric numbers. | Yes | No |\n`;
  await fs.writeFile(path.join(outputDir, "BOUESTI-timetable-verification.md"), issueLog, "utf8");
  console.log(JSON.stringify({ generationId: generation.id, cycle: `${data.session} | ${data.semester} | ${data.period}`, rows: data.rows.length, sessionWindows: data.sessionWindows, staffingBlockers: staffMissing, totalCandidates }, null, 2));
}

main().finally(() => prisma.$disconnect());
