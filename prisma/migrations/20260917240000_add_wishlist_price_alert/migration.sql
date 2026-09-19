-- Alerte wishlist (baisse de prix / vente flash)
ALTER TABLE "wishlist_items" ADD COLUMN "lastNotifiedPrice" DOUBLE PRECISION;
ALTER TABLE "wishlist_items" ADD COLUMN "lastNotifiedFlashSaleEndsAt" TIMESTAMP(3);
ALTER TABLE "store_settings" ADD COLUMN "wishlistPriceAlertEnabled" BOOLEAN NOT NULL DEFAULT false;
