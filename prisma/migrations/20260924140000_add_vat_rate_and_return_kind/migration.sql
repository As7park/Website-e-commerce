-- CreateEnum
CREATE TYPE "ReturnKind" AS ENUM ('WITHDRAWAL', 'WARRANTY');

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "kind" "ReturnKind" NOT NULL DEFAULT 'WARRANTY';

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.055;
