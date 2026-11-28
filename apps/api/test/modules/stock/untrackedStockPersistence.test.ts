import 'dotenv/config';

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { PrismaPaymentOrderStockAdapter } from '../../../src/modules/payment/infrastructure/prismaPaymentOrderStockAdapter';
import { PrismaConfirmPickupAdapter } from '../../../src/modules/pickup/infrastructure/prismaConfirmPickupAdapter';

function isLocalDatabase(): boolean {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return url.hostname === '127.0.0.1' && url.port === '5434' && url.pathname === '/takeandgo';
  } catch {
    return false;
  }
}

test(
  'stock en PostgreSQL: un producto sin control de stock no traba el vencimiento, el rechazo ni el retiro',
  { skip: !isLocalDatabase() ? 'Requiere PostgreSQL local de Take&Go' : false },
  async () => {
    const prisma = getPrisma();
    const adapter = new PrismaPaymentOrderStockAdapter();
    const pickup = new PrismaConfirmPickupAdapter();
    const suffix = randomUUID();
    let storeId: string | undefined;
    let organizationId: string | undefined;
    let customerId: string | undefined;
    let categoryId: string | undefined;
    const productIds: string[] = [];

    try {
      organizationId = (await prisma.organization.create({ data: { name: `Stock ${suffix}` } })).id;
      storeId = (await prisma.store.create({
        data: { organizationId, name: 'Buffet stock', code: `U${suffix.slice(0, 5).toUpperCase()}` },
      })).id;
      customerId = (await prisma.customer.create({ data: { name: 'Cliente', email: `stock-${suffix}@test.com` } })).id;
      categoryId = (await prisma.category.create({ data: { storeId, name: 'Prueba' } })).id;

      // Café: con control de stock (3 pedidos con 1 unidad reservada cada uno). Medialuna: sin registro de stock.
      const tracked = (await prisma.product.create({
        data: { storeId, categoryId, name: 'Café', priceCents: 1000, basePreparationSeconds: 60 },
      })).id;
      const untracked = (await prisma.product.create({
        data: { storeId, categoryId, name: 'Medialuna', priceCents: 500, basePreparationSeconds: 60 },
      })).id;
      productIds.push(tracked, untracked);
      await prisma.productStock.create({ data: { storeId, productId: tracked, availableStock: 5, reservedStock: 3 } });

      const items = {
        create: [
          { productId: tracked, productNameSnapshot: 'Café', unitPriceCentsSnapshot: 1000, quantity: 1, subtotalCents: 1000 },
          { productId: untracked, productNameSnapshot: 'Medialuna', unitPriceCentsSnapshot: 500, quantity: 1, subtotalCents: 500 },
        ],
      };

      const order = (orderNumber: number, data: Record<string, unknown>) =>
        prisma.order.create({
          data: { storeId: storeId!, customerId: customerId!, orderNumber, totalCents: 1500, items, ...data } as never,
        });

      const stock = () => prisma.productStock.findUniqueOrThrow({ where: { productId: tracked } });
      const movements = (orderId: string) => prisma.stockMovement.findMany({ where: { referenceId: orderId } });

      // 1. Vencimiento
      const expiring = await order(1, { status: 'RESERVED', reservedUntil: new Date(Date.now() - 60_000) });
      assert.equal(await adapter.expireOrder(expiring.id, new Date()), true);
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: expiring.id } })).status, 'EXPIRED');
      assert.deepEqual([(await stock()).availableStock, (await stock()).reservedStock], [6, 2]);
      assert.deepEqual((await movements(expiring.id)).map(m => [m.type, m.productId]), [['ORDER_CANCELLED', tracked]]);

      // 2. Pago rechazado
      const rejected = await order(2, { status: 'RESERVED', reservedUntil: new Date(Date.now() + 5 * 60_000) });
      const payment = await prisma.payment.create({
        data: { orderId: rejected.id, amountCents: 1500, expiresAt: new Date(Date.now() + 5 * 60_000) },
      });
      await adapter.applyResult(payment.id, 'REJECTED', new Date());
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: rejected.id } })).status, 'CANCELLED');
      assert.deepEqual([(await stock()).availableStock, (await stock()).reservedStock], [7, 1]);
      assert.deepEqual((await movements(rejected.id)).map(m => [m.type, m.productId]), [['ORDER_CANCELLED', tracked]]);

      // 3. Retiro
      const ready = await order(3, {
        status: 'READY_FOR_PICKUP',
        pickupCode: createHash('sha256').update('123456').digest('hex'),
      });
      const result = await pickup.confirm({
        orderId: ready.id,
        storeId,
        credential: { type: 'MANUAL', code: '123456' },
        now: new Date(),
        employeeUserId: 'empleado-prueba',
      } as never);
      assert.equal(result.status, 'COMPLETED');
      assert.deepEqual([(await stock()).availableStock, (await stock()).reservedStock], [7, 0]);
      assert.deepEqual((await movements(ready.id)).map(m => [m.type, m.productId]), [['ORDER_FULFILLED', tracked]]);
    } finally {
      if (storeId) {
        await prisma.payment.deleteMany({ where: { order: { storeId } } });
        await prisma.order.deleteMany({ where: { storeId } });
        await prisma.stockMovement.deleteMany({ where: { storeId } });
        await prisma.productStock.deleteMany({ where: { storeId } });
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      }
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
      if (storeId) await prisma.store.deleteMany({ where: { id: storeId } });
      if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
  },
);
