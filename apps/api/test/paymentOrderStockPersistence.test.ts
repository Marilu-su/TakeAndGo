
import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { getPrisma } from '../src/infrastructure/database/prisma';
import { ProcessPaymentResultUseCase } from '../src/modules/payment/application/processPaymentResultUseCase';
import { PrismaPaymentOrderStockAdapter } from '../src/modules/payment/infrastructure/prismaPaymentOrderStockAdapter';

function isLocalDatabase(): boolean {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');

    return (
      url.protocol === 'postgresql:' &&
      url.hostname === '127.0.0.1' &&
      url.port === '5434' &&
      url.pathname === '/takeandgo'
    );
  } catch {
    return false;
  }
}

test(
  'integra pagos, pedidos y stock en PostgreSQL',
  {
    skip: !isLocalDatabase()
      ? 'Requiere PostgreSQL local de Take&Go'
      : false,
  },
  async () => {
    const prisma = getPrisma();

    const adapter = new PrismaPaymentOrderStockAdapter();
    const useCase = new ProcessPaymentResultUseCase(adapter);

    const suffix = randomUUID();
    let organizationId: string | undefined;
    let storeId: string | undefined;
    let customerId: string | undefined;
    let categoryId: string | undefined;
    let productId: string | undefined;

    try {
      const organization = await prisma.organization.create({
        data: { name: `Test C2-17 ${suffix}` },
      });
      organizationId = organization.id;

      const store = await prisma.store.create({
        data: {
          organizationId,
          name: 'Buffet test',
          code: `P${suffix.slice(0, 5).toUpperCase()}`,
        },
      });
      storeId = store.id;

      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente test',
          email: `c217-${suffix}@test.com`,
        },
      });
      customerId = customer.id;

      const category = await prisma.category.create({
        data: {
          storeId,
          name: 'Prueba',
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          storeId,
          categoryId,
          name: 'Producto de prueba',
          priceCents: 1000,
          basePreparationSeconds: 60,
        },
      });
      productId = product.id;

      // Stock reservado para dos pedidos.
      await prisma.productStock.create({
        data: {
          storeId,
          productId,
          availableStock: 6,
          reservedStock: 4,
        },
      });

      const expiresAt = new Date(Date.now() + 15 * 60_000);

      async function createReservedOrder(orderNumber: number) {
        return prisma.order.create({
          data: {
            storeId: storeId!,
            customerId: customerId!,
            orderNumber,
            status: 'RESERVED',
            totalCents: 2000,
            reservedUntil: expiresAt,
            items: {
              create: {
                productId,
                productNameSnapshot: 'Producto de prueba',
                unitPriceCentsSnapshot: 1000,
                quantity: 2,
                subtotalCents: 2000,
              },
            },
          },
        });
      }

      const approvedOrder = await createReservedOrder(1);
      const rejectedOrder = await createReservedOrder(2);

      const approvedPayment = await prisma.payment.create({
        data: {
          orderId: approvedOrder.id,
          amountCents: 2000,
          expiresAt,
        },
      });

      const rejectedPayment = await prisma.payment.create({
        data: {
          orderId: rejectedOrder.id,
          amountCents: 2000,
          expiresAt,
        },
      });

      // 1. Aprobar un pago confirma el pedido.
      await useCase.execute(approvedPayment.id, 'APPROVED');

      const confirmed = await prisma.order.findUniqueOrThrow({
        where: { id: approvedOrder.id },
      });

      assert.equal(confirmed.status, 'CONFIRMED');

      // 2. Rechazar un pago cancela el pedido y libera stock.
      await useCase.execute(rejectedPayment.id, 'REJECTED');

      const cancelled = await prisma.order.findUniqueOrThrow({
        where: { id: rejectedOrder.id },
      });

      assert.equal(cancelled.status, 'CANCELLED');

      const stock = await prisma.productStock.findUniqueOrThrow({
        where: { productId },
      });

      assert.equal(stock.availableStock, 8);
      assert.equal(stock.reservedStock, 2);

      // 3. Repetir un rechazo no libera stock dos veces.
      await useCase.execute(rejectedPayment.id, 'REJECTED');

      const finalStock = await prisma.productStock.findUniqueOrThrow({
        where: { productId },
      });

      assert.equal(finalStock.availableStock, 8);
      assert.equal(finalStock.reservedStock, 2);

      const movements = await prisma.stockMovement.count({
        where: {
          referenceId: rejectedOrder.id,
          type: 'ORDER_CANCELLED',
        },
      });

      assert.equal(movements, 1);

      // 4. Un pago vencido no debe confirmar el pedido.
      const expiredOrder = await createReservedOrder(3);
      const pastDate = new Date(Date.now() - 60_000);

      await prisma.order.update({
        where: { id: expiredOrder.id },
        data: { reservedUntil: pastDate },
      });

      const expiredPayment = await prisma.payment.create({
        data: {
          orderId: expiredOrder.id,
          amountCents: 2000,
          expiresAt: pastDate,
        },
      });

      await assert.rejects(
        () => useCase.execute(expiredPayment.id, 'APPROVED'),
        /PAYMENT_EXPIRED/,
      );

      const unchangedOrder = await prisma.order.findUniqueOrThrow({
        where: { id: expiredOrder.id },
      });

      const unchangedPayment = await prisma.payment.findUniqueOrThrow({
        where: { id: expiredPayment.id },
      });

      assert.equal(unchangedOrder.status, 'RESERVED');
      assert.equal(unchangedPayment.status, 'PENDING');

      // 5. Simular las unidades reservadas del pedido vencido.
      await prisma.productStock.update({
        where: { productId },
        data: {
          availableStock: { decrement: 2 },
          reservedStock: { increment: 2 },
        },
      });

      // 6. Vencer el pedido y liberar la reserva.
      const expired = await adapter.expireOrder(
        expiredOrder.id,
        new Date(),
      );

      assert.equal(expired, true);

      const orderAfterExpiration =
        await prisma.order.findUniqueOrThrow({
          where: { id: expiredOrder.id },
        });

      assert.equal(orderAfterExpiration.status, 'EXPIRED');

      const stockAfterExpiration =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      assert.equal(stockAfterExpiration.availableStock, 8);
      assert.equal(stockAfterExpiration.reservedStock, 2);

      // 7. Repetir el vencimiento no libera stock otra vez.
      const expiredAgain = await adapter.expireOrder(
        expiredOrder.id,
        new Date(),
      );

      assert.equal(expiredAgain, false);

      const stockAfterRetry =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      assert.equal(stockAfterRetry.availableStock, 8);
      assert.equal(stockAfterRetry.reservedStock, 2);

      const expirationMovements =
        await prisma.stockMovement.count({
          where: {
            referenceId: expiredOrder.id,
            type: 'ORDER_CANCELLED',
          },
        });

      assert.equal(expirationMovements, 1);
      
      // Una aprobación tardía no debe reactivar el pedido.
      await assert.rejects(
        () => useCase.execute(expiredPayment.id, 'APPROVED'),
        /ORDER_NOT_RESERVED/,
      );

      const orderAfterLateApproval =
        await prisma.order.findUniqueOrThrow({
          where: { id: expiredOrder.id },
        });

      const paymentAfterLateApproval =
        await prisma.payment.findUniqueOrThrow({
          where: { id: expiredPayment.id },
        });

      assert.equal(orderAfterLateApproval.status, 'EXPIRED');
      assert.equal(paymentAfterLateApproval.status, 'PENDING');

      const stockAfterLateApproval =
        await prisma.productStock.findUniqueOrThrow({
          where: { productId },
        });

      assert.equal(stockAfterLateApproval.availableStock, 8);
      assert.equal(stockAfterLateApproval.reservedStock, 2);

    } finally {
      if (storeId) {
        await prisma.payment.deleteMany({
          where: { order: { storeId } },
        });

        await prisma.order.deleteMany({
          where: { storeId },
        });

        await prisma.stockMovement.deleteMany({
          where: { storeId },
        });
      }

      if (productId) {
        await prisma.productStock.deleteMany({
          where: { productId },
        });

        await prisma.product.deleteMany({
          where: { id: productId },
        });
      }

      if (categoryId) {
        await prisma.category.deleteMany({
          where: { id: categoryId },
        });
      }

      if (customerId) {
        await prisma.customer.deleteMany({
          where: { id: customerId },
        });
      }

      if (storeId) {
        await prisma.store.deleteMany({
          where: { id: storeId },
        });
      }

      if (organizationId) {
        await prisma.organization.deleteMany({
          where: { id: organizationId },
        });
      }
    }
  },
);
