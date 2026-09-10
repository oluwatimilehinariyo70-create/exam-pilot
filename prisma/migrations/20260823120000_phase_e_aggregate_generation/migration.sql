-- Phase E: additive event-aware timetable persistence. Legacy ExamSchedule remains unchanged.
CREATE TYPE "TimetableGenerationMode" AS ENUM ('LEGACY_REGISTRATION', 'AGGREGATE_EVENT');

ALTER TABLE "TimetableGeneration"
  ADD COLUMN "generationMode" "TimetableGenerationMode" NOT NULL DEFAULT 'LEGACY_REGISTRATION';

CREATE TABLE "AggregateExamSchedule" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "status" "ExamScheduleStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AggregateExamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AggregateExamVenueAssignment" (
    "aggregateScheduleId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "allocatedCapacity" INTEGER NOT NULL,
    CONSTRAINT "AggregateExamVenueAssignment_pkey" PRIMARY KEY ("aggregateScheduleId", "venueId")
);

CREATE TABLE "AggregateInvigilationAssignment" (
    "aggregateScheduleId" TEXT NOT NULL,
    "invigilatorId" TEXT NOT NULL,
    "venueId" TEXT,
    CONSTRAINT "AggregateInvigilationAssignment_pkey" PRIMARY KEY ("aggregateScheduleId", "invigilatorId")
);

CREATE UNIQUE INDEX "AggregateExamSchedule_generationId_eventId_key" ON "AggregateExamSchedule"("generationId", "eventId");
CREATE INDEX "AggregateExamSchedule_timeSlotId_idx" ON "AggregateExamSchedule"("timeSlotId");
CREATE INDEX "AggregateExamSchedule_eventId_idx" ON "AggregateExamSchedule"("eventId");
CREATE INDEX "AggregateExamVenueAssignment_venueId_idx" ON "AggregateExamVenueAssignment"("venueId");
CREATE INDEX "AggregateInvigilationAssignment_invigilatorId_idx" ON "AggregateInvigilationAssignment"("invigilatorId");

ALTER TABLE "AggregateExamSchedule" ADD CONSTRAINT "AggregateExamSchedule_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "TimetableGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AggregateExamSchedule" ADD CONSTRAINT "AggregateExamSchedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ExamEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateExamSchedule" ADD CONSTRAINT "AggregateExamSchedule_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "ExamTimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateExamVenueAssignment" ADD CONSTRAINT "AggregateExamVenueAssignment_aggregateScheduleId_fkey" FOREIGN KEY ("aggregateScheduleId") REFERENCES "AggregateExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AggregateExamVenueAssignment" ADD CONSTRAINT "AggregateExamVenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateInvigilationAssignment" ADD CONSTRAINT "AggregateInvigilationAssignment_aggregateScheduleId_fkey" FOREIGN KEY ("aggregateScheduleId") REFERENCES "AggregateExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AggregateInvigilationAssignment" ADD CONSTRAINT "AggregateInvigilationAssignment_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "Invigilator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AggregateInvigilationAssignment" ADD CONSTRAINT "AggregateInvigilationAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
