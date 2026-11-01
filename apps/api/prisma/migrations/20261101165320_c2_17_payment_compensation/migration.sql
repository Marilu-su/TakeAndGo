-- CreateEnum
CREATE TYPE "PaymentCompensationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PaymentCompensation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "PaymentCompensationStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCompensation_paymentId_key" ON "PaymentCompensation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCompensation_providerRefundId_key" ON "PaymentCompensation"("providerRefundId");

-- CreateIndex
CREATE INDEX "PaymentCompensation_status_idx" ON "PaymentCompensation"("status");

-- AddForeignKey
ALTER TABLE "PaymentCompensation" ADD CONSTRAINT "PaymentCompensation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
