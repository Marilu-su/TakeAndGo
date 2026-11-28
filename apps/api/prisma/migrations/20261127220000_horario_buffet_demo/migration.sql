CREATE TABLE "StorePickupSchedule" (
    "storeId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "opensAtMinute" INTEGER NOT NULL,
    "digitalClosesAtMinute" INTEGER NOT NULL,
    "operationalClosesAtMinute" INTEGER NOT NULL,

    CONSTRAINT "StorePickupSchedule_pkey" PRIMARY KEY ("storeId"),
    CONSTRAINT "StorePickupSchedule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StorePickupSchedule_valid_hours" CHECK (
        "opensAtMinute" >= 0
        AND "opensAtMinute" <= "digitalClosesAtMinute"
        AND "digitalClosesAtMinute" <= "operationalClosesAtMinute"
        AND "operationalClosesAtMinute" < 1440
    )
);

INSERT INTO "StorePickupSchedule" ("storeId", "timeZone", "opensAtMinute", "digitalClosesAtMinute", "operationalClosesAtMinute")
SELECT "id", 'America/Argentina/Buenos_Aires', 480, 1290, 1320
FROM "Store"
WHERE "code" = 'SIS001';
