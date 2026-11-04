
import 'dotenv/config';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { getPrisma } from '../../src/infrastructure/database/prisma';
import { PrismaOrderRepository } from '../../src/modules/order/infrastructure/prismaOrderRepository';
import { StartPreparationUseCase } from '../../src/modules/kitchen/application/startPreparationUseCase';
import { FinishPreparationUseCase } from '../../src/modules/kitchen/application/finishPreparationUseCase';
import type { Actor } from '../../src/shared/auth/actor';

function isLocalTestDatabase(): boolean {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return false;
  }

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
  'inicia y finaliza preparación, persistiendo los datos en PostgreSQL',
  {
    skip: !isLocalTestDatabase()
      ? 'Requiere la base PostgreSQL local de Take&Go'
      : false,
  },
  async () => {
    const prisma = getPrisma();
    const repository = new PrismaOrderRepository();

    const startPreparation = new StartPreparationUseCase(repository);

    const fixedDate = new Date('2026-11-04T18:00:00.000Z');

    const finishPreparation = new FinishPreparationUseCase(
      repository,
      () => fixedDate
    );

    const suffix = randomUUID();

    let organizationId: string | undefined;
    let storeId: string | undefined;
    let customerId: string | undefined;
    let orderId: string | undefined;

    try {
      // 1. Crear los datos necesarios para el pedido
      const organization = await prisma.organization.create({
        data: {
          name: `Organizacion test cocina ${suffix}`,
        },
      });

      organizationId = organization.id;

      const store = await prisma.store.create({
        data: {
          organizationId,
          name: 'Buffet test cocina',
          code: `K${suffix.slice(0, 5).toUpperCase()}`,
        },
      });

      storeId = store.id;

      const customer = await prisma.customer.create({
        data: {
          name: 'Cliente test cocina',
          email: `kitchen-${suffix}@test.com`,
        },
      });

      customerId = customer.id;

      const order = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 1,
          totalCents: 1500,
          status: 'CONFIRMED',
        },
      });

      orderId = order.id;
      if (!storeId || !orderId) {
         throw new Error('No se pudieron crear los datos de prueba');
    }

      const employee: Actor = {
        userId: `employee-${suffix}`,
        role: 'STORE_EMPLOYEE',
        storeId,
      };

      // 2. Iniciar preparación usando el caso de uso real
      const started = await startPreparation.execute(
        employee,
        storeId,
        orderId
      );

      assert.equal(started.status, 'PREPARING');
      assert.equal(started.preparedAt, null);

      // 3. Finalizar preparación usando el caso de uso real
      const finished = await finishPreparation.execute(
        employee,
        storeId,
        orderId
      );

      assert.equal(finished.status, 'PREPARING');
      assert.deepEqual(finished.preparedAt, fixedDate);
      assert.equal(finished.preparedByUserId, employee.userId);

      // 4. Consultar directamente PostgreSQL
      const savedOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      assert.ok(savedOrder);

      assert.equal(savedOrder.status, 'PREPARING');
      assert.deepEqual(savedOrder.preparedAt, fixedDate);
      assert.equal(
        savedOrder.preparedByUserId,
        employee.userId
      );

      // 5. No permitir finalizar el mismo pedido dos veces
      await assert.rejects(
        () => finishPreparation.execute(employee, storeId, orderId),
        { code: 'INVALID_KITCHEN_STATE' }
      );

      // 6. Comprobar también la condición del repositorio
      const repeatedUpdate = await repository.finishPreparationIfCurrent(
        orderId,
        new Date('2026-11-04T19:00:00.000Z'),
        'another-employee'
      );

      assert.equal(repeatedUpdate, null);

      const unchangedOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      assert.ok(unchangedOrder);
      assert.deepEqual(unchangedOrder.preparedAt, fixedDate);
      assert.equal(
        unchangedOrder.preparedByUserId,
        employee.userId
      );
      assert.equal(unchangedOrder.status, 'PREPARING');

    } finally {
      // Eliminar solamente los registros creados por este test
      if (orderId) {
        await prisma.order.delete({
          where: { id: orderId },
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
  }
);
