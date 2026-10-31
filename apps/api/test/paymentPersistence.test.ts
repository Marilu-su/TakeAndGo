
import 'dotenv/config';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../src/infrastructure/database/prisma';
import { PrismaPaymentRepository } from '../src/modules/payment/infrastructure/prismaPaymentRepository';

const LOCAL_DB_HOST = '127.0.0.1';
const LOCAL_DB_PORT = '5434';
const LOCAL_DB_NAME = 'takeandgo';

function isLocalTestDatabase(): boolean {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);

    return (
      url.protocol === 'postgresql:' &&
      url.hostname === LOCAL_DB_HOST &&
      url.port === LOCAL_DB_PORT &&
      url.pathname === `/${LOCAL_DB_NAME}`
    );
  } catch {
    return false;
  }
}

test(
  'guarda y recupera un pago en PostgreSQL',
  {
    skip: !isLocalTestDatabase()
      ? 'Requiere la base PostgreSQL local de Take&Go'
      : false,
  },
  async () => {
    const prisma = getPrisma();
    const repository = new PrismaPaymentRepository();

    const suffix = randomUUID();

    let organizationId: string | undefined;
    let storeId: string | undefined;
    let customerId: string | undefined;

    try {
      const organization = await prisma.organization.create({
        data: {
          name: `Organizacion test payment ${suffix}`,
        },
      });

      organizationId = organization.id;

      const store = await prisma.store.create({
        data: {
          organizationId,
          name: 'Buffet test payment',
          code: `T${suffix.slice(0, 5).toUpperCase()}`,
        },
      });

      storeId = store.id;

      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente test payment',
          email: `payment-${suffix}@test.com`,
        },
      });

      customerId = customer.id;

      const order = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 1,
          totalCents: 500000,
          status: 'RESERVED',
        },
      });

      const payment = await repository.create({
        orderId: order.id,
        amountCents: 500000,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      assert.equal(payment.status, 'PENDING');

      const savedPayment = await repository.findById(payment.id);

      assert.ok(savedPayment);
      assert.equal(savedPayment.orderId, order.id);
      assert.equal(savedPayment.amountCents, 500000);

      const updated = await repository.updateProviderPaymentId(
        payment.id,
        `fake-${suffix}`,
      );

      assert.equal(updated.providerPaymentId, `fake-${suffix}`);

      const foundByOrder = await repository.findByOrderId(order.id);

      assert.equal(foundByOrder?.id, payment.id);
    } finally {
      if (storeId) {
        await prisma.payment.deleteMany({
          where: { order: { storeId } },
        });

        await prisma.order.deleteMany({
          where: { storeId },
        });
      }

      if (customerId) {
        await prisma.customer.delete({
          where: { id: customerId },
        });
      }

      if (storeId) {
        await prisma.store.delete({
          where: { id: storeId },
        });
      }

      if (organizationId) {
        await prisma.organization.delete({
          where: { id: organizationId },
        });
      }
    }
  },
);
