import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaStaffScopeRepository } from '../../../../src/modules/organization/infrastructure/prismaStaffScopeRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'guarda y reemplaza el rol de staff de un usuario en PostgreSQL',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const staffScopes = new PrismaStaffScopeRepository(prisma);
        const authUserId = `test-${randomUUID()}`;

        const organization = await prisma.organization.create({ data: { name: 'Organización de prueba (test staff)' } });
        const store = await prisma.store.create({
        data: {
            organizationId: organization.id,
            name: 'Buffet de prueba',
            code: `STF${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        },
        });

        try {
        await staffScopes.save({ authUserId, role: 'STORE_ADMIN', organizationId: organization.id, storeId: store.id });
        await staffScopes.save({ authUserId, role: 'ORGANIZATION_ADMIN', organizationId: organization.id, storeId: null });

        const found = await staffScopes.findByAuthUserId(authUserId);

        assert.equal(found?.role, 'ORGANIZATION_ADMIN');
        assert.equal(found?.storeId, null);
        assert.equal(await prisma.staffScope.count({ where: { authUserId } }), 1);
        } finally {
        await prisma.staffScope.deleteMany({ where: { authUserId } });
        await prisma.store.delete({ where: { id: store.id } });
        await prisma.organization.delete({ where: { id: organization.id } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});