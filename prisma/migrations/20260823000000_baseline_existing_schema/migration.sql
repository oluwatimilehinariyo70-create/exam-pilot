-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ExamScheduleStatus" AS ENUM ('DRAFT', 'GENERATED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."TimetableReviewStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED');

-- CreateTable
CREATE TABLE "public"."AcademicSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."College" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "normalizedCode" TEXT,
    "title" TEXT NOT NULL,
    "creditUnits" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "departmentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "estimatedStudentCount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CourseRegistration" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamPeriod" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamSchedule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "generationId" TEXT,
    "status" "public"."ExamScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamTimeSlot" (
    "id" TEXT NOT NULL,
    "examPeriodId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamVenueAssignment" (
    "examScheduleId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "allocatedCapacity" INTEGER NOT NULL,

    CONSTRAINT "ExamVenueAssignment_pkey" PRIMARY KEY ("examScheduleId","venueId")
);

-- CreateTable
CREATE TABLE "public"."InvigilationAssignment" (
    "examScheduleId" TEXT NOT NULL,
    "invigilatorId" TEXT NOT NULL,
    "venueId" TEXT,

    CONSTRAINT "InvigilationAssignment_pkey" PRIMARY KEY ("examScheduleId","invigilatorId")
);

-- CreateTable
CREATE TABLE "public"."Invigilator" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maximumDailyAssignments" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invigilator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvigilatorUnavailablePeriod" (
    "id" TEXT NOT NULL,
    "invigilatorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvigilatorUnavailablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Programme" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProgrammeCourse" (
    "programmeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "ProgrammeCourse_pkey" PRIMARY KEY ("programmeId","courseId")
);

-- CreateTable
CREATE TABLE "public"."RegistrationImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "createdStudents" INTEGER NOT NULL DEFAULT 0,
    "createdRegistrations" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ImportStatus" NOT NULL,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Semester" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Student" (
    "id" TEXT NOT NULL,
    "matricNumber" TEXT NOT NULL,
    "name" TEXT,
    "programmeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TimetableGeneration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "reviewStatus" "public"."TimetableReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "lockKey" TEXT,
    "engineVersion" TEXT,
    "seed" INTEGER,
    "attemptCount" INTEGER,
    "score" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "TimetableGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VenueUnavailablePeriod" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueUnavailablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSession_name_key" ON "public"."AcademicSession"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "public"."Account"("providerId" ASC, "accountId" ASC);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "public"."AuditLog"("actorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "public"."AuditLog"("entity" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "College_code_key" ON "public"."College"("code" ASC);

-- CreateIndex
CREATE INDEX "Course_departmentId_idx" ON "public"."Course"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "Course_normalizedCode_idx" ON "public"."Course"("normalizedCode" ASC);

-- CreateIndex
CREATE INDEX "Course_semesterId_idx" ON "public"."Course"("semesterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Course_semesterId_normalizedCode_key" ON "public"."Course"("semesterId" ASC, "normalizedCode" ASC);

-- CreateIndex
CREATE INDEX "CourseRegistration_courseId_sessionId_semesterId_idx" ON "public"."CourseRegistration"("courseId" ASC, "sessionId" ASC, "semesterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_courseId_sessionId_semesterId_key" ON "public"."CourseRegistration"("studentId" ASC, "courseId" ASC, "sessionId" ASC, "semesterId" ASC);

-- CreateIndex
CREATE INDEX "CourseRegistration_studentId_sessionId_semesterId_idx" ON "public"."CourseRegistration"("studentId" ASC, "sessionId" ASC, "semesterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Department_collegeId_code_key" ON "public"."Department"("collegeId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Department_collegeId_idx" ON "public"."Department"("collegeId" ASC);

-- CreateIndex
CREATE INDEX "ExamPeriod_sessionId_semesterId_idx" ON "public"."ExamPeriod"("sessionId" ASC, "semesterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamPeriod_sessionId_semesterId_name_key" ON "public"."ExamPeriod"("sessionId" ASC, "semesterId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamSchedule_generationId_courseId_timeSlotId_key" ON "public"."ExamSchedule"("generationId" ASC, "courseId" ASC, "timeSlotId" ASC);

-- CreateIndex
CREATE INDEX "ExamSchedule_generationId_idx" ON "public"."ExamSchedule"("generationId" ASC);

-- CreateIndex
CREATE INDEX "ExamSchedule_timeSlotId_idx" ON "public"."ExamSchedule"("timeSlotId" ASC);

-- CreateIndex
CREATE INDEX "ExamTimeSlot_examPeriodId_date_idx" ON "public"."ExamTimeSlot"("examPeriodId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamTimeSlot_examPeriodId_date_startTime_endTime_key" ON "public"."ExamTimeSlot"("examPeriodId" ASC, "date" ASC, "startTime" ASC, "endTime" ASC);

-- CreateIndex
CREATE INDEX "ExamVenueAssignment_venueId_idx" ON "public"."ExamVenueAssignment"("venueId" ASC);

-- CreateIndex
CREATE INDEX "InvigilationAssignment_invigilatorId_idx" ON "public"."InvigilationAssignment"("invigilatorId" ASC);

-- CreateIndex
CREATE INDEX "Invigilator_departmentId_idx" ON "public"."Invigilator"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invigilator_email_key" ON "public"."Invigilator"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invigilator_staffId_key" ON "public"."Invigilator"("staffId" ASC);

-- CreateIndex
CREATE INDEX "InvigilatorUnavailablePeriod_invigilatorId_date_idx" ON "public"."InvigilatorUnavailablePeriod"("invigilatorId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Programme_departmentId_code_key" ON "public"."Programme"("departmentId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Programme_departmentId_idx" ON "public"."Programme"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "ProgrammeCourse_courseId_idx" ON "public"."ProgrammeCourse"("courseId" ASC);

-- CreateIndex
CREATE INDEX "RegistrationImport_sessionId_semesterId_createdAt_idx" ON "public"."RegistrationImport"("sessionId" ASC, "semesterId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "RegistrationImport_uploadedBy_createdAt_idx" ON "public"."RegistrationImport"("uploadedBy" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Semester_academicSessionId_idx" ON "public"."Semester"("academicSessionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicSessionId_semesterNumber_key" ON "public"."Semester"("academicSessionId" ASC, "semesterNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_matricNumber_key" ON "public"."Student"("matricNumber" ASC);

-- CreateIndex
CREATE INDEX "Student_programmeId_level_idx" ON "public"."Student"("programmeId" ASC, "level" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TimetableGeneration_lockKey_key" ON "public"."TimetableGeneration"("lockKey" ASC);

-- CreateIndex
CREATE INDEX "TimetableGeneration_sessionId_semesterId_idx" ON "public"."TimetableGeneration"("sessionId" ASC, "semesterId" ASC);

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "public"."User"("departmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_code_key" ON "public"."Venue"("code" ASC);

-- CreateIndex
CREATE INDEX "VenueUnavailablePeriod_venueId_date_idx" ON "public"."VenueUnavailablePeriod"("venueId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "public"."Verification"("identifier" ASC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseRegistration" ADD CONSTRAINT "CourseRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseRegistration" ADD CONSTRAINT "CourseRegistration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseRegistration" ADD CONSTRAINT "CourseRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseRegistration" ADD CONSTRAINT "CourseRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamPeriod" ADD CONSTRAINT "ExamPeriod_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamPeriod" ADD CONSTRAINT "ExamPeriod_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "public"."TimetableGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "public"."ExamTimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamTimeSlot" ADD CONSTRAINT "ExamTimeSlot_examPeriodId_fkey" FOREIGN KEY ("examPeriodId") REFERENCES "public"."ExamPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamVenueAssignment" ADD CONSTRAINT "ExamVenueAssignment_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "public"."ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamVenueAssignment" ADD CONSTRAINT "ExamVenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvigilationAssignment" ADD CONSTRAINT "InvigilationAssignment_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "public"."ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvigilationAssignment" ADD CONSTRAINT "InvigilationAssignment_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "public"."Invigilator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvigilationAssignment" ADD CONSTRAINT "InvigilationAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invigilator" ADD CONSTRAINT "Invigilator_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvigilatorUnavailablePeriod" ADD CONSTRAINT "InvigilatorUnavailablePeriod_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "public"."Invigilator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Programme" ADD CONSTRAINT "Programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProgrammeCourse" ADD CONSTRAINT "ProgrammeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProgrammeCourse" ADD CONSTRAINT "ProgrammeCourse_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "public"."Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationImport" ADD CONSTRAINT "RegistrationImport_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationImport" ADD CONSTRAINT "RegistrationImport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistrationImport" ADD CONSTRAINT "RegistrationImport_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Semester" ADD CONSTRAINT "Semester_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "public"."Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableGeneration" ADD CONSTRAINT "TimetableGeneration_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableGeneration" ADD CONSTRAINT "TimetableGeneration_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableGeneration" ADD CONSTRAINT "TimetableGeneration_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."ExamPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableGeneration" ADD CONSTRAINT "TimetableGeneration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "public"."Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TimetableGeneration" ADD CONSTRAINT "TimetableGeneration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VenueUnavailablePeriod" ADD CONSTRAINT "VenueUnavailablePeriod_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;


