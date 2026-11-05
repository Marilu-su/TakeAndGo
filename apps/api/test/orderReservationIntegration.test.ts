import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/infrastructure/database/prisma';
import { placeReservedOrder, cancelReservedOrder } from '../src/modules/order/infrastructure/prismaOrderReservation';
import { createPrismaStoreCatalogUseCases } from '../src/modules/catalog/infrastructure/catalogModule';

test('reservas PostgreSQL: concurrencia, rollback y cancelación idempotente', { skip: !process.env.DATABASE_URL }, async () => {
  const prisma = getPrisma();
  const org = await prisma.organization.create({ data: { name: 'Prueba C2 reservas' } });
  const store = await prisma.store.create({ data: { organizationId: org.id, name: 'Prueba reservas', code: randomUUID(), status: 'ACTIVE' } });
  const customer = await prisma.customer.create({ data: { name: 'Prueba', email: `${randomUUID()}@example.test` } });
  try {
    const category = await prisma.category.create({ data: { storeId: store.id, name: 'Prueba' } });
    const product = await prisma.product.create({ data: { storeId: store.id, categoryId: category.id, name: 'Producto', priceCents: 100, basePreparationSeconds: 0 } });
    await prisma.productStock.create({ data: { storeId: store.id, productId: product.id, availableStock: 1 } });
    const input = { storeId: store.id, customerId: customer.id, totalCents: 100, reservedUntil: new Date(Date.now() + 900000), items: [{ productId: product.id, productNameSnapshot: 'Producto', unitPriceCentsSnapshot: 100, quantity: 1, subtotalCents: 100 }] };
    const stockItems = [{ productId: product.id, quantity: 1 }];
    const results = await Promise.allSettled([placeReservedOrder(input, stockItems), placeReservedOrder(input, stockItems)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await prisma.order.count({ where: { storeId: store.id } }), 1, 'no persiste el pedido cuya reserva falló');
    let stock = await prisma.productStock.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(stock.availableStock, 0); assert.equal(stock.reservedStock, 1);
    assert.equal((await createPrismaStoreCatalogUseCases().getStoreCatalog(store.id)).categories.length, 0, 'catálogo oculta producto agotado');
    const successful = results.find(r => r.status === 'fulfilled');
    assert.ok(successful?.status === 'fulfilled');
    const id = successful.value.id;
    const cancellations = await Promise.allSettled([cancelReservedOrder(id), cancelReservedOrder(id)]);
    assert.ok(cancellations.some(r => r.status === 'fulfilled'));
    await cancelReservedOrder(id);
    stock = await prisma.productStock.findUniqueOrThrow({ where: { productId: product.id } });
    assert.equal(stock.availableStock, 1); assert.equal(stock.reservedStock, 0);
    assert.equal((await createPrismaStoreCatalogUseCases().getStoreCatalog(store.id)).categories[0].products[0].id, product.id);
    assert.equal(await prisma.stockMovement.count({ where: { storeId: store.id, type: 'ORDER_CANCELLED' } }), 1);
  } finally {
    await prisma.stockMovement.deleteMany({ where: { storeId: store.id } });
    await prisma.order.deleteMany({ where: { storeId: store.id } });
    await prisma.productStock.deleteMany({ where: { storeId: store.id } });
    await prisma.product.deleteMany({ where: { storeId: store.id } });
    await prisma.category.deleteMany({ where: { storeId: store.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
});
after(async () => { if (process.env.DATABASE_URL) await getPrisma().$disconnect(); });
