import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaCategoryRepository } from '../../../../src/modules/catalog/infrastructure/prismaCategoryRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function randomCode(prefix: string): string {
    return `${prefix}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

test(
    'la base impide nombres de categoría activos duplicados en un buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const categories = new PrismaCategoryRepository(prisma);

        const organization = await prisma.organization.create({
        data: { name: 'Organización de prueba (test nombres de categoría)' },
        });
        const storeA = await prisma.store.create({
        data: { organizationId: organization.id, name: 'Buffet A', code: randomCode('UNA') },
        });
        const storeB = await prisma.store.create({
        data: { organizationId: organization.id, name: 'Buffet B', code: randomCode('UNB') },
        });

        try {
        const drinks = await categories.create({ storeId: storeA.id, name: 'Bebidas', isActive: true });

        // Mismo nombre normalizado en el mismo buffet: la base lo rechaza
        await assert.rejects(categories.create({ storeId: storeA.id, name: '  BEBIDAS ', isActive: true }), {
            code: 'CATEGORY_NAME_ALREADY_EXISTS',
        });

        // Otro buffet puede usar el mismo nombre
        await assert.doesNotReject(categories.create({ storeId: storeB.id, name: 'Bebidas', isActive: true }));

        // Desactivar libera el nombre
        await categories.update({ ...drinks, isActive: false });
        const renewed = await categories.create({ storeId: storeA.id, name: 'Bebidas', isActive: true });

        assert.notEqual(renewed.id, drinks.id);
        } finally {
        await prisma.category.deleteMany({ where: { storeId: { in: [storeA.id, storeB.id] } } });
        await prisma.store.deleteMany({ where: { id: { in: [storeA.id, storeB.id] } } });
        await prisma.organization.delete({ where: { id: organization.id } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});