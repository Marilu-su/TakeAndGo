import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { HandlePaymentNotificationUseCase } from '../../../src/modules/payment/application/handlePaymentNotificationUseCase';
import { ProcessPaymentResultUseCase } from '../../../src/modules/payment/application/processPaymentResultUseCase';
import { SyncPaymentUseCase } from '../../../src/modules/payment/application/syncPaymentUseCase';
import type { PaymentStatusPort, ProviderPayment } from '../../../src/modules/payment/domain/paymentStatusPort';
import { PrismaPaymentOrderStockAdapter } from '../../../src/modules/payment/infrastructure/prismaPaymentOrderStockAdapter';
import { PrismaPaymentRepository } from '../../../src/modules/payment/infrastructure/prismaPaymentRepository';

function isLocalDatabase(): boolean {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return url.hostname === '127.0.0.1' && url.port === '5434' && url.pathname === '/takeandgo';
  } catch {
    return false;
  }
}

test(
  'confirmación de pago en PostgreSQL: avisos duplicados y simultáneos se aplican una sola vez',
  { skip: !isLocalDatabase() ? 'Requiere PostgreSQL local de Take&Go' : false },
  async () => {
    const prisma = getPrisma();
    const repository = new PrismaPaymentRepository();
    const provider = new Map<string, ProviderPayment>();
    const statusPort: PaymentStatusPort = {
      getPayment: async id => [...provider.values()].find(p => p.providerPaymentId === id) ?? null,
      findPaymentByReference: async payment => provider.get(payment.id) ?? null,
    };
    const sync = new SyncPaymentUseCase(
      repository,
      statusPort,
      new ProcessPaymentResultUseCase(new PrismaPaymentOrderStockAdapter()),
    );
    const webhook = new HandlePaymentNotificationUseCase(statusPort, repository, sync);

    const suffix = randomUUID();
    let storeId: string | undefined;
    let organizationId: string | undefined;
    let customerId: string | undefined;
    let productId: string | undefined;
    let categoryId: string | undefined;

    try {
      organizationId = (await prisma.organization.create({ data: { name: `MVP-07 ${suffix}` } })).id;
      storeId = (await prisma.store.create({
        data: { organizationId, name: 'Buffet MVP-07', code: `M${suffix.slice(0, 5).toUpperCase()}` },
      })).id;
      customerId = (await prisma.customer.create({ data: { name: 'Cliente', email: `mvp07-${suffix}@test.com` } })).id;
      categoryId = (await prisma.category.create({ data: { storeId, name: 'Prueba' } })).id;
      productId = (await prisma.product.create({
        data: { storeId, categoryId, name: 'Producto', priceCents: 1000, basePreparationSeconds: 60 },
      })).id;

      // 2 pedidos con 2 unidades reservadas cada uno.
      await prisma.productStock.create({ data: { storeId, productId, availableStock: 6, reservedStock: 4 } });

      const reservedUntil = new Date(Date.now() + 5 * 60_000);

      async function reservedOrderWithPayment(orderNumber: number) {
        const order = await prisma.order.create({
          data: {
            storeId: storeId!,
            customerId: customerId!,
            orderNumber,
            status: 'RESERVED',
            totalCents: 2000,
            reservedUntil,
            items: {
              create: {
                productId,
                productNameSnapshot: 'Producto',
                unitPriceCentsSnapshot: 1000,
                quantity: 2,
                subtotalCents: 2000,
              },
            },
          },
        });
        const payment = await repository.create({ orderId: order.id, amountCents: 2000, expiresAt: reservedUntil });
        return { order, payment };
      }

      // 1. Aprobación: llegan tres avisos y una consulta al mismo tiempo.
      const approved = await reservedOrderWithPayment(1);
      const approvedAtProvider: ProviderPayment = {
        providerPaymentId: `mp-ok-${suffix}`,
        externalReference: approved.payment.id,
        status: 'APPROVED',
        amountCents: 2000,
      };
      provider.set(approved.payment.id, approvedAtProvider);

      await Promise.all([
        webhook.execute(approvedAtProvider.providerPaymentId),
        webhook.execute(approvedAtProvider.providerPaymentId),
        webhook.execute(approvedAtProvider.providerPaymentId),
        sync.syncPending(approved.payment),
      ]);

      const confirmedOrder = await prisma.order.findUniqueOrThrow({ where: { id: approved.order.id } });
      const approvedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: approved.payment.id } });
      assert.equal(confirmedOrder.status, 'CONFIRMED');
      assert.equal(approvedPayment.status, 'APPROVED');
      assert.equal(approvedPayment.providerPaymentId, approvedAtProvider.providerPaymentId);

      // 2. Rechazo al volver del checkout: dos consultas simultáneas liberan el stock una sola vez.
      const rejected = await reservedOrderWithPayment(2);
      provider.set(rejected.payment.id, {
        providerPaymentId: `mp-ko-${suffix}`,
        externalReference: rejected.payment.id,
        status: 'REJECTED',
        amountCents: 2000,
      });

      await Promise.all([sync.syncPending(rejected.payment), sync.syncPending(rejected.payment)]);

      const cancelledOrder = await prisma.order.findUniqueOrThrow({ where: { id: rejected.order.id } });
      const stock = await prisma.productStock.findUniqueOrThrow({ where: { productId } });
      const releases = await prisma.stockMovement.count({
        where: { referenceId: rejected.order.id, type: 'ORDER_CANCELLED' },
      });

      assert.equal(cancelledOrder.status, 'CANCELLED');
      assert.equal(stock.availableStock, 8);
      assert.equal(stock.reservedStock, 2);
      assert.equal(releases, 1);
    } finally {
      if (storeId) {
        await prisma.payment.deleteMany({ where: { order: { storeId } } });
        await prisma.order.deleteMany({ where: { storeId } });
        await prisma.stockMovement.deleteMany({ where: { storeId } });
      }
      if (productId) {
        await prisma.productStock.deleteMany({ where: { productId } });
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
      if (storeId) await prisma.store.deleteMany({ where: { id: storeId } });
      if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
  },
);
