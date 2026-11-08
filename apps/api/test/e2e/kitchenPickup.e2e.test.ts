import 'dotenv/config';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { createApp } from '../../src/app';
import { getPrisma } from '../../src/infrastructure/database/prisma';
import { PrismaOrderRepository } from '../../src/modules/order/infrastructure/prismaOrderRepository';
import { createKitchenModule } from '../../src/modules/kitchen/infrastructure/kitchenModule';
import { ActivatePickupWhenEligibleUseCase } from '../../src/modules/kitchen/application/activatePickupWhenEligibleUseCase';
import type { Actor } from '../../src/shared/auth/actor';

// Este E2E modifica datos; nunca debe ejecutarse contra una base remota.
function isLocalTestDatabase(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  try {
    const url = new URL(databaseUrl);
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
  'E2E: cocina, retiro QR y manual, stock e idempotencia',
  {
    skip: !isLocalTestDatabase()
      ? 'Requiere PostgreSQL local de Take&Go (127.0.0.1:5434/takeandgo)'
      : false,
  },
  async () => {
    const prisma = getPrisma();
    const unique = randomUUID();
    const storeCode = `E2E${String(parseInt(unique.slice(0, 8), 16) % 1000).padStart(3, '0')}`;

    let organizationId: string | undefined;
    let storeId: string | undefined;
    let customerId: string | undefined;
    let categoryId: string | undefined;
    let productId: string | undefined;
    const orderIds: string[] = [];

    try {
      const organization = await prisma.organization.create({
        data: { name: `Organización E2E ${unique}` },
      });
      organizationId = organization.id;

      const store = await prisma.store.create({
        data: { organizationId, name: 'Buffet E2E', code: storeCode },
      });
      storeId = store.id;

      const customer = await prisma.customer.create({
        data: { name: 'Cliente E2E', email: `e2e-${unique}@test.com` },
      });
      customerId = customer.id;

      const category = await prisma.category.create({
        data: {
          storeId,
          name: 'Categoría E2E',
          activeNameKey: `e2e-${unique}`,
        },
      });
      categoryId = category.id;

      const product = await prisma.product.create({
        data: {
          storeId,
          categoryId,
          name: 'Producto E2E',
          priceCents: 1500,
          basePreparationSeconds: 60,
        },
      });
      productId = product.id;

      // Dos unidades previamente reservadas: una para cada pedido.
      await prisma.productStock.create({
        data: { storeId, productId, availableStock: 0, reservedStock: 2 },
      });

      const now = new Date();
      const promisedFrom = new Date(now.getTime() - 60_000);
      const promisedTo = new Date(now.getTime() + 4 * 60_000);
      const toleranceUntil = new Date(now.getTime() + 9 * 60_000);

      async function createConfirmedOrder(orderNumber: number): Promise<string> {
        const order = await prisma.order.create({
          data: {
            storeId: store.id,
            customerId: customer.id,
            orderNumber,
            totalCents: 1500,
            status: 'CONFIRMED',
            scheduledForDate: now,
            promisedFrom,
            promisedTo,
            toleranceUntil,
            items: {
              create: {
                productId: product.id,
                productNameSnapshot: product.name,
                unitPriceCentsSnapshot: 1500,
                quantity: 1,
                subtotalCents: 1500,
              },
            },
          },
        });
        orderIds.push(order.id);
        return order.id;
      }

      const employee: Actor = {
        userId: `employee-${unique}`,
        role: 'STORE_EMPLOYEE',
        storeId,
      };
      const customerActor: Actor = {
        userId: customerId,
        role: 'CUSTOMER',
      };
      const outsider: Actor = {
        userId: `outsider-${unique}`,
        role: 'STORE_EMPLOYEE',
        storeId: randomUUID(),
      };

      const repository = new PrismaOrderRepository();
      const app = createApp({
        resolveActor: async (req) => {
          if (req.get('x-test-role') === 'customer') return customerActor;
          if (req.get('x-test-role') === 'outsider') return outsider;
          return employee;
        },
        kitchenModule: createKitchenModule(repository),
      });
      const activatePickup = new ActivatePickupWhenEligibleUseCase(repository);

      // Se usa la API real de cocina, más el caso de uso de activación
      // (este último todavía no está expuesto por un proceso HTTP/job).
      async function prepareAndActivate(orderId: string): Promise<void> {
        const started = await request(app)
          .post(`/api/v1/stores/${storeId}/kitchen/orders/${orderId}/start`);
        assert.equal(started.status, 200);
        assert.equal(started.body.status, 'PREPARING');

        const finished = await request(app)
          .post(`/api/v1/stores/${storeId}/kitchen/orders/${orderId}/finish`);
        assert.equal(finished.status, 200);
        assert.equal(finished.body.status, 'PREPARING');
        assert.ok(finished.body.preparedAt);

        const prepared = await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
        });
        assert.ok(prepared.preparedAt);
        assert.equal(prepared.preparedByUserId, employee.userId);

        const ready = await activatePickup.execute(orderId);
        assert.equal(ready.status, 'READY_FOR_PICKUP');
        const persisted = await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
        });
        assert.equal(persisted.status, 'READY_FOR_PICKUP');
      }

      // Escenario A: pedido de cocina entregado mediante QR.
      const qrOrderId = await createConfirmedOrder(1);
      await prepareAndActivate(qrOrderId);

      const qrResponse = await request(app)
        .post(`/api/v1/orders/${qrOrderId}/pickup/qr`)
        .set('x-test-role', 'customer');
      assert.equal(qrResponse.status, 201);
      assert.ok(qrResponse.body.token);
      const qrToken: string = qrResponse.body.token;

      // Credencial inválida: no debe completar ni consumir stock.
      const invalidQr = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${qrOrderId}/confirm`)
        .send({ credential: { type: 'QR', token: 'token-invalido' } });
      assert.equal(invalidQr.status, 422);
      assert.equal(
        (await prisma.order.findUniqueOrThrow({ where: { id: qrOrderId } })).status,
        'READY_FOR_PICKUP'
      );

      // Un empleado de otro buffet no debe entregar este pedido.
      const crossStore = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${qrOrderId}/confirm`)
        .set('x-test-role', 'outsider')
        .send({ credential: { type: 'QR', token: qrToken } });
      assert.equal(crossStore.status, 403);

      const pickupQr = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${qrOrderId}/confirm`)
        .send({ credential: { type: 'QR', token: qrToken } });
      assert.equal(pickupQr.status, 200);
      assert.equal(pickupQr.body.status, 'COMPLETED');
      assert.equal(pickupQr.body.orderId, qrOrderId);

      const completedQr = await prisma.order.findUniqueOrThrow({
        where: { id: qrOrderId },
      });
      assert.equal(completedQr.status, 'COMPLETED');
      assert.equal(completedQr.pickupMethod, 'QR');
      assert.ok(completedQr.pickedUpAt);
      assert.equal(completedQr.pickedUpByUserId, employee.userId);

      const qrSaved = await prisma.pickupToken.findFirstOrThrow({
        where: { orderId: qrOrderId },
      });
      assert.ok(qrSaved.usedAt);

      // Mismo QR, mismo resultado, sin doble movimiento.
      const repeatedQr = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${qrOrderId}/confirm`)
        .send({ credential: { type: 'QR', token: qrToken } });
      assert.equal(repeatedQr.status, 200);
      assert.equal(repeatedQr.body.status, 'COMPLETED');
      const afterQrRetry = await prisma.order.findUniqueOrThrow({
        where: { id: qrOrderId },
      });
      assert.deepEqual(afterQrRetry.pickedUpAt, completedQr.pickedUpAt);
      assert.equal(afterQrRetry.pickedUpByUserId, completedQr.pickedUpByUserId);
      assert.equal(
        await prisma.stockMovement.count({
          where: { referenceId: qrOrderId, type: 'ORDER_FULFILLED' },
        }),
        1
      );
      assert.equal(
        (await prisma.productStock.findUniqueOrThrow({ where: { productId } }))
          .reservedStock,
        1
      );

      // Escenario B: un segundo pedido preparado se entrega con código manual.
      const manualOrderId = await createConfirmedOrder(2);
      await prepareAndActivate(manualOrderId);

      const manualIssue = await request(app)
        .post(`/api/v1/orders/${manualOrderId}/pickup/manual`)
        .set('x-test-role', 'customer');
      assert.equal(manualIssue.status, 201);
      assert.match(manualIssue.body.code, /^[A-Za-z0-9_-]{12}$/);
      const manualCode: string = manualIssue.body.code;

      const lookup = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/by-code`)
        .send({ code: manualCode });
      assert.equal(lookup.status, 200);
      assert.equal(lookup.body.orderId, manualOrderId);
      assert.equal(lookup.body.status, 'READY_FOR_PICKUP');

      const manualPickup = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${manualOrderId}/confirm`)
        .send({ credential: { type: 'MANUAL', code: manualCode } });
      assert.equal(manualPickup.status, 200);
      assert.equal(manualPickup.body.status, 'COMPLETED');

      const completedManual = await prisma.order.findUniqueOrThrow({
        where: { id: manualOrderId },
      });
      assert.equal(completedManual.status, 'COMPLETED');
      assert.equal(completedManual.pickupMethod, 'MANUAL');
      assert.ok(completedManual.pickedUpAt);
      assert.equal(completedManual.pickedUpByUserId, employee.userId);

      const repeatedManual = await request(app)
        .post(`/api/v1/stores/${storeId}/pickup/orders/${manualOrderId}/confirm`)
        .send({ credential: { type: 'MANUAL', code: manualCode } });
      assert.equal(repeatedManual.status, 200);
      assert.equal(repeatedManual.body.status, 'COMPLETED');
      const afterManualRetry = await prisma.order.findUniqueOrThrow({
        where: { id: manualOrderId },
      });
      assert.deepEqual(afterManualRetry.pickedUpAt, completedManual.pickedUpAt);

      assert.equal(
        await prisma.stockMovement.count({
          where: { referenceId: manualOrderId, type: 'ORDER_FULFILLED' },
        }),
        1
      );
      const stock = await prisma.productStock.findUniqueOrThrow({
        where: { productId },
      });
      assert.equal(stock.availableStock, 0);
      assert.equal(stock.reservedStock, 0);
    } finally {
      // Solo elimina los registros creados por el test, en orden de dependencias.
      if (storeId) {
        await prisma.stockMovement.deleteMany({ where: { storeId } });
        await prisma.pickupToken.deleteMany({ where: { storeId } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      if (productId) {
        await prisma.productStock.deleteMany({ where: { productId } });
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (categoryId) {
        await prisma.category.deleteMany({ where: { id: categoryId } });
      }
      if (customerId) {
        await prisma.customer.deleteMany({ where: { id: customerId } });
      }
      if (storeId) {
        await prisma.store.deleteMany({ where: { id: storeId } });
      }
      if (organizationId) {
        await prisma.organization.deleteMany({ where: { id: organizationId } });
      }
    }
  }
);
