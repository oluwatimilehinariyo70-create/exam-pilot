-- Phase F: additive exam-period calendar policy and flexible aggregate placements.
CREATE TYPE "AggregateSchedulingMode" AS ENUM ('FIXED_SESSIONS', 'FLEXIBLE_INTERVALS');
CREATE TYPE "ExamBlackoutType" AS ENUM ('PUBLIC_HOLIDAY', 'UNIVERSITY_EVENT', 'NO_EXAMS', 'OTHER');

ALTER TABLE "ExamPeriod"
  ADD COLUMN "defaultDayStartTime" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "defaultDayEndTime" TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN "defaultTurnaroundMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "writtenTurnaroundMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "cbtTurnaroundMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "timeGranularityMinutes" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "ExamCalendarDay" (
  "id" TEXT NOT NULL,
  "examPeriodId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "dayType" TEXT NOT NULL DEFAULT 'WEEKDAY',
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "turnaroundMinutesOverride" INTEGER,
  "blackoutType" "ExamBlackoutType",
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamCalendarDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExamCalendarDay_examPeriodId_date_key" ON "ExamCalendarDay"("examPeriodId", "date");
CREATE INDEX "ExamCalendarDay_examPeriodId_enabled_date_idx" ON "ExamCalendarDay"("examPeriodId", "enabled", "date");
ALTER TABLE "ExamCalendarDay" ADD CONSTRAINT "ExamCalendarDay_examPeriodId_fkey" FOREIGN KEY ("examPeriodId") REFERENCES "ExamPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AggregateExamSchedule" ALTER COLUMN "timeSlotId" DROP NOT NULL;
ALTER TABLE "AggregateExamSchedule"
  ADD COLUMN "date" TIMESTAMP(3),
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "schedulingMode" "AggregateSchedulingMode" NOT NULL DEFAULT 'FIXED_SESSIONS';
