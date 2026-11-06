
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FinishPreparationUseCase } from '../../src/modules/kitchen/application/finishPreparationUseCase';
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

const fixedDate = new Date('2026-11-04T18:00:00.000Z');

function createOrder(status: Order['status'] = 'PREPARING'): Order {
  return {
    id: 'order-1',
    storeId: 'store-1',
    customerId: 'customer-1',
    orderNumber: 1,
    status,
    totalCents: 1500,
    preparedAt: null,
    preparedByUserId: null,
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
    findById: async (id) => id === order.id ? order : null,
    findByStoreAndNumber: async () => order,
    findActiveByCustomer: async () => [order],
    findExpiredReservations: async () => [],

    updateStatus: async (_id, status) => {
      order = { ...order, status };
      return order;
    },

    updateStatusIfCurrent: async (_id, expected, next) => {
      if (order.status !== expected) {
        return null;
      }

      order = { ...order, status: next };
      return order;
    },

    finishPreparationIfCurrent: async (id, preparedAt, preparedByUserId) => {
      if (
        simulateConflict ||
        id !== order.id ||
        order.status !== 'PREPARING' ||
        order.preparedAt != null
      ) {
        return null;
      }

      order = {
        ...order,
        preparedAt,
        preparedByUserId,
      };

      return order;
    },
  };
}

describe('FinishPreparationUseCase', () => {
  it('permite a un empleado finalizar la preparación', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder()),
      () => fixedDate
    );

    const result = await useCase.execute(employee, 'store-1', 'order-1');

    assert.deepEqual(result.preparedAt, fixedDate);
    assert.equal(result.preparedByUserId, 'employee-1');
    assert.equal(result.status, 'PREPARING');
  });

  it('permite al administrador finalizar la preparación', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder()),
      () => fixedDate
    );

    const result = await useCase.execute(admin, 'store-1', 'order-1');

    assert.equal(result.preparedByUserId, 'admin-1');
  });

  it('no habilita el retiro al finalizar la preparación', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder()),
      () => fixedDate
    );

    const result = await useCase.execute(employee, 'store-1', 'order-1');

    assert.equal(result.status, 'PREPARING');
    assert.notEqual(result.status, 'READY_FOR_PICKUP');
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () => useCase.execute(
        { ...employee, storeId: 'store-2' },
        'store-1',
        'order-1'
      ),
      { code: 'FORBIDDEN' }
    );
  });

  it('rechaza a un cliente', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () => useCase.execute(
        { userId: 'customer-1', role: 'CUSTOMER' },
        'store-1',
        'order-1'
      ),
      { code: 'FORBIDDEN' }
    );
  });

  it('rechaza un pedido de otro buffet', async () => {
    const order = createOrder();
    order.storeId = 'store-2';

    const useCase = new FinishPreparationUseCase(
      createRepository(order)
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'NOT_FOUND' }
    );
  });

  it('rechaza un pedido inexistente', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder())
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-inexistente'),
      { code: 'NOT_FOUND' }
    );
  });

  it('rechaza finalizar un pedido que no está en preparación', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder('CONFIRMED'))
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'INVALID_KITCHEN_STATE' }
    );
  });

  it('rechaza finalizar dos veces el mismo pedido', async () => {
    const repository = createRepository(createOrder());

    const useCase = new FinishPreparationUseCase(
      repository,
      () => fixedDate
    );

    await useCase.execute(employee, 'store-1', 'order-1');

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'INVALID_KITCHEN_STATE' }
    );
  });

  it('rechaza un conflicto de actualización concurrente', async () => {
    const useCase = new FinishPreparationUseCase(
      createRepository(createOrder(), true)
    );

    await assert.rejects(
      () => useCase.execute(employee, 'store-1', 'order-1'),
      { code: 'INVALID_KITCHEN_STATE' }
    );
  });
});
