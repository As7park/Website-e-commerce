-- Store credit indépendant du remboursement Stripe sur les retours.
ALTER TYPE "ReturnStatus" ADD VALUE IF NOT EXISTS 'CREDITED';

ALTER TABLE "return_requests" ADD COLUMN "giftCardId" TEXT;
