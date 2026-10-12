import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPrisma } from '../../../../src/infrastructure/database/prisma';
import { PrismaAdditionRepository } from '../../../../src/modules/catalog/infrastructure/prismaAdditionRepository';
import { PrismaProductAdditionRepository } from '../../../../src/modules/catalog/infrastructure/prismaProductAdditionRepository';
import { PrismaProductRepository } from '../../../../src/modules/catalog/infrastructure/prismaProductRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function randomCode(prefix: string): string {
  return `${prefix}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

test(
    'la base impide mezclar buffets en productos y adicionales, y reemplaza adicionales de forma atómica',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const products = new PrismaProductRepository(prisma);
        const additions = new PrismaAdditionRepository(prisma);
        const productAdditions = new PrismaProductAdditionRepository(prisma);

        const organization = await prisma.organization.create({
        data: { name: 'Organización de prueba (test productos)' },
        });
        const storeA = await prisma.store.create({
        data: { organizationId: organization.id, name: 'Buffet A de prueba', code: randomCode('PRA') },
        });
        const storeB = await prisma.store.create({
        data: { organizationId: organization.id, name: 'Buffet B de prueba', code: randomCode('PRB') },
        });

        try {
        const categoryA = await prisma.category.create({ data: { storeId: storeA.id, name: 'Bebidas' } });
        const categoryB = await prisma.category.create({ data: { storeId: storeB.id, name: 'Bebidas' } });
        const additionA = await additions.create({ storeId: storeA.id, name: 'Leche de almendras', priceCents: 50000, isActive: true });
        const additionB = await additions.create({ storeId: storeB.id, name: 'Queso', priceCents: 30000, isActive: true });

        const productBase = {
            storeId: storeA.id,
            name: 'Café con leche',
            description: null,
            priceCents: 150000,
            basePreparationSeconds: 120,
            isActive: true,
        };

        // Un producto con una categoría de su buffet se guarda correctamente
        const product = await products.create({ ...productBase, categoryId: categoryA.id });
        assert.equal(product.priceCents, 150000);

        // La base rechaza un producto con una categoría de otro buffet
        await assert.rejects(products.create({ ...productBase, categoryId: categoryB.id }), {
            code: 'INVALID_CATEGORY_SCOPE',
        });

        // Configurar adicionales del mismo buffet funciona
        await productAdditions.replace(product.id, storeA.id, [additionA.id]);
        assert.deepEqual(await productAdditions.listAdditionIds(product.id), [additionA.id]);

        // Si un adicional es de otro buffet, la transacción se deshace y no cambia nada
        await assert.rejects(productAdditions.replace(product.id, storeA.id, [additionA.id, additionB.id]), {
            code: 'INVALID_ADDITION_SCOPE',
        });
        assert.deepEqual(await productAdditions.listAdditionIds(product.id), [additionA.id]);
        } finally {
        const storeIds = [storeA.id, storeB.id];

        await prisma.productAddition.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.addition.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
        await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
        await prisma.organization.delete({ where: { id: organization.id } });
        }
    },
);

after(async () => {
    if (hasDatabase) {
        await getPrisma().$disconnect();
    }
});