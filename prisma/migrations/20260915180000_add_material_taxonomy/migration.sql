-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materials_name_key" ON "materials"("name");

-- Backfill: une ligne "materials" par valeur distincte déjà présente dans
-- l'ancienne colonne texte libre "products"."material".
INSERT INTO "materials" ("id", "name")
SELECT gen_random_uuid()::text, "material"
FROM (SELECT DISTINCT "material" FROM "products" WHERE "material" IS NOT NULL) AS distinct_materials;

-- AlterTable: nouvelle colonne de relation, ajoutée avant de supprimer
-- l'ancienne colonne texte pour pouvoir la reliers par nom.
ALTER TABLE "products" ADD COLUMN "materialId" TEXT;

UPDATE "products" p
SET "materialId" = m."id"
FROM "materials" m
WHERE p."material" = m."name";

-- DropIndex
DROP INDEX "products_material_idx";

-- AlterTable: l'ancienne colonne texte libre est remplacée par la relation.
ALTER TABLE "products" DROP COLUMN "material";

-- CreateIndex
CREATE INDEX "products_materialId_idx" ON "products"("materialId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
