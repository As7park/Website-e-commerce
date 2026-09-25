-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskScore" INTEGER;

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "fraudBlockingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fraudDetectionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskScore" INTEGER;

-- CreateTable
CREATE TABLE "fraud_blocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskFactors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fraud_blocks_createdAt_idx" ON "fraud_blocks"("createdAt");
