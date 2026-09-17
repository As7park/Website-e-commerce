-- Bundle "Souvent achetés ensemble" : uniquement un interrupteur, pas de
-- nouvelle table (co-occurrence calculée à la volée depuis "order_items").
ALTER TABLE "store_settings" ADD COLUMN "frequentlyBoughtTogetherEnabled" BOOLEAN NOT NULL DEFAULT false;
