-- CreateTable
CREATE TABLE "accounting_export_logs" (
    "period" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionCount" INTEGER NOT NULL,

    CONSTRAINT "accounting_export_logs_pkey" PRIMARY KEY ("period")
);
