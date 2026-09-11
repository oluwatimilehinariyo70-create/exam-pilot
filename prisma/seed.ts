import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);
  else {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  }
}

const prisma = new PrismaClient();

const SEED_ADMIN_EMAIL = "admin@exampilot.local";

async function seedAdmin() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("SEED_ADMIN_PASSWORD must be set before running the seed.");
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");

  const existingAdmin = await prisma.user.findUnique({ where: { email: SEED_ADMIN_EMAIL } });
  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { name: "Exam Pilot Administrator", emailVerified: true, role: "SUPER_ADMIN", active: true },
    create: { id: randomUUID(), name: "Exam Pilot Administrator", email: SEED_ADMIN_EMAIL, emailVerified: true, role: "SUPER_ADMIN", active: true },
  });
  const passwordHash = await hashPassword(password);
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: admin.id } },
    update: { userId: admin.id, password: passwordHash },
    create: { id: randomUUID(), accountId: admin.id, providerId: "credential", userId: admin.id, password: passwordHash },
  });

  return { admin, existed: Boolean(existingAdmin) };
}

async function main() {
  const admin = await seedAdmin();
  const college = await prisma.college.upsert({
    where: { code: "SCI" },
    update: {},
    create: { code: "SCI", name: "College of Science" },
  });

  const computerScience = await prisma.department.upsert({
    where: { collegeId_code: { collegeId: college.id, code: "CSC" } },
    update: {},
    create: { collegeId: college.id, code: "CSC", name: "Computer Science" },
  });

  const mathematics = await prisma.department.upsert({
    where: { collegeId_code: { collegeId: college.id, code: "MTH" } },
    update: {},
    create: { collegeId: college.id, code: "MTH", name: "Mathematics" },
  });

  const physics = await prisma.department.upsert({
    where: { collegeId_code: { collegeId: college.id, code: "PHY" } },
    update: { active: true },
    create: { collegeId: college.id, code: "PHY", name: "Physics" },
  });

  const chemistry = await prisma.department.upsert({
    where: { collegeId_code: { collegeId: college.id, code: "CHM" } },
    update: { active: true },
    create: { collegeId: college.id, code: "CHM", name: "Chemistry" },
  });

  const programme = await prisma.programme.upsert({
    where: { departmentId_code: { departmentId: computerScience.id, code: "BSC-CS" } },
    update: {},
    create: { departmentId: computerScience.id, code: "BSC-CS", name: "B.Sc. Computer Science" },
  });

  const physicsProgramme = await prisma.programme.upsert({
    where: { departmentId_code: { departmentId: physics.id, code: "BSC-PHY" } },
    update: { active: true },
    create: { departmentId: physics.id, code: "BSC-PHY", name: "B.Sc. Physics" },
  });

  const mathematicsProgramme = await prisma.programme.upsert({
    where: { departmentId_code: { departmentId: mathematics.id, code: "BSC-MTH" } },
    update: { active: true },
    create: { departmentId: mathematics.id, code: "BSC-MTH", name: "B.Sc. Mathematics" },
  });

  const chemistryProgramme = await prisma.programme.upsert({
    where: { departmentId_code: { departmentId: chemistry.id, code: "BSC-CHM" } },
    update: { active: true },
    create: { departmentId: chemistry.id, code: "BSC-CHM", name: "B.Sc. Chemistry" },
  });

  const session = await prisma.academicSession.upsert({
    where: { name: "2026/2027" },
    update: { active: true },
    create: { name: "2026/2027", startYear: 2026, endYear: 2027, active: true },
  });

  const semester = await prisma.semester.upsert({
    where: { academicSessionId_semesterNumber: { academicSessionId: session.id, semesterNumber: 1 } },
    update: {},
    create: { academicSessionId: session.id, name: "First Semester", semesterNumber: 1 },
  });

  const secondSemester = await prisma.semester.upsert({
    where: { academicSessionId_semesterNumber: { academicSessionId: session.id, semesterNumber: 2 } },
    update: { active: true },
    create: { academicSessionId: session.id, name: "Second Semester", semesterNumber: 2, active: true },
  });

  const courses = await Promise.all([
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "CSC401" } },
      update: {},
      create: { semesterId: semester.id, departmentId: computerScience.id, code: "CSC 401", normalizedCode: "CSC401", title: "Advanced Algorithms", creditUnits: 3, level: 400, estimatedStudentCount: 42 },
    }),
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "CSC405" } },
      update: {},
      create: { semesterId: semester.id, departmentId: computerScience.id, code: "CSC 405", normalizedCode: "CSC405", title: "Distributed Systems", creditUnits: 3, level: 400, estimatedStudentCount: 38 },
    }),
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "MTH301" } },
      update: {},
      create: { semesterId: semester.id, departmentId: mathematics.id, code: "MTH 301", normalizedCode: "MTH301", title: "Numerical Methods", creditUnits: 3, level: 300, estimatedStudentCount: 64 },
    }),
  ]);

  await prisma.programmeCourse.createMany({
    data: courses.map((course) => ({ programmeId: programme.id, courseId: course.id })),
    skipDuplicates: true,
  });

  const aggregateCourses = await Promise.all([
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "PHY202" } },
      update: { code: "PHY 202", title: "General Physics II", creditUnits: 3, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180, active: true },
      create: { semesterId: semester.id, departmentId: physics.id, code: "PHY 202", normalizedCode: "PHY202", title: "General Physics II", creditUnits: 3, level: 200, estimatedStudentCount: 200, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180 },
    }),
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "CSC202" } },
      update: { code: "CSC 202", title: "Data Structures", creditUnits: 3, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180, active: true },
      create: { semesterId: semester.id, departmentId: computerScience.id, code: "CSC 202", normalizedCode: "CSC202", title: "Data Structures", creditUnits: 3, level: 200, estimatedStudentCount: 180, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180 },
    }),
    prisma.course.upsert({
      where: { semesterId_normalizedCode: { semesterId: semester.id, normalizedCode: "MTH202" } },
      update: { code: "MTH 202", title: "Linear Algebra", creditUnits: 3, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180, active: true },
      create: { semesterId: semester.id, departmentId: mathematics.id, code: "MTH 202", normalizedCode: "MTH202", title: "Linear Algebra", creditUnits: 3, level: 200, estimatedStudentCount: 120, defaultExamMode: "PEN_ON_PAPER", defaultDurationMinutes: 180 },
    }),
  ]);

  await prisma.programmeCourse.createMany({
    data: [
      { programmeId: programme.id, courseId: aggregateCourses[0].id },
      { programmeId: mathematicsProgramme.id, courseId: aggregateCourses[0].id },
      { programmeId: programme.id, courseId: aggregateCourses[1].id },
      { programmeId: mathematicsProgramme.id, courseId: aggregateCourses[2].id },
    ],
    skipDuplicates: true,
  });

  await prisma.courseOffering.createMany({
    data: [
      { academicSessionId: session.id, semesterId: semester.id, courseId: aggregateCourses[0].id, programmeId: programme.id, level: 200, candidateCount: 150, source: "LEGACY_DERIVED" },
      { academicSessionId: session.id, semesterId: semester.id, courseId: aggregateCourses[0].id, programmeId: mathematicsProgramme.id, level: 200, candidateCount: 50, source: "MANUAL" },
      { academicSessionId: session.id, semesterId: semester.id, courseId: aggregateCourses[1].id, programmeId: programme.id, level: 200, candidateCount: 180, source: "MANUAL" },
      { academicSessionId: session.id, semesterId: semester.id, courseId: aggregateCourses[2].id, programmeId: mathematicsProgramme.id, level: 200, candidateCount: 120, source: "MANUAL" },
    ],
    skipDuplicates: true,
  });

  const sampleStudents = await Promise.all([
    prisma.student.upsert({ where: { matricNumber: "2024/CSC/001" }, update: { name: "Sample Student A", programmeId: programme.id, level: 400, active: true }, create: { matricNumber: "2024/CSC/001", name: "Sample Student A", programmeId: programme.id, level: 400 } }),
    prisma.student.upsert({ where: { matricNumber: "2024/CSC/002" }, update: { name: "Sample Student B", programmeId: programme.id, level: 400, active: true }, create: { matricNumber: "2024/CSC/002", name: "Sample Student B", programmeId: programme.id, level: 400 } }),
    prisma.student.upsert({ where: { matricNumber: "2024/CSC/003" }, update: { name: "Sample Student C", programmeId: programme.id, level: 400, active: true }, create: { matricNumber: "2024/CSC/003", name: "Sample Student C", programmeId: programme.id, level: 400 } }),
  ]);

  await prisma.courseRegistration.createMany({
    data: [
      { studentId: sampleStudents[0].id, courseId: courses[0].id, sessionId: session.id, semesterId: semester.id },
      { studentId: sampleStudents[0].id, courseId: courses[1].id, sessionId: session.id, semesterId: semester.id },
      { studentId: sampleStudents[1].id, courseId: courses[0].id, sessionId: session.id, semesterId: semester.id },
      { studentId: sampleStudents[1].id, courseId: courses[2].id, sessionId: session.id, semesterId: semester.id },
      { studentId: sampleStudents[2].id, courseId: courses[1].id, sessionId: session.id, semesterId: semester.id },
      { studentId: sampleStudents[2].id, courseId: courses[2].id, sessionId: session.id, semesterId: semester.id },
    ],
    skipDuplicates: true,
  });

  await prisma.programmeCourse.createMany({
    data: [
      { programmeId: physicsProgramme.id, courseId: courses[2].id },
      { programmeId: chemistryProgramme.id, courseId: courses[2].id },
    ],
    skipDuplicates: true,
  });

  const existingPeriod = await prisma.examPeriod.findFirst({ where: { sessionId: session.id, semesterId: semester.id, name: "2026/2027 First Semester Examination" } });
  const period = existingPeriod ?? await prisma.examPeriod.create({
    data: {
      sessionId: session.id,
      semesterId: semester.id,
      name: "2026/2027 First Semester Examination",
      startDate: new Date("2027-02-01T00:00:00.000Z"),
      endDate: new Date("2027-02-12T00:00:00.000Z"),
      active: true,
    },
  });

  await prisma.examTimeSlot.createMany({
    data: [
      { examPeriodId: period.id, date: new Date("2027-02-01T00:00:00.000Z"), startTime: "09:00", endTime: "12:00" },
      { examPeriodId: period.id, date: new Date("2027-02-01T00:00:00.000Z"), startTime: "14:00", endTime: "17:00" },
      { examPeriodId: period.id, date: new Date("2027-02-02T00:00:00.000Z"), startTime: "09:00", endTime: "12:00" },
      { examPeriodId: period.id, date: new Date("2027-02-02T00:00:00.000Z"), startTime: "14:00", endTime: "17:00" },
    ],
    skipDuplicates: true,
  });

  const knownVenues = [
    { code: "NSC", name: "NSC", capacity: 200, examCapacity: 200, capability: "WRITTEN" as const },
    { code: "CAFE", name: "CAFE", capacity: 180, examCapacity: 180, capability: "WRITTEN" as const },
    { code: "LLT1", name: "LLT1", capacity: 300, examCapacity: 300, capability: "WRITTEN" as const },
    { code: "S1", name: "S1", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "S2", name: "S2", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "S3", name: "S3", capacity: 40, examCapacity: 40, capability: "WRITTEN" as const },
    { code: "LR1", name: "LR1", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "LR2", name: "LR2", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "LR3", name: "LR3", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "LR4", name: "LR4", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "LR5", name: "LR5", capacity: 60, examCapacity: 60, capability: "WRITTEN" as const },
    { code: "NAVATES2", name: "Navates 2", capacity: 160, examCapacity: 160, capability: "WRITTEN" as const },
    { code: "UCRC", name: "UCRC", capacity: 250, computerCapacity: 250, usableComputerCapacity: 250, capability: "CBT" as const },
    { code: "LIBRARY-ICT", name: "Library ICT", capacity: 100, computerCapacity: 100, usableComputerCapacity: 100, capability: "CBT" as const },
  ];
  for (const venue of knownVenues) if (!(await prisma.venue.findUnique({ where: { code: venue.code }, select: { id: true } }))) await prisma.venue.create({ data: venue });

  await prisma.invigilator.createMany({
    data: [
      { staffId: "STAFF-001", name: "Sample Invigilator One", email: "invigilator.one@example.edu", departmentId: computerScience.id },
      { staffId: "STAFF-002", name: "Sample Invigilator Two", email: "invigilator.two@example.edu", departmentId: mathematics.id },
    ],
    skipDuplicates: true,
  });

  console.log(`Seeded ${college.name}, ${session.name}, ${secondSemester.name}, and ${courses.length} sample courses with examination slots.`);
  console.log(`Development admin account ${admin.existed ? "updated" : "created"}: ${admin.admin.email} (SUPER_ADMIN).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
