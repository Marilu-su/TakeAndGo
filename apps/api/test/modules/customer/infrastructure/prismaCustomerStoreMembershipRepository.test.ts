import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaCustomerStoreMembershipRepository } from '../../../../src/modules/customer/infrastructure/prismaCustomerStoreMembershipRepository';

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
    'crea una asociación entre customer y buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const memberships = new PrismaCustomerStoreMembershipRepository(prisma);

        const organization = await prisma.organization.create({
            data: { name: 'Organización membership test' },
        });

        const store = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet membership test',
                code: randomStoreCode(),
            },
        });

        const customer = await prisma.customer.create({
            data: {
                name: 'Customer membership test',
                email: `membership-${randomUUID()}@test.com`,
            },
        });

        try {
            const membership = await memberships.create({
                customerId: customer.id,
                storeId: store.id,
            });

            assert.equal(membership.customerId, customer.id);
            assert.equal(membership.storeId, store.id);
        } finally {
            await prisma.customerStoreMembership.deleteMany({
                where: { customerId: customer.id },
            });

            await prisma.customer.delete({
                where: { id: customer.id },
            });

            await prisma.store.delete({
                where: { id: store.id },
            });

            await prisma.organization.delete({
                where: { id: organization.id },
            });
        }
    },
);

test(
    'lista los buffets asociados a un customer',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const memberships = new PrismaCustomerStoreMembershipRepository(prisma);

        const organization = await prisma.organization.create({
            data: { name: 'Organización múltiples buffets test' },
        });

        const storeOne = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet uno',
                code: randomStoreCode(),
            },
        });

        const storeTwo = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet dos',
                code: randomStoreCode(),
            },
        });

        const customer = await prisma.customer.create({
            data: {
                name: 'Customer múltiples buffets',
                email: `membership-${randomUUID()}@test.com`,
            },
        });

        try {
            await memberships.create({
                customerId: customer.id,
                storeId: storeOne.id,
            });

            await memberships.create({
                customerId: customer.id,
                storeId: storeTwo.id,
            });

            const found = await memberships.findByCustomerId(customer.id);

            assert.equal(found.length, 2);
            assert.ok(found.some((membership) => membership.storeId === storeOne.id));
            assert.ok(found.some((membership) => membership.storeId === storeTwo.id));
        } finally {
            await prisma.customerStoreMembership.deleteMany({
                where: { customerId: customer.id },
            });

            await prisma.customer.delete({
                where: { id: customer.id },
            });

            await prisma.store.deleteMany({
                where: { organizationId: organization.id },
            });

            await prisma.organization.delete({
                where: { id: organization.id },
            });
        }
    },
);

test(
    'rechaza una asociación Customer-Buffet duplicada',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const memberships = new PrismaCustomerStoreMembershipRepository(prisma);

        const organization = await prisma.organization.create({
            data: { name: 'Organización duplicado membership test' },
        });

        const store = await prisma.store.create({
            data: {
                organizationId: organization.id,
                name: 'Buffet duplicado membership test',
                code: randomStoreCode(),
            },
        });

        const customer = await prisma.customer.create({
            data: {
                name: 'Customer duplicado membership test',
                email: `membership-${randomUUID()}@test.com`,
            },
        });

        try {
            await memberships.create({
                customerId: customer.id,
                storeId: store.id,
            });

            await assert.rejects(
                memberships.create({
                    customerId: customer.id,
                    storeId: store.id,
                }),
                { code: 'CUSTOMER_ALREADY_ASSOCIATED_TO_STORE' },
            );
        } finally {
            await prisma.customerStoreMembership.deleteMany({
                where: { customerId: customer.id },
            });

            await prisma.customer.delete({
                where: { id: customer.id },
            });

            await prisma.store.delete({
                where: { id: store.id },
            });

            await prisma.organization.delete({
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