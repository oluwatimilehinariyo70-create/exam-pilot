import { existsSync, readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);
  else {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

if (process.env.DEMO_DATA_CONFIRM !== "YES") {
  throw new Error("Refusing to seed demo data. Set DEMO_DATA_CONFIRM=YES explicitly.");
}

const prisma = new PrismaClient();
const DEMO_LABEL = "BOUESTI College of Science demonstration dataset";
const SESSION_NAME = "2026/2027";
const SECOND_SEMESTER = "Second Semester";
const EXAM_PERIOD_NAME = "2026/2027 Second Semester Examination";

type Tx = Prisma.TransactionClient;
type DepartmentSpec = { code: string; name: string; programmeCode: string; programmeName: string };
type CourseSpec = { departmentCode: string; code: string; title: string; level: number; candidateCount: number; durationMinutes: number };

const departmentSpecs: DepartmentSpec[] = [
  { code: "CSC", name: "Computer Science", programmeCode: "BSC-CS", programmeName: "B.Sc. Computer Science" },
  { code: "MTH", name: "Mathematics", programmeCode: "BSC-MTH", programmeName: "B.Sc. Mathematics" },
  { code: "STA", name: "Statistics", programmeCode: "BSC-STA", programmeName: "B.Sc. Statistics" },
  { code: "PHY", name: "Physics", programmeCode: "BSC-PHY", programmeName: "B.Sc. Physics" },
  { code: "CHM", name: "Chemistry", programmeCode: "BSC-CHM", programmeName: "B.Sc. Chemistry" },
  { code: "BIO", name: "Biology", programmeCode: "BSC-BIO", programmeName: "B.Sc. Biology" },
  { code: "MCB", name: "Microbiology", programmeCode: "BSC-MCB", programmeName: "B.Sc. Microbiology" },
  { code: "BCH", name: "Biochemistry", programmeCode: "BSC-BCH", programmeName: "B.Sc. Biochemistry" },
  { code: "EBI", name: "Environmental Biology", programmeCode: "BSC-EBI", programmeName: "B.Sc. Environmental Biology" },
  { code: "GLY", name: "Geology", programmeCode: "BSC-GLY", programmeName: "B.Sc. Geology" },
];

const courseSpecs: CourseSpec[] = [
  { departmentCode: "CSC", code: "CSC212", title: "Data Structures", level: 200, candidateCount: 72, durationMinutes: 120 },
  { departmentCode: "CSC", code: "CSC302", title: "Operating Systems", level: 300, candidateCount: 68, durationMinutes: 120 },
  { departmentCode: "CSC", code: "CSC304", title: "Database Systems", level: 300, candidateCount: 68, durationMinutes: 120 },
  { departmentCode: "CSC", code: "CSC412", title: "Software Engineering", level: 400, candidateCount: 55, durationMinutes: 180 },
  { departmentCode: "MTH", code: "MTH202", title: "Differential Equations", level: 200, candidateCount: 58, durationMinutes: 120 },
  { departmentCode: "MTH", code: "MTH302", title: "Numerical Analysis", level: 300, candidateCount: 52, durationMinutes: 120 },
  { departmentCode: "MTH", code: "MTH404", title: "Mathematical Modelling", level: 400, candidateCount: 45, durationMinutes: 180 },
  { departmentCode: "STA", code: "STA202", title: "Probability Theory", level: 200, candidateCount: 55, durationMinutes: 120 },
  { departmentCode: "STA", code: "STA302", title: "Statistical Inference", level: 300, candidateCount: 48, durationMinutes: 120 },
  { departmentCode: "STA", code: "STA402", title: "Applied Statistics", level: 400, candidateCount: 40, durationMinutes: 180 },
  { departmentCode: "PHY", code: "PHY202", title: "Electromagnetism", level: 200, candidateCount: 48, durationMinutes: 120 },
  { departmentCode: "PHY", code: "PHY302", title: "Quantum Physics", level: 300, candidateCount: 42, durationMinutes: 120 },
  { departmentCode: "PHY", code: "PHY402", title: "Solid State Physics", level: 400, candidateCount: 35, durationMinutes: 180 },
  { departmentCode: "CHM", code: "CHM202", title: "Organic Chemistry", level: 200, candidateCount: 65, durationMinutes: 120 },
  { departmentCode: "CHM", code: "CHM302", title: "Physical Chemistry", level: 300, candidateCount: 55, durationMinutes: 120 },
  { departmentCode: "CHM", code: "CHM402", title: "Advanced Analytical Chemistry", level: 400, candidateCount: 42, durationMinutes: 180 },
  { departmentCode: "BIO", code: "BIO202", title: "Genetics", level: 200, candidateCount: 75, durationMinutes: 120 },
  { departmentCode: "BIO", code: "BIO302", title: "Ecology", level: 300, candidateCount: 63, durationMinutes: 120 },
  { departmentCode: "BIO", code: "BIO402", title: "Evolutionary Biology", level: 400, candidateCount: 52, durationMinutes: 180 },
  { departmentCode: "MCB", code: "MCB202", title: "General Microbiology", level: 200, candidateCount: 82, durationMinutes: 120 },
  { departmentCode: "MCB", code: "MCB302", title: "Medical Microbiology", level: 300, candidateCount: 70, durationMinutes: 120 },
  { departmentCode: "MCB", code: "MCB402", title: "Industrial Microbiology", level: 400, candidateCount: 58, durationMinutes: 180 },
  { departmentCode: "BCH", code: "BCH202", title: "Enzymology", level: 200, candidateCount: 76, durationMinutes: 120 },
  { departmentCode: "BCH", code: "BCH302", title: "Metabolic Biochemistry", level: 300, candidateCount: 65, durationMinutes: 120 },
  { departmentCode: "BCH", code: "BCH402", title: "Molecular Biochemistry", level: 400, candidateCount: 50, durationMinutes: 180 },
  { departmentCode: "EBI", code: "EBI202", title: "Environmental Pollution", level: 200, candidateCount: 52, durationMinutes: 120 },
  { departmentCode: "EBI", code: "EBI302", title: "Conservation Biology", level: 300, candidateCount: 45, durationMinutes: 120 },
  { departmentCode: "EBI", code: "EBI402", title: "Environmental Impact Assessment", level: 400, candidateCount: 38, durationMinutes: 180 },
  { departmentCode: "GLY", code: "GLY202", title: "Sedimentology", level: 200, candidateCount: 46, durationMinutes: 120 },
  { departmentCode: "GLY", code: "GLY302", title: "Structural Geology", level: 300, candidateCount: 40, durationMinutes: 120 },
  { departmentCode: "GLY", code: "GLY402", title: "Petroleum Geology", level: 400, candidateCount: 32, durationMinutes: 180 },
];

const venueSpecs = [
  { code: "LLT1", name: "LLT1", capacity: 170 },
  { code: "NAVATES2", name: "Navates 2", capacity: 100 },
  { code: "CAFE", name: "Cafe", capacity: 180 },
  { code: "AUDITORIUM", name: "Auditorium", capacity: 120 },
  { code: "NSC", name: "NSC", capacity: 180 },
  { code: "PRE-DEGREE", name: "Pre-degree", capacity: 200 },
  { code: "SCIENCE-COMPLEX", name: "Science Complex", capacity: 95 },
];

const invigilatorNames = [
  "Adewale Ogunleye", "Blessing Adebayo", "Chinedu Okafor", "Fatima Bello", "Ibrahim Musa",
  "Kemi Afolabi", "Kunle Adeyemi", "Maryam Yusuf", "Olamide Ajayi", "Peter Eze",
  "Sola Balogun", "Toluwa Oladipo", "Halima Sule", "Emeka Nwosu", "Rasheed Lawal",
];

const slotSpecs = [
  ["2026-10-05", "08:00", "11:00"], ["2026-10-05", "11:30", "13:30"], ["2026-10-05", "14:00", "17:00"],
  ["2026-10-06", "08:00", "11:00"], ["2026-10-06", "11:30", "13:30"], ["2026-10-06", "14:00", "17:00"],
  ["2026-10-07", "08:00", "11:00"], ["2026-10-07", "11:30", "13:30"], ["2026-10-07", "14:00", "17:00"],
  ["2026-10-08", "08:00", "11:00"], ["2026-10-08", "11:30", "13:30"], ["2026-10-08", "14:00", "17:00"],
  ["2026-10-09", "08:00", "11:00"], ["2026-10-09", "11:30", "13:30"], ["2026-10-09", "14:00", "17:00"],
] as const;

function dateValue(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function normalizedCode(value: string) { return value.replace(/\s+/g, "").toUpperCase(); }

async function audit(db: Tx, actorId: string, action: string, entity: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await db.auditLog.create({ data: { actorId, action, entity, entityId, metadata: { ...metadata, demoDataset: true, demoLabel: DEMO_LABEL } as Prisma.InputJsonValue } });
}

async function main() {
  const summary = { departmentsCreated: 0, departmentsReused: 0, programmesCreated: 0, programmesReused: 0, coursesCreated: 0, coursesReused: 0, offeringsCreated: 0, offeringsReused: 0, venuesCreated: 0, venuesReused: 0, invigilatorsCreated: 0, invigilatorsReused: 0, slotsCreated: 0, slotsReused: 0, calendarDaysCreated: 0, calendarDaysReused: 0, eventsCreated: 0, eventsReused: 0 };

  await prisma.$transaction(async (db) => {
    const admin = await db.user.findUnique({ where: { email: "admin@exampilot.local" }, select: { id: true } });
    if (!admin) throw new Error("The demonstration admin account does not exist.");

    const college = await db.college.findUnique({ where: { code: "SCI" } });
    if (!college) throw new Error("College of Science (SCI) must exist before seeding demo data.");

    const departments = new Map<string, { id: string; active: boolean }>();
    const programmes = new Map<string, { id: string; active: boolean }>();
    for (const spec of departmentSpecs) {
      const existingDepartment = await db.department.findUnique({ where: { collegeId_code: { collegeId: college.id, code: spec.code } } });
      const department = existingDepartment ?? await db.department.create({ data: { collegeId: college.id, code: spec.code, name: spec.name } });
      if (existingDepartment) summary.departmentsReused += 1; else { summary.departmentsCreated += 1; await audit(db, admin.id, "DEMO_DEPARTMENT_CREATED", "Department", department.id, { code: spec.code }); }
      if (!department.active) throw new Error(`Department ${spec.code} is inactive.`);
      departments.set(spec.code, department);

      const existingProgramme = await db.programme.findUnique({ where: { departmentId_code: { departmentId: department.id, code: spec.programmeCode } } });
      const programme = existingProgramme ?? await db.programme.create({ data: { departmentId: department.id, code: spec.programmeCode, name: spec.programmeName } });
      if (existingProgramme) summary.programmesReused += 1; else { summary.programmesCreated += 1; await audit(db, admin.id, "DEMO_PROGRAMME_CREATED", "Programme", programme.id, { code: spec.programmeCode, departmentCode: spec.code }); }
      if (!programme.active) throw new Error(`Programme ${spec.programmeCode} is inactive.`);
      programmes.set(spec.code, programme);
    }

    const session = await db.academicSession.findUnique({ where: { name: SESSION_NAME } });
    if (!session || !session.active) throw new Error(`Active academic session ${SESSION_NAME} is required.`);
    const semester = await db.semester.findUnique({ where: { academicSessionId_semesterNumber: { academicSessionId: session.id, semesterNumber: 2 } } });
    if (!semester || !semester.active || semester.name !== SECOND_SEMESTER) throw new Error("Active 2026/2027 Second Semester is required.");

    const courseRecords = new Map<string, { id: string; code: string; title: string; level: number; creditUnits: number; defaultExamMode: "PEN_ON_PAPER" | "CBT" | null; defaultDurationMinutes: number | null }>();
    const offeringRecords: { id: string; courseId: string; courseCode: string; title: string; programmeId: string; level: number; candidateCount: number; durationMinutes: number }[] = [];
    for (const spec of courseSpecs) {
      const department = departments.get(spec.departmentCode)!;
      const programme = programmes.get(spec.departmentCode)!;
      const code = normalizedCode(spec.code);
      const existingCourse = await db.course.findUnique({ where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: code } } });
      const course = existingCourse ?? await db.course.create({ data: { semesterId: semester.id, departmentId: department.id, code: spec.code, normalizedCode: code, title: spec.title, creditUnits: 3, level: spec.level, estimatedStudentCount: spec.candidateCount, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: spec.durationMinutes } });
      if (existingCourse) summary.coursesReused += 1; else { summary.coursesCreated += 1; await audit(db, admin.id, "DEMO_COURSE_CREATED", "Course", course.id, { code: course.code, semester: SECOND_SEMESTER }); }
      if (!course.active || course.semesterId !== semester.id || course.departmentId !== department.id || course.level !== spec.level) throw new Error(`Existing course ${spec.code} does not match the demonstration dataset contract.`);
      courseRecords.set(code, course);
      await db.programmeCourse.upsert({ where: { programmeId_courseId: { programmeId: programme.id, courseId: course.id } }, update: {}, create: { programmeId: programme.id, courseId: course.id } });

      const offering = await db.courseOffering.findUnique({ where: { academicSessionId_semesterId_programmeId_level_courseId: { academicSessionId: session.id, semesterId: semester.id, programmeId: programme.id, level: spec.level, courseId: course.id } } });
      if (offering) {
        if (!offering.active || offering.candidateCount !== spec.candidateCount || offering.examModeOverride !== "PEN_ON_PAPER" || offering.durationMinutesOverride !== spec.durationMinutes) throw new Error(`Existing offering for ${spec.code} does not match the demonstration dataset contract.`);
        summary.offeringsReused += 1;
        offeringRecords.push({ id: offering.id, courseId: course.id, courseCode: course.code, title: course.title, programmeId: programme.id, level: spec.level, candidateCount: spec.candidateCount, durationMinutes: spec.durationMinutes });
      } else {
        const createdOffering = await db.courseOffering.create({ data: { academicSessionId: session.id, semesterId: semester.id, courseId: course.id, programmeId: programme.id, level: spec.level, candidateCount: spec.candidateCount, examModeOverride: "PEN_ON_PAPER", durationMinutesOverride: spec.durationMinutes, active: true, source: "MANUAL" } });
        summary.offeringsCreated += 1;
        offeringRecords.push({ id: createdOffering.id, courseId: course.id, courseCode: course.code, title: course.title, programmeId: programme.id, level: spec.level, candidateCount: spec.candidateCount, durationMinutes: spec.durationMinutes });
        await audit(db, admin.id, "DEMO_COURSE_OFFERING_CREATED", "CourseOffering", createdOffering.id, { courseCode: course.code, candidateCount: spec.candidateCount, level: spec.level });
      }
    }

    const existingPeriod = await db.examPeriod.findFirst({ where: { sessionId: session.id, semesterId: semester.id }, orderBy: { createdAt: "asc" } });
    const period = existingPeriod ?? await db.examPeriod.create({ data: { sessionId: session.id, semesterId: semester.id, name: EXAM_PERIOD_NAME, startDate: dateValue("2026-10-05"), endDate: dateValue("2026-10-09"), active: true, defaultDayStartTime: "08:00", defaultDayEndTime: "18:00", defaultTurnaroundMinutes: 30, writtenTurnaroundMinutes: 30, cbtTurnaroundMinutes: 15, timeGranularityMinutes: 30 } });
    if (!period.active || period.defaultDayStartTime !== "08:00" || period.defaultDayEndTime !== "18:00") throw new Error("The selected second-semester examination period is not configured for 08:00-18:00.");

    for (const date of [...new Set(slotSpecs.map(([day]) => day))]) {
      const existingDay = await db.examCalendarDay.findUnique({ where: { examPeriodId_date: { examPeriodId: period.id, date: dateValue(date) } } });
      if (existingDay) summary.calendarDaysReused += 1;
      else { const day = await db.examCalendarDay.create({ data: { examPeriodId: period.id, date: dateValue(date), enabled: true, dayType: "DEMO_EXAM_DAY", startTime: "08:00", endTime: "18:00", reason: DEMO_LABEL } }); summary.calendarDaysCreated += 1; await audit(db, admin.id, "DEMO_CALENDAR_DAY_CREATED", "ExamCalendarDay", day.id, { date }); }
    }
    for (const [date, startTime, endTime] of slotSpecs) {
      const existingSlot = await db.examTimeSlot.findUnique({ where: { examPeriodId_date_startTime_endTime: { examPeriodId: period.id, date: dateValue(date), startTime, endTime } } });
      if (existingSlot) summary.slotsReused += 1;
      else { const slot = await db.examTimeSlot.create({ data: { examPeriodId: period.id, date: dateValue(date), startTime, endTime } }); summary.slotsCreated += 1; await audit(db, admin.id, "DEMO_TIME_SLOT_CREATED", "ExamTimeSlot", slot.id, { date, startTime, endTime }); }
    }

    for (const spec of venueSpecs) {
      const existingVenue = await db.venue.findUnique({ where: { code: spec.code } });
      if (existingVenue) summary.venuesReused += 1;
      else { const venue = await db.venue.create({ data: { code: spec.code, name: spec.name, capacity: spec.capacity, examCapacity: spec.capacity, capability: "WRITTEN", active: true, venueGroup: "DEMONSTRATION" } }); summary.venuesCreated += 1; await audit(db, admin.id, "DEMO_VENUE_CREATED", "Venue", venue.id, { code: spec.code, capacity: spec.capacity }); }
    }
    for (let index = 0; index < invigilatorNames.length; index += 1) {
      const staffId = `DEMO-INV-${String(index + 1).padStart(3, "0")}`;
      const existingInvigilator = await db.invigilator.findUnique({ where: { staffId } });
      if (existingInvigilator) summary.invigilatorsReused += 1;
      else { const invigilator = await db.invigilator.create({ data: { staffId, name: invigilatorNames[index], email: `demo.invigilator.${String(index + 1).padStart(3, "0")}@exampilot.local`, departmentId: departmentSpecs[index % departmentSpecs.length] ? departments.get(departmentSpecs[index % departmentSpecs.length].code)!.id : null, active: true, maximumDailyAssignments: 3, role: "INVIGILATOR" } }); summary.invigilatorsCreated += 1; await audit(db, admin.id, "DEMO_INVIGILATOR_CREATED", "Invigilator", invigilator.id, { staffId }); }
    }

    for (const offering of offeringRecords) {
      const membership = await db.examEventOffering.findFirst({ where: { courseOfferingId: offering.id }, include: { examEvent: true } });
      if (membership) {
        if (!membership.examEvent.active || membership.examEvent.status === "ARCHIVED") throw new Error(`Offering ${offering.courseCode} belongs to an archived event.`);
        summary.eventsReused += 1;
        continue;
      }
      const event = await db.examEvent.create({ data: { academicSessionId: session.id, semesterId: semester.id, title: offering.title, examMode: "PEN_ON_PAPER", durationMinutes: offering.durationMinutes, source: "AUTO_AGGREGATED", status: "DRAFT", createdById: admin.id, offerings: { create: { courseOfferingId: offering.id } } } });
      summary.eventsCreated += 1;
      await audit(db, admin.id, "DEMO_EXAM_EVENT_CREATED", "ExamEvent", event.id, { courseCode: offering.courseCode, candidateCount: offering.candidateCount });
    }
  }, { timeout: 120000 });

  console.log(JSON.stringify({ label: DEMO_LABEL, session: SESSION_NAME, semester: SECOND_SEMESTER, courses: courseSpecs.length, summary }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
