import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaCustomerRepository } from '../../../../src/modules/customer/infrastructure/prismaCustomerRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'crea y recupera un customer desde PostgreSQL',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const customers = new PrismaCustomerRepository(prisma);

        const email = `customer-${randomUUID()}@test.com`;

        const created = await customers.create({
            name: 'Customer de prueba',
            email,
        });

        try {
            const found = await customers.findById(created.id);

            assert.ok(found);
            assert.equal(found.id, created.id);
            assert.equal(found.name, 'Customer de prueba');
            assert.equal(found.email, email);
        } finally {
            await prisma.customer.delete({
                where: { id: created.id },
            });
        }
    },
);

test(
    'la base rechaza emails de customer duplicados',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const customers = new PrismaCustomerRepository(prisma);

        const email = `customer-${randomUUID()}@test.com`;

        try {
            await customers.create({
                name: 'Customer uno',
                email,
            });

            await assert.rejects(
                customers.create({
                    name: 'Customer dos',
                    email,
                }),
                { code: 'CUSTOMER_EMAIL_ALREADY_EXISTS' },
            );
        } finally {
            await prisma.customer.deleteMany({
                where: { email },
            });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});