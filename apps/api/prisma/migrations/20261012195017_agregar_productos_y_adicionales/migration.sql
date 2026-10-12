/*
  Warnings:

  - A unique constraint covering the columns `[id,storeId]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "basePreparationSeconds" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addition" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAddition" (
    "productId" TEXT NOT NULL,
    "additionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "ProductAddition_pkey" PRIMARY KEY ("productId","additionId")
);

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_storeId_key" ON "Product"("id", "storeId");

-- CreateIndex
CREATE INDEX "Addition_storeId_idx" ON "Addition"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Addition_id_storeId_key" ON "Addition"("id", "storeId");

-- CreateIndex
CREATE INDEX "ProductAddition_additionId_storeId_idx" ON "ProductAddition"("additionId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_storeId_key" ON "Category"("id", "storeId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_storeId_fkey" FOREIGN KEY ("categoryId", "storeId") REFERENCES "Category"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addition" ADD CONSTRAINT "Addition_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddition" ADD CONSTRAINT "ProductAddition_productId_storeId_fkey" FOREIGN KEY ("productId", "storeId") REFERENCES "Product"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddition" ADD CONSTRAINT "ProductAddition_additionId_storeId_fkey" FOREIGN KEY ("additionId", "storeId") REFERENCES "Addition"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;
