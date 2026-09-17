-- Relance avis produit post-livraison
ALTER TABLE "orders" ADD COLUMN "reviewReminderSentAt" TIMESTAMP(3);
ALTER TABLE "store_settings" ADD COLUMN "reviewReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
