-- Phase B aggregate scheduling persistence foundation.
-- This migration is additive: it does not drop or rename legacy tables.

CREATE TYPE "ExamMode" AS ENUM ('PEN_ON_PAPER', 'CBT');
CREATE TYPE "CourseOfferingSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'LEGACY_DERIVED');
CREATE TYPE "ExamEventSource" AS ENUM ('AUTO_AGGREGATED', 'MANUAL_MERGE');
CREATE TYPE "ExamEventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ExamConflictSeverity" AS ENUM ('HARD', 'SOFT');
CREATE TYPE "ExplicitExamConflictType" AS ENUM ('CARRYOVER', 'ELECTIVE_OVERLAP', 'DEPARTMENT_RULE', 'MANUAL');
CREATE TYPE "VenueCapability" AS ENUM ('WRITTEN', 'CBT', 'BOTH');
CREATE TYPE "InvigilatorRole" AS ENUM ('INVIGILATOR', 'CHIEF_INVIGILATOR', 'CBT_TECHNICAL_SUPPORT', 'OTHER');

ALTER TABLE "Course" ADD COLUMN "defaultDurationMinutes" INTEGER;
ALTER TABLE "Course" ADD COLUMN "defaultExamMode" "ExamMode";
ALTER TABLE "Invigilator" ADD COLUMN "maximumTotalAssignments" INTEGER;
ALTER TABLE "Invigilator" ADD COLUMN "role" "InvigilatorRole" NOT NULL DEFAULT 'INVIGILATOR';
ALTER TABLE "TimetableGeneration" ADD COLUMN "inputSnapshot" JSONB;
ALTER TABLE "TimetableGeneration" ADD COLUMN "snapshotSchemaVersion" TEXT;
ALTER TABLE "Venue" ADD COLUMN "capability" "VenueCapability" NOT NULL DEFAULT 'WRITTEN';
ALTER TABLE "Venue" ADD COLUMN "computerCapacity" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "examCapacity" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "usableComputerCapacity" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "venueGroup" TEXT;

CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "examModeOverride" "ExamMode",
    "durationMinutesOverride" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" "CourseOfferingSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_candidateCount_nonnegative" CHECK ("candidateCount" >= 0);

CREATE TABLE "ExamEvent" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "examPeriodId" TEXT,
    "title" TEXT NOT NULL,
    "examMode" "ExamMode" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "source" "ExamEventSource" NOT NULL,
    "status" "ExamEventStatus" NOT NULL DEFAULT 'DRAFT',
    "manualMergeReason" TEXT,
    "createdById" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamEventOffering" (
    "id" TEXT NOT NULL,
    "examEventId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamEventOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamConflict" (
    "id" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "courseAId" TEXT NOT NULL,
    "courseBId" TEXT NOT NULL,
    "severity" "ExamConflictSeverity" NOT NULL,
    "type" "ExplicitExamConflictType" NOT NULL,
    "estimatedSharedCandidates" INTEGER,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseLoadImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "createdOfferings" INTEGER NOT NULL DEFAULT 0,
    "updatedOfferings" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseLoadImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseOffering_academicSessionId_semesterId_idx" ON "CourseOffering"("academicSessionId", "semesterId");
CREATE INDEX "CourseOffering_programmeId_level_idx" ON "CourseOffering"("programmeId", "level");
CREATE INDEX "CourseOffering_courseId_idx" ON "CourseOffering"("courseId");
CREATE UNIQUE INDEX "CourseOffering_academicSessionId_semesterId_programmeId_level_courseId_key" ON "CourseOffering"("academicSessionId", "semesterId", "programmeId", "level", "courseId");
CREATE INDEX "ExamEvent_academicSessionId_semesterId_idx" ON "ExamEvent"("academicSessionId", "semesterId");
CREATE INDEX "ExamEvent_examPeriodId_idx" ON "ExamEvent"("examPeriodId");
CREATE INDEX "ExamEvent_status_active_idx" ON "ExamEvent"("status", "active");
CREATE INDEX "ExamEventOffering_courseOfferingId_idx" ON "ExamEventOffering"("courseOfferingId");
CREATE UNIQUE INDEX "ExamEventOffering_examEventId_courseOfferingId_key" ON "ExamEventOffering"("examEventId", "courseOfferingId");
CREATE INDEX "ExamConflict_academicSessionId_semesterId_active_idx" ON "ExamConflict"("academicSessionId", "semesterId", "active");
CREATE UNIQUE INDEX "ExamConflict_academicSessionId_semesterId_courseAId_courseBId_key" ON "ExamConflict"("academicSessionId", "semesterId", "courseAId", "courseBId");
CREATE INDEX "CourseLoadImport_academicSessionId_semesterId_createdAt_idx" ON "CourseLoadImport"("academicSessionId", "semesterId", "createdAt");
CREATE INDEX "CourseLoadImport_uploadedBy_createdAt_idx" ON "CourseLoadImport"("uploadedBy", "createdAt");

ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_examPeriodId_fkey" FOREIGN KEY ("examPeriodId") REFERENCES "ExamPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamEvent" ADD CONSTRAINT "ExamEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamEventOffering" ADD CONSTRAINT "ExamEventOffering_examEventId_fkey" FOREIGN KEY ("examEventId") REFERENCES "ExamEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamEventOffering" ADD CONSTRAINT "ExamEventOffering_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamConflict" ADD CONSTRAINT "ExamConflict_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamConflict" ADD CONSTRAINT "ExamConflict_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamConflict" ADD CONSTRAINT "ExamConflict_courseAId_fkey" FOREIGN KEY ("courseAId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamConflict" ADD CONSTRAINT "ExamConflict_courseBId_fkey" FOREIGN KEY ("courseBId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamConflict" ADD CONSTRAINT "ExamConflict_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseLoadImport" ADD CONSTRAINT "CourseLoadImport_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseLoadImport" ADD CONSTRAINT "CourseLoadImport_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseLoadImport" ADD CONSTRAINT "CourseLoadImport_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
