-- Le `type` (SHIPPING/BILLING) d'une adresse du carnet n'était qu'un
-- libellé jamais lu par la logique métier ; devenu redondant depuis la
-- séparation shipping/billing au niveau Order (choix fait par commande, pas
-- par adresse). Supprimé partout, avec l'enum qui ne sert plus qu'à ça.
ALTER TABLE "addresses" DROP COLUMN "type";
ALTER TABLE "transactions" DROP COLUMN "address_type";
ALTER TABLE "transactions" DROP COLUMN "billing_type";
DROP TYPE "AddressType";
