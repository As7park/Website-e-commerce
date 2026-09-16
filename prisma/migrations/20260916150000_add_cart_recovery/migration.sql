-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cartReminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "cartReminder2SentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "cartRecoveryEnabled" BOOLEAN NOT NULL DEFAULT false;
