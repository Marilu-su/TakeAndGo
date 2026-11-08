-- CreateEnum
CREATE TYPE "PickupMethod" AS ENUM ('QR', 'MANUAL');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "pickedUpByUserId" TEXT,
ADD COLUMN     "pickupMethod" "PickupMethod";

-- CreateTable
CREATE TABLE "PickupToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupToken_tokenHash_key" ON "PickupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PickupToken_orderId_storeId_idx" ON "PickupToken"("orderId", "storeId");

-- AddForeignKey
ALTER TABLE "PickupToken" ADD CONSTRAINT "PickupToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
