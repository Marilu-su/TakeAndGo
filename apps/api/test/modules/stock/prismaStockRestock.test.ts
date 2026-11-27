import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { PrismaStockRepository } from '../../../src/modules/stock/infrastructure/prismaStockRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

function randomCode(prefix: string): string {
  return `${prefix}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

test(
    'reposición y ajuste de stock: suman o fijan, registran el movimiento y respetan el buffet',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const stock = new PrismaStockRepository();

        const organization = await prisma.organization.create({ data: { name: 'Organización de prueba (test stock)' } });
        const storeA = await prisma.store.create({ data: { organizationId: organization.id, name: 'Buffet A', code: randomCode('STA') } });
        const storeB = await prisma.store.create({ data: { organizationId: organization.id, name: 'Buffet B', code: randomCode('STB') } });

        try {
        const category = await prisma.category.create({ data: { storeId: storeA.id, name: 'Bebidas' } });
        const product = await prisma.product.create({
            data: { storeId: storeA.id, categoryId: category.id, name: 'Café', priceCents: 100000, basePreparationSeconds: 60 },
        });

        // Reponer sin stock previo crea el registro
        const first = await stock.restockProduct(storeA.id, product.id, 10, 'Llegada de proveedor', 'admin-1');
        assert.equal(first.availableStock, 10);

        // Reponer de nuevo suma
        const second = await stock.restockProduct(storeA.id, product.id, 5, 'Segunda entrega', 'admin-1');
        assert.equal(second.availableStock, 15);

        // Reposiciones simultáneas se suman las dos
        await Promise.all([
            stock.restockProduct(storeA.id, product.id, 3, 'Simultánea 1', 'admin-1'),
            stock.restockProduct(storeA.id, product.id, 4, 'Simultánea 2', 'admin-2'),
        ]);
        assert.equal((await stock.getProductStock(storeA.id, product.id))?.availableStock, 22);

        // Un ajuste fija el valor y registra la diferencia
        const adjusted = await stock.setProductStock(storeA.id, product.id, 20, 'Conteo manual', 'admin-1');
        assert.equal(adjusted.availableStock, 20);

        const movements = await prisma.stockMovement.findMany({
            where: { productId: product.id },
            orderBy: { createdAt: 'asc' },
        });
        assert.deepEqual(
            movements.map((m) => [m.type, m.quantity]).sort(),
            [
            ['INVENTORY_ADJUSTMENT', -2],
            ['RESTOCK', 10],
            ['RESTOCK', 3],
            ['RESTOCK', 4],
            ['RESTOCK', 5],
            ].sort(),
        );
        assert.ok(movements.every((m) => m.actorUserId && m.reason));

        // Otro buffet no puede reponer ni ajustar este producto
        await assert.rejects(stock.restockProduct(storeB.id, product.id, 1, 'Ajeno', 'admin-b'), { code: 'PRODUCT_NOT_FOUND' });
        await assert.rejects(stock.setProductStock(storeB.id, product.id, 0, 'Ajeno', 'admin-b'), { code: 'PRODUCT_NOT_FOUND' });
        } finally {
        await prisma.stockMovement.deleteMany({ where: { storeId: { in: [storeA.id, storeB.id] } } });
        await prisma.productStock.deleteMany({ where: { storeId: { in: [storeA.id, storeB.id] } } });
        await prisma.product.deleteMany({ where: { storeId: storeA.id } });
        await prisma.category.deleteMany({ where: { storeId: storeA.id } });
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