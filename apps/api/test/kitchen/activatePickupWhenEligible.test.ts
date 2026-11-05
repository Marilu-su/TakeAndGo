
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ActivatePickupWhenEligibleUseCase } from '../../src/modules/kitchen/application/activatePickupWhenEligibleUseCase';
import type { Order } from '../../src/modules/order/domain/order';
import type { OrderRepository } from '../../src/modules/order/domain/orderRepository';

const order: Order = {
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

function createRepository(
  initialOrder: Order = order
): OrderRepository {
  let currentOrder = { ...initialOrder };

  return {
    create: async () => currentOrder,

    findById: async (id) =>
      id === currentOrder.id ? currentOrder : null,

    findByStoreAndNumber: async () => currentOrder,

    findActiveByCustomer: async () => [currentOrder],

    findExpiredReservations: async () => [],

    updateStatus: async (_id, status) => {
      currentOrder = { ...currentOrder, status };
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

    // Activa el retiro solamente si el pedido y su ventana
    // siguen cumpliendo todas las condiciones.
    activatePickupIfEligible: async (
      id,
      expectedPromisedFrom,
      expectedPromisedTo,
      now
    ) => {
      if (
        currentOrder.id !== id ||
        currentOrder.status !== 'PREPARING' ||
        !currentOrder.preparedAt ||
        !currentOrder.promisedFrom ||
        !currentOrder.promisedTo ||
        currentOrder.promisedFrom.getTime() !==
          expectedPromisedFrom.getTime() ||
        currentOrder.promisedTo.getTime() !==
          expectedPromisedTo.getTime() ||
        now < currentOrder.promisedFrom ||
        now >= currentOrder.promisedTo
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

describe('ActivatePickupWhenEligibleUseCase', () => {
  it('no habilita el retiro antes de la ventana prometida', async () => {
    const repository = createRepository();

    const now = () => new Date('2026-11-04T11:50:00.000Z');

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      now
    );

    await useCase.execute('order-1');

    const savedOrder = await repository.findById('order-1');

    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'PREPARING');
  });

  it('habilita el retiro cuando comienza la ventana prometida', async () => {
    const repository = createRepository();

    // Cocina terminó a las 11:45.
    // La ventana comienza a las 12:00.
    const now = () => new Date('2026-11-04T12:00:00.000Z');

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      now
    );

    const updated = await useCase.execute('order-1');

    assert.equal(updated.status, 'READY_FOR_PICKUP');

    const savedOrder = await repository.findById('order-1');

    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'READY_FOR_PICKUP');
  });

  it('no habilita el retiro si cocina no terminó la preparación', async () => {
    const repository = createRepository({
      ...order,
      preparedAt: null,
      preparedByUserId: null,
    });

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      () => new Date('2026-11-04T12:00:00.000Z')
    );

    const result = await useCase.execute('order-1');

    assert.equal(result.status, 'PREPARING');
  });

  it('no habilita el retiro si falta la ventana prometida', async () => {
    const repository = createRepository({
      ...order,
      promisedFrom: null,
      promisedTo: null,
    });

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      () => new Date('2026-11-04T12:00:00.000Z')
    );

    const result = await useCase.execute('order-1');

    assert.equal(result.status, 'PREPARING');
  });

  it('no habilita el retiro con una ventana vencida', async () => {
    const repository = createRepository();

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      () => new Date('2026-11-04T12:12:00.000Z')
    );

    const result = await useCase.execute('order-1');

    assert.equal(result.status, 'PREPARING');
  });

  it('no habilita el retiro si CocIA reprograma la ventana durante la operación', async () => {
    const promisedFrom = new Date('2026-11-04T12:00:00.000Z');
    const promisedTo = new Date('2026-11-04T12:05:00.000Z');

    const repository = createRepository({
      ...order,
      promisedFrom,
      promisedTo,
    });

    const originalUpdate =
      repository.activatePickupIfEligible.bind(repository);

    // Simulamos que CocIA reprograma la ventana
    // justo antes de actualizar el estado.
    repository.activatePickupIfEligible = async (
      id,
      expectedPromisedFrom,
      expectedPromisedTo,
      now
    ) => {
      promisedFrom.setTime(
        new Date('2026-11-04T12:20:00.000Z').getTime()
      );

      promisedTo.setTime(
        new Date('2026-11-04T12:25:00.000Z').getTime()
      );

      return originalUpdate(
        id,
        expectedPromisedFrom,
        expectedPromisedTo,
        now
      );
    };

    const useCase = new ActivatePickupWhenEligibleUseCase(
      repository,
      () => new Date('2026-11-04T12:01:00.000Z')
    );

    const result = await useCase.execute('order-1');

    assert.equal(result.status, 'PREPARING');

    const savedOrder = await repository.findById('order-1');

    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'PREPARING');

    // Comprobamos que la ventana sí fue reprogramada.
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
