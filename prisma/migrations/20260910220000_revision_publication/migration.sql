-- Additive revision snapshots; existing generations and schedules are preserved.
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED');
CREATE TABLE "TimetableRevision" (
  "id" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publicationKey" TEXT,
  "candidate" JSONB NOT NULL,
  "dataset" JSONB NOT NULL,
  "pinnedEventIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "publicSnapshot" JSONB,
  CONSTRAINT "TimetableRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimetableRevision_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "TimetableGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TimetableRevision_generationId_revisionNumber_key" ON "TimetableRevision"("generationId", "revisionNumber");
CREATE UNIQUE INDEX "TimetableRevision_publicationKey_key" ON "TimetableRevision"("publicationKey");
CREATE INDEX "TimetableRevision_status_publishedAt_idx" ON "TimetableRevision"("status", "publishedAt");
