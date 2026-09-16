-- Sépare l'adresse unique de la commande en adresse de livraison
-- (Sendcloud) et adresse de facturation (facture PDF).

-- Orders: addressId -> shippingAddressId (rename, conserve les données et
-- l'usage existant pour Sendcloud), + nouvelle colonne billingAddressId
-- (backfillée avec l'adresse de livraison : "identique à la livraison" est
-- le cas par défaut pour toutes les commandes déjà passées).
ALTER TABLE "orders" DROP CONSTRAINT "orders_addressId_fkey";
ALTER TABLE "orders" RENAME COLUMN "addressId" TO "shippingAddressId";
ALTER TABLE "orders" ADD COLUMN "billingAddressId" TEXT;
UPDATE "orders" SET "billingAddressId" = "shippingAddressId";
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Transactions: nouvel instantané "billing_*" (facture), en miroir de
-- "address_*" (qui reste l'instantané d'expédition, utilisé par le bordereau
-- et l'étiquette Sendcloud). Backfill depuis "address_*" pour les
-- transactions déjà enregistrées (même hypothèse "identique à la livraison").
ALTER TABLE "transactions" ADD COLUMN "billing_first_name" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_last_name" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_phone" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_company" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_street_number" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_street" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_city" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_county" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_state" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_stateLetter" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_state_code" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_zip" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_country" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_country_code" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_ISO_3166_1_alpha_3" TEXT;
ALTER TABLE "transactions" ADD COLUMN "billing_type" "AddressType";

UPDATE "transactions" SET
  "billing_first_name" = "address_first_name",
  "billing_last_name" = "address_last_name",
  "billing_phone" = "address_phone",
  "billing_company" = "address_company",
  "billing_street_number" = "address_street_number",
  "billing_street" = "address_street",
  "billing_city" = "address_city",
  "billing_county" = "address_county",
  "billing_state" = "address_state",
  "billing_stateLetter" = "address_stateLetter",
  "billing_state_code" = "address_state_code",
  "billing_zip" = "address_zip",
  "billing_country" = "address_country",
  "billing_country_code" = "address_country_code",
  "billing_ISO_3166_1_alpha_3" = "address_ISO_3166_1_alpha_3",
  "billing_type" = "address_type";

ALTER TABLE "transactions"
  ALTER COLUMN "billing_first_name" SET NOT NULL,
  ALTER COLUMN "billing_last_name" SET NOT NULL,
  ALTER COLUMN "billing_phone" SET NOT NULL,
  ALTER COLUMN "billing_street_number" SET NOT NULL,
  ALTER COLUMN "billing_street" SET NOT NULL,
  ALTER COLUMN "billing_city" SET NOT NULL,
  ALTER COLUMN "billing_county" SET NOT NULL,
  ALTER COLUMN "billing_state" SET NOT NULL,
  ALTER COLUMN "billing_stateLetter" SET NOT NULL,
  ALTER COLUMN "billing_state_code" SET NOT NULL,
  ALTER COLUMN "billing_zip" SET NOT NULL,
  ALTER COLUMN "billing_country" SET NOT NULL,
  ALTER COLUMN "billing_country_code" SET NOT NULL,
  ALTER COLUMN "billing_ISO_3166_1_alpha_3" SET NOT NULL,
  ALTER COLUMN "billing_type" SET NOT NULL;
