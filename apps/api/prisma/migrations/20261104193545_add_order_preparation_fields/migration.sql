-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "preparedByUserId" TEXT;
