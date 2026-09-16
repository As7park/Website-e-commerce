-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "shippingStatusCode" INTEGER,
ADD COLUMN     "shippingStatusMessage" TEXT,
ADD COLUMN     "shippingStatusUpdatedAt" TIMESTAMP(3);
