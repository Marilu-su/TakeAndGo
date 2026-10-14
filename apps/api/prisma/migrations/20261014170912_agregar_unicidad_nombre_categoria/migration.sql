/*
  Warnings:

  - A unique constraint covering the columns `[storeId,activeNameKey]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "activeNameKey" TEXT;

-- Completar la clave de las categorías activas existentes
UPDATE "Category"
SET "activeNameKey" = lower(btrim("name"))
WHERE "isActive" = true;

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_activeNameKey_key" ON "Category"("storeId", "activeNameKey");
