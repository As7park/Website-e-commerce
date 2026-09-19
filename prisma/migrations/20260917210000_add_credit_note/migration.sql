-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN "creditNoteNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_creditNoteNumber_key" ON "return_requests"("creditNoteNumber");

-- CreateTable
CREATE TABLE "credit_note_counters" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "credit_note_counters_pkey" PRIMARY KEY ("year")
);
