import 'dotenv/config';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { PrismaStockRepository } from '../../../src/modules/stock/infrastructure/prismaStockRepository';

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
    'la revisión semanal descuenta lo reservado y es todo o nada',
    { skip: hasDatabase ? false : 'Requiere DATABASE_URL' },
    async () => {
        const prisma = getPrisma();
        const stock = new PrismaStockRepository();

        const organization = await prisma.organization.create({ data: { name: 'Organización de prueba (test revisión)' } });
        const store = await prisma.store.create({
        data: { organizationId: organization.id, name: 'Buffet de prueba', code: `RVW${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}` },
        });

        try {
        const category = await prisma.category.create({ data: { storeId: store.id, name: 'Bebidas' } });
        const coffee = await prisma.product.create({
            data: { storeId: store.id, categoryId: category.id, name: 'Café', priceCents: 100000, basePreparationSeconds: 60 },
        });
        const tea = await prisma.product.create({
            data: { storeId: store.id, categoryId: category.id, name: 'Té', priceCents: 80000, basePreparationSeconds: 30 },
        });

        // Café: 10 disponibles y 2 reservados por pedidos. Té: 6 disponibles y 3 reservados.
        await prisma.productStock.create({ data: { storeId: store.id, productId: coffee.id, availableStock: 10, reservedStock: 2 } });
        await prisma.productStock.create({ data: { storeId: store.id, productId: tea.id, availableStock: 6, reservedStock: 3 } });

        // Se cuentan 7 cafés y solo 1 té: el té tiene menos que lo reservado, así que no se guarda nada
        await assert.rejects(
            stock.recordWeeklyReview(store.id, [{ productId: coffee.id, countedStock: 7 }, { productId: tea.id, countedStock: 1 }], 'admin-1'),
            { code: 'STOCK_BELOW_RESERVED' },
        );
        assert.equal((await stock.getProductStock(store.id, coffee.id))?.availableStock, 10);
        assert.equal(await stock.findLastWeeklyReviewAt(store.id), null);

        // Revisión válida: 7 cafés contados, 2 reservados → 5 disponibles
        const reviewId = await stock.recordWeeklyReview(
            store.id,
            [{ productId: coffee.id, countedStock: 7 }, { productId: tea.id, countedStock: 9 }],
            'admin-1',
        );

        assert.equal((await stock.getProductStock(store.id, coffee.id))?.availableStock, 5);
        assert.equal((await stock.getProductStock(store.id, tea.id))?.availableStock, 6);

        const movements = await prisma.stockMovement.findMany({ where: { referenceId: reviewId } });
        assert.equal(movements.length, 2);
        assert.ok(movements.every((m) => m.type === 'WEEKLY_REVIEW' && m.actorUserId === 'admin-1'));
        assert.deepEqual(movements.map((m) => m.quantity).sort(), [-5, 0]);
        assert.ok(await stock.findLastWeeklyReviewAt(store.id));
        } finally {
        await prisma.stockMovement.deleteMany({ where: { storeId: store.id } });
        await prisma.productStock.deleteMany({ where: { storeId: store.id } });
        await prisma.product.deleteMany({ where: { storeId: store.id } });
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