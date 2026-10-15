-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ORGANIZATION_ADMIN', 'STORE_ADMIN', 'STORE_EMPLOYEE');

-- CreateTable
CREATE TABLE "StaffScope" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffScope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffScope_authUserId_key" ON "StaffScope"("authUserId");

-- CreateIndex
CREATE INDEX "StaffScope_organizationId_idx" ON "StaffScope"("organizationId");

-- CreateIndex
CREATE INDEX "StaffScope_storeId_idx" ON "StaffScope"("storeId");

-- AddForeignKey
ALTER TABLE "StaffScope" ADD CONSTRAINT "StaffScope_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffScope" ADD CONSTRAINT "StaffScope_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
