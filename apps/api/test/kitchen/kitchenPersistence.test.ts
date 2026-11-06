
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

    // Ventana prometida de retiro.
    const scheduledForDate = new Date('2026-11-04T00:00:00.000Z');
    const promisedFrom = new Date('2026-11-04T18:00:00.000Z');
    const promisedTo = new Date('2026-11-04T18:05:00.000Z');
    const toleranceUntil = new Date('2026-11-04T18:10:00.000Z');

    const suffix = randomUUID();

    let organizationId: string | undefined;
    let storeId: string | undefined;
    let customerId: string | undefined;
    let orderId: string | undefined;

    try {
      // 1. Crear los datos necesarios para el pedido.
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

      // 2. Crear un pedido con una ventana prometida de retiro.
      const order = await prisma.order.create({
        data: {
          storeId,
          customerId,
          orderNumber: 1,
          totalCents: 1500,
          status: 'CONFIRMED',
          scheduledForDate,
          promisedFrom,
          promisedTo,
          toleranceUntil,
        },
      });

      orderId = order.id;

      // 3. Verificar que el repositorio recupera la ventana.
      const savedWindow = await repository.findById(orderId);

      assert.ok(savedWindow);

      assert.deepEqual(
        savedWindow.scheduledForDate,
        scheduledForDate
      );
      assert.deepEqual(savedWindow.promisedFrom, promisedFrom);
      assert.deepEqual(savedWindow.promisedTo, promisedTo);
      assert.deepEqual(
        savedWindow.toleranceUntil,
        toleranceUntil
      );

      const employee: Actor = {
        userId: `employee-${suffix}`,
        role: 'STORE_EMPLOYEE',
        storeId,
      };

      // 4. Iniciar preparación usando el caso de uso real.
      const started = await startPreparation.execute(
        employee,
        storeId,
        orderId
      );

      assert.equal(started.status, 'PREPARING');
      assert.equal(started.preparedAt, null);

      // 5. Finalizar preparación usando el caso de uso real.
      const finished = await finishPreparation.execute(
        employee,
        storeId,
        orderId
      );

      assert.equal(finished.status, 'PREPARING');
      assert.deepEqual(finished.preparedAt, fixedDate);
      assert.equal(
        finished.preparedByUserId,
        employee.userId
      );

      // 6. Consultar directamente PostgreSQL.
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

      // Verificar que la ventana sigue persistida.
      assert.deepEqual(
        savedOrder.scheduledForDate,
        scheduledForDate
      );
      assert.deepEqual(savedOrder.promisedFrom, promisedFrom);
      assert.deepEqual(savedOrder.promisedTo, promisedTo);
      assert.deepEqual(
        savedOrder.toleranceUntil,
        toleranceUntil
      );

      // 7. No permitir finalizar el mismo pedido dos veces.
      await assert.rejects(
        () => finishPreparation.execute(employee, storeId, orderId),
        { code: 'INVALID_KITCHEN_STATE' }
      );

      // 8. Comprobar que el repositorio impide
      // finalizar nuevamente una preparación ya finalizada.
      const repeatedUpdate =
        await repository.finishPreparationIfCurrent(
          orderId,
          new Date('2026-11-04T19:00:00.000Z'),
          'another-employee'
        );

      assert.equal(repeatedUpdate, null);

      const unchangedOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      assert.ok(unchangedOrder);

      assert.deepEqual(
        unchangedOrder.preparedAt,
        fixedDate
      );
      assert.equal(
        unchangedOrder.preparedByUserId,
        employee.userId
      );
      assert.equal(unchangedOrder.status, 'PREPARING');

      // 9. Verificar que una reprogramación impide
      // activar el retiro con una ventana anterior.
      const originalFrom = promisedFrom;
      const originalTo = promisedTo;

      const newFrom = new Date('2026-11-04T18:20:00.000Z');
      const newTo = new Date('2026-11-04T18:25:00.000Z');
      const newToleranceUntil = new Date(
        '2026-11-04T18:30:00.000Z'
      );

      // Simulamos que CocIA reprogramó la ventana.
      await prisma.order.update({
        where: { id: orderId },
        data: {
          promisedFrom: newFrom,
          promisedTo: newTo,
          toleranceUntil: newToleranceUntil,
        },
      });

      // 10. Intentar activar el retiro con la ventana anterior.
      const staleActivation =
        await repository.activatePickupIfEligible(
          orderId,
          originalFrom,
          originalTo,
          new Date('2026-11-04T18:01:00.000Z')
        );

      // La actualización debe rechazarse.
      assert.equal(staleActivation, null);

      const afterStaleAttempt =
        await prisma.order.findUnique({
          where: { id: orderId },
        });

      assert.ok(afterStaleAttempt);
      assert.equal(
        afterStaleAttempt.status,
        'PREPARING'
      );

      // La ventana reprogramada debe conservarse.
      assert.deepEqual(
        afterStaleAttempt.promisedFrom,
        newFrom
      );
      assert.deepEqual(
        afterStaleAttempt.promisedTo,
        newTo
      );
      assert.deepEqual(
        afterStaleAttempt.toleranceUntil,
        newToleranceUntil
      );

      // 11. Activar el retiro usando la ventana vigente.
      const validActivation =
        await repository.activatePickupIfEligible(
          orderId,
          newFrom,
          newTo,
          new Date('2026-11-04T18:20:00.000Z')
        );

      assert.ok(validActivation);
      assert.equal(
        validActivation.status,
        'READY_FOR_PICKUP'
      );

      // 12. Comprobar el resultado directamente en PostgreSQL.
      const finalOrder = await prisma.order.findUnique({
        where: { id: orderId },
      });

      assert.ok(finalOrder);

      assert.equal(
        finalOrder.status,
        'READY_FOR_PICKUP'
      );
      assert.deepEqual(
        finalOrder.promisedFrom,
        newFrom
      );
      assert.deepEqual(
        finalOrder.promisedTo,
        newTo
      );
      assert.deepEqual(
        finalOrder.toleranceUntil,
        newToleranceUntil
      );
      assert.deepEqual(
        finalOrder.preparedAt,
        fixedDate
      );
      assert.equal(
        finalOrder.preparedByUserId,
        employee.userId
      );
    } finally {
      // Eliminar solamente los registros creados por este test.
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
