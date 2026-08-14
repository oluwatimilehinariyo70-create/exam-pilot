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

  await prisma.venue.createMany({
    data: [
      { code: "SCI-HALL-A", name: "Science Hall A", location: "Science Complex", capacity: 120 },
      { code: "SCI-HALL-B", name: "Science Hall B", location: "Science Complex", capacity: 80 },
      { code: "CSC-LAB-1", name: "Computer Laboratory 1", location: "ICT Building", capacity: 45 },
    ],
    skipDuplicates: true,
  });

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
