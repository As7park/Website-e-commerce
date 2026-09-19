-- Poids/dimensions unitaires réels du produit, pour calculer un colis
-- Sendcloud adapté au lieu d'un poids par défaut fixe partagé par tout le
-- catalogue. `NULL` = pas encore renseigné par l'admin :
-- `$lib/commerce/packageEstimate.ts` retombe alors sur une estimation par
-- défaut (bijou standard) pour ne rien casser tant que le catalogue n'est
-- pas rempli.
ALTER TABLE "products" ADD COLUMN "weight" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "length" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "width" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "height" DOUBLE PRECISION;
