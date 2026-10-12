import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import {
    createPrismaAssociateCustomerToStore,
    createPrismaCreateCustomer,
    createPrismaListCustomerStores,
} from '../../../../src/modules/customer/infrastructure/customerModule';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function randomStoreCode(): string {
    const letters = Array.from(
        { length: 3 },
        () => String.fromCharCode(65 + randomInt(0, 26)),
    ).join('');

    const numbers = String(randomInt(0, 1000)).padStart(3, '0');

    return `${letters}${numbers}`;
}

test(
    'flujo integrado: crea un customer, lo asocia por código y consulta su buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();

        const organization = await prisma.organization.create({
            data: {
                name: `Organización C2-05 ${randomUUID()}`,
            },
        });

        const storeCode = randomStoreCode();

        const store = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet integración C2-05',
                code: storeCode,
            },
        });

        let customerId: string | undefined;

        try {
            const createCustomer = createPrismaCreateCustomer();

            const customer = await createCustomer({
                name: 'Customer integración',
                email: `c2-05-${randomUUID()}@test.com`,
            });

            customerId = customer.id;

            const associateCustomerToStore =
                createPrismaAssociateCustomerToStore();

            const membership = await associateCustomerToStore({
                customerId: customer.id,
                storeCode,
            });

            assert.equal(membership.customerId, customer.id);
            assert.equal(membership.storeId, store.id);

            const listCustomerStores = createPrismaListCustomerStores();

            const stores = await listCustomerStores(customer.id);

            assert.equal(stores.length, 1);
            assert.equal(stores[0]?.id, store.id);
            assert.equal(stores[0]?.code, storeCode);
            assert.equal(stores[0]?.name, store.name);
        } finally {
            if (customerId) {
                await prisma.customerStoreMembership.deleteMany({
                    where: { customerId },
                });

                await prisma.customer.deleteMany({
                    where: { id: customerId },
                });
            }

            await prisma.store.deleteMany({
                where: { id: store.id },
            });

            await prisma.organization.deleteMany({
                where: { id: organization.id },
            });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});