import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaCustomerRepository } from '../../../../src/modules/customer/infrastructure/prismaCustomerRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'guarda y busca clientes por su usuario de Neon Auth en PostgreSQL',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const customers = new PrismaCustomerRepository(prisma);
        const authUserId = `test-${randomUUID()}`;

        try {
        const created = await customers.create({
            name: 'Cliente de prueba',
            email: `auth-${randomUUID()}@test.com`,
            authUserId,
        });

        const found = await customers.findByAuthUserId(authUserId);

        assert.equal(found?.id, created.id);
        assert.equal(await customers.findByAuthUserId(`test-${randomUUID()}`), null);
        } finally {
        await prisma.customer.deleteMany({ where: { authUserId } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});