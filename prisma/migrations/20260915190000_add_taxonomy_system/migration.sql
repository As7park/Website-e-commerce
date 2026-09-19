-- CreateEnum
CREATE TYPE "TaxonomyType" AS ENUM ('TEXT', 'COLOR', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateTable
CREATE TABLE "taxonomies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TaxonomyType" NOT NULL DEFAULT 'TEXT',
    "multiple" BOOLEAN NOT NULL DEFAULT true,
    "numberMin" DOUBLE PRECISION,
    "numberMax" DOUBLE PRECISION,
    "numberUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_values" (
    "id" TEXT NOT NULL,
    "taxonomyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "image" TEXT,
    "code" TEXT,
    "parentId" TEXT,

    CONSTRAINT "taxonomy_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_taxonomy_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "taxonomyValueId" TEXT NOT NULL,

    CONSTRAINT "product_taxonomy_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "taxonomies_name_key" ON "taxonomies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomies_slug_key" ON "taxonomies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_values_taxonomyId_value_key" ON "taxonomy_values"("taxonomyId", "value");

-- CreateIndex
CREATE INDEX "taxonomy_values_parentId_idx" ON "taxonomy_values"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "product_taxonomy_values_productId_taxonomyValueId_key" ON "product_taxonomy_values"("productId", "taxonomyValueId");

-- CreateIndex
CREATE INDEX "product_taxonomy_values_taxonomyValueId_idx" ON "product_taxonomy_values"("taxonomyValueId");

-- AddForeignKey
ALTER TABLE "taxonomy_values" ADD CONSTRAINT "taxonomy_values_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "taxonomies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_values" ADD CONSTRAINT "taxonomy_values_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "taxonomy_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_taxonomy_values" ADD CONSTRAINT "product_taxonomy_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_taxonomy_values" ADD CONSTRAINT "product_taxonomy_values_taxonomyValueId_fkey" FOREIGN KEY ("taxonomyValueId") REFERENCES "taxonomy_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : convertit les taxonomies historiques « Matière » (mono-valeur) et
-- « Catégorie » (multi-valeur) vers le système générique. Les anciennes tables
-- `materials`/`categories`/`product_categories` et la colonne
-- `products`.`materialId` ne sont volontairement PAS touchées ici — leur
-- retrait se fait dans une migration séparée, une fois la bascule applicative
-- vérifiée (voir docs/products/README.md).
INSERT INTO "taxonomies" ("id", "name", "slug", "type", "multiple")
VALUES
  (gen_random_uuid()::text, 'Matière', 'matiere', 'TEXT', false),
  (gen_random_uuid()::text, 'Catégorie', 'categorie', 'TEXT', true);

-- Backfill: valeurs « Matière » depuis "materials".
INSERT INTO "taxonomy_values" ("id", "taxonomyId", "value")
SELECT gen_random_uuid()::text, (SELECT "id" FROM "taxonomies" WHERE "slug" = 'matiere'), m."name"
FROM "materials" m;

-- Backfill: valeurs « Catégorie » depuis "categories".
INSERT INTO "taxonomy_values" ("id", "taxonomyId", "value")
SELECT gen_random_uuid()::text, (SELECT "id" FROM "taxonomies" WHERE "slug" = 'categorie'), c."name"
FROM "categories" c;

-- Backfill: assignations « Matière » depuis "products"."materialId".
INSERT INTO "product_taxonomy_values" ("id", "productId", "taxonomyValueId")
SELECT gen_random_uuid()::text, p."id", tv."id"
FROM "products" p
JOIN "materials" m ON m."id" = p."materialId"
JOIN "taxonomy_values" tv ON tv."taxonomyId" = (SELECT "id" FROM "taxonomies" WHERE "slug" = 'matiere') AND tv."value" = m."name";

-- Backfill: assignations « Catégorie » depuis "product_categories".
INSERT INTO "product_taxonomy_values" ("id", "productId", "taxonomyValueId")
SELECT gen_random_uuid()::text, pc."productId", tv."id"
FROM "product_categories" pc
JOIN "categories" c ON c."id" = pc."categoryId"
JOIN "taxonomy_values" tv ON tv."taxonomyId" = (SELECT "id" FROM "taxonomies" WHERE "slug" = 'categorie') AND tv."value" = c."name";
