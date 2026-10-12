-- CreateTable
CREATE TABLE "CustomerStoreMembership" (
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,

    CONSTRAINT "CustomerStoreMembership_pkey" PRIMARY KEY ("customerId","storeId")
);

-- AddForeignKey
ALTER TABLE "CustomerStoreMembership" ADD CONSTRAINT "CustomerStoreMembership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerStoreMembership" ADD CONSTRAINT "CustomerStoreMembership_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
