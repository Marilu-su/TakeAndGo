
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ActivateEligiblePickupsUseCase } from '../../src/modules/kitchen/application/activateEligiblePickupsUseCase';
import { ActivatePickupWhenEligibleUseCase } from '../../src/modules/kitchen/application/activatePickupWhenEligibleUseCase';
import type { Order } from '../../src/modules/order/domain/order';
import type { OrderRepository } from '../../src/modules/order/domain/orderRepository';

const now = new Date('2026-11-04T12:00:00.000Z');

function createOrder(): Order {
  return {
    id: 'order-1',
    storeId: 'store-1',
    customerId: 'customer-1',
    orderNumber: 1,
    status: 'PREPARING',
    totalCents: 1500,

    preparedAt: new Date('2026-11-04T11:45:00.000Z'),
    preparedByUserId: 'employee-1',

    scheduledForDate: new Date('2026-11-04T00:00:00.000Z'),
    promisedFrom: new Date('2026-11-04T12:00:00.000Z'),
    promisedTo: new Date('2026-11-04T12:05:00.000Z'),
    toleranceUntil: new Date('2026-11-04T12:10:00.000Z'),

    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };
}

function createRepository(
  reprogrammed = false
): OrderRepository {
  let currentOrder = createOrder();

  return {
    create: async () => currentOrder,

    findById: async (id) =>
      id === currentOrder.id ? currentOrder : null,

    findByStoreAndNumber: async () => currentOrder,

    findActiveByCustomer: async () => [currentOrder],

    findExpiredReservations: async () => [],

    // Busca los pedidos preparados y dentro de su ventana.
    findPreparedOrdersInPickupWindow: async (currentTime) => {
      if (
        currentOrder.status !== 'PREPARING' ||
        !currentOrder.preparedAt ||
        !currentOrder.promisedFrom ||
        !currentOrder.promisedTo ||
        currentOrder.promisedFrom > currentTime ||
        currentOrder.promisedTo <= currentTime
      ) {
        return [];
      }

      return [currentOrder];
    },

    updateStatus: async (_id, status) => {
      currentOrder = {
        ...currentOrder,
        status,
      };

      return currentOrder;
    },

    updateStatusIfCurrent: async (_id, expected, next) => {
      if (currentOrder.status !== expected) {
        return null;
      }

      currentOrder = {
        ...currentOrder,
        status: next,
      };

      return currentOrder;
    },

    finishPreparationIfCurrent: async () => null,

    // Activa el retiro solamente si el pedido y la ventana
    // siguen cumpliendo las condiciones esperadas.
    activatePickupIfEligible: async (
      id,
      expectedFrom,
      expectedTo,
      currentTime
    ) => {
      // Simulamos una reprogramación realizada por CocIA.
      if (reprogrammed) {
        currentOrder = {
          ...currentOrder,
          promisedFrom: new Date(
            '2026-11-04T12:20:00.000Z'
          ),
          promisedTo: new Date(
            '2026-11-04T12:25:00.000Z'
          ),
        };

        return null;
      }

      if (
        currentOrder.id !== id ||
        currentOrder.status !== 'PREPARING' ||
        !currentOrder.preparedAt ||
        !currentOrder.promisedFrom ||
        !currentOrder.promisedTo ||
        currentOrder.promisedFrom.getTime() !==
          expectedFrom.getTime() ||
        currentOrder.promisedTo.getTime() !==
          expectedTo.getTime() ||
        currentTime < currentOrder.promisedFrom ||
        currentTime >= currentOrder.promisedTo
      ) {
        return null;
      }

      currentOrder = {
        ...currentOrder,
        status: 'READY_FOR_PICKUP',
      };

      return currentOrder;
    },
  };
}

describe('ActivateEligiblePickupsUseCase', () => {
  it('activa un pedido preparado dentro de su ventana', async () => {
    const repository = createRepository();

    const activatePickup =
      new ActivatePickupWhenEligibleUseCase(
        repository,
        () => now
      );

    const useCase = new ActivateEligiblePickupsUseCase(
      repository,
      activatePickup,
      () => now
    );

    const result = await useCase.execute();

    assert.equal(result.activatedOrdersCount, 1);
    assert.deepEqual(result.orderIds, ['order-1']);

    const savedOrder = await repository.findById('order-1');

    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'READY_FOR_PICKUP');
  });

  it('no activa un pedido si su ventana fue reprogramada', async () => {
    const repository = createRepository(true);

    const activatePickup =
      new ActivatePickupWhenEligibleUseCase(
        repository,
        () => now
      );

    const useCase = new ActivateEligiblePickupsUseCase(
      repository,
      activatePickup,
      () => now
    );

    const result = await useCase.execute();

    assert.equal(result.activatedOrdersCount, 0);
    assert.deepEqual(result.orderIds, []);

    const savedOrder = await repository.findById('order-1');

    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'PREPARING');

    // La nueva ventana debe permanecer almacenada.
    assert.deepEqual(
      savedOrder.promisedFrom,
      new Date('2026-11-04T12:20:00.000Z')
    );
    assert.deepEqual(
      savedOrder.promisedTo,
      new Date('2026-11-04T12:25:00.000Z')
    );
  });
});
