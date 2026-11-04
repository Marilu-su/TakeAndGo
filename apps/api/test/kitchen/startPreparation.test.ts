
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { StartPreparationUseCase } from '../../src/modules/kitchen/application/startPreparationUseCase';
import type { Actor } from '../../src/shared/auth/actor';
import type { Order } from '../../src/modules/order/domain/order';
import type { OrderRepository } from '../../src/modules/order/domain/orderRepository';

const employee: Actor = {
  userId: 'employee-1',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-1',
};

const admin: Actor = {
  userId: 'admin-1',
  role: 'STORE_ADMIN',
  storeId: 'store-1',
};

function createOrder(status: Order['status'] = 'CONFIRMED'): Order {
  return {
    id: 'order-1',
    storeId: 'store-1',
    customerId: 'customer-1',
    orderNumber: 1,
    status,
    totalCents: 1500,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };
}

function createRepository(
  initialOrder: Order,
  simulateConflict = false
): OrderRepository {
  let order = initialOrder;

  return {
    create: async () => order,

    findById: async () => order,

    findByStoreAndNumber: async () => order,

    findActiveByCustomer: async () => [order],

    findExpiredReservations: async () => [],

    updateStatus: async (_id, status) => {
      order = { ...order, status };
      return order;
    },

    updateStatusIfCurrent: async (_id, expected, next) => {
      if (simulateConflict || order.status !== expected) {
        return null;
      }

      order = { ...order, status: next };
      return order;
    },
  };
}

describe('StartPreparationUseCase', () => {
  it('permite a un empleado iniciar un pedido confirmado', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder())
    );

    const result = await useCase.execute(
      employee,
      'store-1',
      'order-1'
    );

    assert.equal(result.status, 'PREPARING');
  });

  it('permite al administrador del buffet iniciar la preparación', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder())
    );

    const result = await useCase.execute(
      admin,
      'store-1',
      'order-1'
    );

    assert.equal(result.status, 'PREPARING');
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () =>
        useCase.execute(
          { ...employee, storeId: 'store-2' },
          'store-1',
          'order-1'
        ),
      { code: 'FORBIDDEN' }
    );
  });

  it('rechaza a un cliente', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () =>
        useCase.execute(
          { userId: 'customer-1', role: 'CUSTOMER' },
          'store-1',
          'order-1'
        ),
      { code: 'FORBIDDEN' }
    );
  });

  it('rechaza iniciar un pedido no confirmado', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder('RESERVED'))
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'INVALID_KITCHEN_STATE' }
    );
  });

  it('rechaza una actualización concurrente', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder(), true)
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'INVALID_KITCHEN_STATE' }
    );
  });

  // Nuevos tests: validación del buffet solicitado

  it('rechaza iniciar preparación indicando otro buffet', async () => {
    const useCase = new StartPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-2', 'order-1'),
      { code: 'FORBIDDEN' }
    );
  });

  it('rechaza un pedido que no pertenece al buffet solicitado', async () => {
    const order = createOrder();
    order.storeId = 'store-2';

    const useCase = new StartPreparationUseCase(
      createRepository(order)
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'NOT_FOUND' }
    );
  });
});
