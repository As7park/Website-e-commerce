-- Parrainage : lien unique par compte, recompense au parrain via le module
-- Gift Cards. Voir prisma/schema.prisma (User.referralCode/referredById,
-- ReferralReward) et $lib/server/storeSettings.ts (referralEnabled).

-- StoreSettings : interrupteur du module.
ALTER TABLE "store_settings" ADD COLUMN "referralEnabled" BOOLEAN NOT NULL DEFAULT false;

-- User : code de parrainage unique + parrain eventuel.
ALTER TABLE "users" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "users" ADD COLUMN "referredById" TEXT;

-- Backfill des comptes existants : code lisible derive de l'id, les nouveaux
-- comptes utiliseront le generateur applicatif (`generateUniqueReferralCode`).
UPDATE "users" SET "referralCode" = upper(substr(md5(random()::text || "id"), 1, 8)) WHERE "referralCode" IS NULL;

ALTER TABLE "users" ALTER COLUMN "referralCode" SET NOT NULL;
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReferralReward : une seule recompense par filleul.
CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_rewards_referredId_key" ON "referral_rewards"("referredId");
CREATE INDEX "referral_rewards_referrerId_idx" ON "referral_rewards"("referrerId");

ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
