-- Phase G: additive CBT batching, sittings, and technical-support assignments.
CREATE TYPE "CbtSittingStaffType" AS ENUM ('INVIGILATOR', 'TECHNICAL_SUPPORT');

ALTER TABLE "ExamPeriod"
  ADD COLUMN "cbtBatchingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cbtMinimumBatchGapMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "cbtMaxBatchesPerDay" INTEGER,
  ADD COLUMN "cbtRequireSameDay" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cbtAllowMultiDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cbtPreferMaximumCapacityPerBatch" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cbtMinimumInvigilatorsPerVenue" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "cbtMinimumTechnicalSupportPerVenue" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "cbtAdditionalSupportPerCandidates" INTEGER;

CREATE TABLE "ExamSitting" (
  "id" TEXT NOT NULL,
  "examEventId" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "batchLabel" TEXT,
  "candidateCount" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" "ExamScheduleStatus" NOT NULL DEFAULT 'GENERATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSitting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamSitting_generationId_examEventId_sequenceNumber_key" ON "ExamSitting"("generationId", "examEventId", "sequenceNumber");
CREATE INDEX "ExamSitting_generationId_examEventId_idx" ON "ExamSitting"("generationId", "examEventId");
CREATE INDEX "ExamSitting_date_startTime_idx" ON "ExamSitting"("date", "startTime");
ALTER TABLE "ExamSitting" ADD CONSTRAINT "ExamSitting_examEventId_fkey" FOREIGN KEY ("examEventId") REFERENCES "ExamEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamSitting" ADD CONSTRAINT "ExamSitting_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "TimetableGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExamSittingVenueAssignment" (
  "sittingId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "allocatedCandidates" INTEGER NOT NULL,
  "allocatedCapacity" INTEGER NOT NULL,
  CONSTRAINT "ExamSittingVenueAssignment_pkey" PRIMARY KEY ("sittingId", "venueId")
);
CREATE INDEX "ExamSittingVenueAssignment_venueId_idx" ON "ExamSittingVenueAssignment"("venueId");
ALTER TABLE "ExamSittingVenueAssignment" ADD CONSTRAINT "ExamSittingVenueAssignment_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "ExamSitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSittingVenueAssignment" ADD CONSTRAINT "ExamSittingVenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ExamSittingStaffAssignment" (
  "sittingId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "assignmentType" "CbtSittingStaffType" NOT NULL,
  "venueId" TEXT,
  CONSTRAINT "ExamSittingStaffAssignment_pkey" PRIMARY KEY ("sittingId", "staffId", "assignmentType")
);
CREATE INDEX "ExamSittingStaffAssignment_staffId_idx" ON "ExamSittingStaffAssignment"("staffId");
ALTER TABLE "ExamSittingStaffAssignment" ADD CONSTRAINT "ExamSittingStaffAssignment_sittingId_fkey" FOREIGN KEY ("sittingId") REFERENCES "ExamSitting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSittingStaffAssignment" ADD CONSTRAINT "ExamSittingStaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Invigilator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamSittingStaffAssignment" ADD CONSTRAINT "ExamSittingStaffAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
