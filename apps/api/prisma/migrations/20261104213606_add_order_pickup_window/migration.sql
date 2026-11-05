-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "promisedFrom" TIMESTAMP(3),
ADD COLUMN     "promisedTo" TIMESTAMP(3),
ADD COLUMN     "scheduledForDate" TIMESTAMP(3),
ADD COLUMN     "toleranceUntil" TIMESTAMP(3);
