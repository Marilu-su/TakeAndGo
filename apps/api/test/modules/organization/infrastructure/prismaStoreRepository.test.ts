import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaStoreRepository } from '../../../../src/modules/organization/infrastructure/prismaStoreRepository';
import type { StoreCode } from '../../../../src/modules/organization/domain/storeCode';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'la base rechaza códigos de buffet duplicados',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const stores = new PrismaStoreRepository(prisma);

        const organization = await prisma.organization.create({
        data: { name: 'Organización de prueba (test)' },
        });

        const code = `TST${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}` as StoreCode;

        try {
        await stores.create({
            organizationId: organization.id,
            name: 'Buffet de prueba',
            code,
            status: 'PENDING_SETUP',
        });

        await assert.rejects(
            stores.create({
            organizationId: organization.id,
            name: 'Otro buffet de prueba',
            code,
            status: 'PENDING_SETUP',
            }),
            { code: 'STORE_CODE_ALREADY_EXISTS' },
        );
        } finally {
        await prisma.store.deleteMany({ where: { organizationId: organization.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});