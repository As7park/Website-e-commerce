-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "productQnaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_questions_productId_idx" ON "product_questions"("productId");

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
