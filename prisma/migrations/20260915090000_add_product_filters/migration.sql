-- AlterTable
ALTER TABLE "products" ADD COLUMN     "compareAtPrice" DOUBLE PRECISION,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "sku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_material_idx" ON "products"("material");
