import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { ReleaseExpiredReservationsUseCase } from '../../../src/modules/order/application/releaseExpiredReservationsUseCase';
import { PrismaOrderRepository } from '../../../src/modules/order/infrastructure/prismaOrderRepository';
import { ExpireReservationsJob } from '../../../src/modules/payment/application/expireReservationsJob';
import { ProcessLatePaymentCompensationUseCase } from '../../../src/modules/payment/application/processLatePaymentCompensationUseCase';
import { ProcessPaymentResultUseCase } from '../../../src/modules/payment/application/processPaymentResultUseCase';
import { SyncPaymentUseCase } from '../../../src/modules/payment/application/syncPaymentUseCase';
import type { PaymentStatusPort, ProviderPayment } from '../../../src/modules/payment/domain/paymentStatusPort';
import { PrismaPaymentCompensationRepository } from '../../../src/modules/payment/infrastructure/prismaPaymentCompensationRepository';
import { PrismaPaymentOrderStockAdapter } from '../../../src/modules/payment/infrastructure/prismaPaymentOrderStockAdapter';
import { PrismaPaymentRepository } from '../../../src/modules/payment/infrastructure/prismaPaymentRepository';
import { PrismaStockRepository } from '../../../src/modules/stock/infrastructure/prismaStockRepository';

function isLocalDatabase(): boolean {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return url.hostname === '127.0.0.1' && url.port === '5434' && url.pathname === '/takeandgo';
  } catch {
    return false;
  }
}

test(
  'vencimiento en PostgreSQL: libera el stock y reembolsa una sola vez un pago aprobado tarde',
  { skip: !isLocalDatabase() ? 'Requiere PostgreSQL local de Take&Go' : false },
  async () => {
    const prisma = getPrisma();
    const paymentRepository = new PrismaPaymentRepository();
    const orderRepository = new PrismaOrderRepository();

    const provider = new Map<string, ProviderPayment>();
    const statusPort: PaymentStatusPort = {
      getPayment: async id => [...provider.values()].find(p => p.providerPaymentId === id) ?? null,
      findPaymentByReference: async payment => provider.get(payment.id) ?? null,
    };
    const refunds: string[] = [];
    const refundPort = {
      refundPayment: async (input: { paymentId: string }) => {
        refunds.push(input.paymentId);
        return { providerRefundId: `refund-${input.paymentId}` };
      },
    };

    const compensation = new ProcessLatePaymentCompensationUseCase(
      paymentRepository,
      orderRepository,
      new PrismaPaymentCompensationRepository(),
      refundPort,
    );
    const sync = new SyncPaymentUseCase(
      paymentRepository,
      statusPort,
      new ProcessPaymentResultUseCase(new PrismaPaymentOrderStockAdapter(), () => new Date(), compensation),
    );
    const job = new ExpireReservationsJob(
      new ReleaseExpiredReservationsUseCase(orderRepository, new PrismaStockRepository(), new PrismaPaymentOrderStockAdapter()),
      (since, now) => paymentRepository.findPendingOfExpiredOrders(since, now),
      sync,
    );

    const suffix = randomUUID();
    let storeId: string | undefined;
    let organizationId: string | undefined;
    let customerId: string | undefined;
    let productId: string | undefined;
    let categoryId: string | undefined;
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      organizationId = (await prisma.organization.create({ data: { name: `MVP-08 ${suffix}` } })).id;
      storeId = (await prisma.store.create({
        data: { organizationId, name: 'Buffet MVP-08', code: `V${suffix.slice(0, 5).toUpperCase()}` },
      })).id;
      customerId = (await prisma.customer.create({ data: { name: 'Cliente', email: `mvp08-${suffix}@test.com` } })).id;
      categoryId = (await prisma.category.create({ data: { storeId, name: 'Prueba' } })).id;
      productId = (await prisma.product.create({
        data: { storeId, categoryId, name: 'Producto', priceCents: 1000, basePreparationSeconds: 60 },
      })).id;
      await prisma.productStock.create({ data: { storeId, productId, availableStock: 6, reservedStock: 4 } });

      // Pedidos cuya reserva venció hace 1 minuto, con el pago todavía pendiente.
      const reservedUntil = new Date(Date.now() - 60_000);

      async function expiredOrderWithPayment(orderNumber: number) {
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
        const payment = await paymentRepository.create({ orderId: order.id, amountCents: 2000, expiresAt: reservedUntil });
        await paymentRepository.saveCheckout(payment.id, {
          providerPreferenceId: `pref-${payment.id}`,
          checkoutUrl: `https://checkout.test/${payment.id}`,
        });
        return { order, payment };
      }

      const late = await expiredOrderWithPayment(1); // el cliente terminó de pagar tarde
      const unpaid = await expiredOrderWithPayment(2); // el cliente nunca pagó

      provider.set(late.payment.id, {
        providerPaymentId: `mp-late-${suffix}`,
        externalReference: late.payment.id,
        status: 'APPROVED',
        amountCents: 2000,
      });

      // Corre dos veces, como cada 30 segundos en el servidor.
      const first = await job.run();
      await job.run();

      assert.ok(first.releasedOrdersCount >= 2);

      const lateOrder = await prisma.order.findUniqueOrThrow({ where: { id: late.order.id } });
      const unpaidOrder = await prisma.order.findUniqueOrThrow({ where: { id: unpaid.order.id } });
      assert.equal(lateOrder.status, 'EXPIRED');
      assert.equal(unpaidOrder.status, 'EXPIRED');

      // El stock de los dos pedidos vuelve a estar disponible.
      const stock = await prisma.productStock.findUniqueOrThrow({ where: { productId } });
      assert.equal(stock.availableStock, 10);
      assert.equal(stock.reservedStock, 0);

      // El pago tardío se reembolsó una sola vez y no confirmó el pedido.
      const latePayment = await prisma.payment.findUniqueOrThrow({ where: { id: late.payment.id }, include: { compensation: true } });
      assert.equal(latePayment.status, 'REFUNDED');
      assert.equal(latePayment.providerPaymentId, `mp-late-${suffix}`);
      assert.equal(latePayment.compensation?.status, 'COMPLETED');
      assert.equal(latePayment.compensation?.providerRefundId, `refund-${late.payment.id}`);
      assert.deepEqual(refunds, [late.payment.id]);

      // El pago nunca completado queda pendiente; la pantalla lo muestra como vencido.
      const unpaidPayment = await prisma.payment.findUniqueOrThrow({ where: { id: unpaid.payment.id } });
      assert.equal(unpaidPayment.status, 'PENDING');
    } finally {
      console.warn = originalWarn;
      if (storeId) {
        await prisma.paymentCompensation.deleteMany({ where: { payment: { order: { storeId } } } });
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
