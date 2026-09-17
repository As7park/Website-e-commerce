-- Rattachement litige Stripe (charge.dispute.created/.closed) à Transaction
ALTER TABLE "transactions" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "disputeId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "disputeStatus" TEXT;
ALTER TABLE "transactions" ADD COLUMN "disputeReason" TEXT;
ALTER TABLE "transactions" ADD COLUMN "disputeAmount" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN "disputeOpenedAt" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "disputeClosedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "transactions_stripePaymentIntentId_key" ON "transactions"("stripePaymentIntentId");
CREATE UNIQUE INDEX "transactions_disputeId_key" ON "transactions"("disputeId");
