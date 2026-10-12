import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { createPrismaGetStoreConfiguration } from '../../../../src/modules/organization/infrastructure/organizationModule';
import { OrganizationStoreScope } from '../../../../src/modules/catalog/infrastructure/organizationStoreScope';
import { PrismaCategoryRepository } from '../../../../src/modules/catalog/infrastructure/prismaCategoryRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'guarda, modifica y lista categorías en PostgreSQL',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const categories = new PrismaCategoryRepository(prisma);
        const storeScope = new OrganizationStoreScope(createPrismaGetStoreConfiguration());

        const organization = await prisma.organization.create({
        data: { name: 'Organización de prueba (test categorías)' },
        });

        const store = await prisma.store.create({
        data: {
            organizationId: organization.id,
            name: 'Buffet de prueba',
            code: `CAT${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        },
        });

        try {
        assert.equal(await storeScope.storeExists(store.id), true);
        assert.equal(await storeScope.storeExists(randomUUID()), false);

        const created = await categories.create({ storeId: store.id, name: 'Bebidas', isActive: true });
        const updated = await categories.update({ ...created, name: 'Bebidas frías', isActive: false });

        assert.equal(updated.name, 'Bebidas frías');
        assert.equal(updated.isActive, false);

        const listed = await categories.listByStore(store.id);

        assert.equal(listed.length, 1);
        assert.equal(listed[0].id, created.id);
        assert.equal(listed[0].isActive, false);
        } finally {
        await prisma.category.deleteMany({ where: { storeId: store.id } });
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