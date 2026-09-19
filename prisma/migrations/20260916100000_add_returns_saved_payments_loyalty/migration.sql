-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED');

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "loyaltyThreshold" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "loyalty_awards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "orderCountAtAward" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "stripeRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_awards_userId_promoCodeId_key" ON "loyalty_awards"("userId", "promoCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_payment_methods_stripePaymentMethodId_key" ON "saved_payment_methods"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "saved_payment_methods_userId_idx" ON "saved_payment_methods"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_transactionId_key" ON "return_requests"("transactionId");

-- CreateIndex
CREATE INDEX "return_requests_userId_idx" ON "return_requests"("userId");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "loyalty_awards" ADD CONSTRAINT "loyalty_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_awards" ADD CONSTRAINT "loyalty_awards_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
