
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../src/app';
import { StartPreparationUseCase } from '../../src/modules/kitchen/application/startPreparationUseCase';
import { FinishPreparationUseCase } from '../../src/modules/kitchen/application/finishPreparationUseCase';
import type { KitchenModule } from '../../src/modules/kitchen/infrastructure/kitchenModule';
import type { Order } from '../../src/modules/order/domain/order';
import type { OrderRepository } from '../../src/modules/order/domain/orderRepository';
import type { Actor } from '../../src/shared/auth/actor';

const START_URL = '/api/v1/stores/store-1/kitchen/orders/order-1/start';
const FINISH_URL = '/api/v1/stores/store-1/kitchen/orders/order-1/finish';

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
    preparedAt: null,
    preparedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };
}

function createRepository(initialOrder: Order): OrderRepository {
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

    updateStatusIfCurrent: async (id, expected, next) => {
      if (id !== order.id || order.status !== expected) {
        return null;
      }

      order = { ...order, status: next };
      return order;
    },

    finishPreparationIfCurrent: async (
      id,
      preparedAt,
      preparedByUserId
    ) => {
      if (
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

function appWith(
  actor: Actor | null,
  status: Order['status'] = 'CONFIRMED'
) {
  const repository = createRepository(createOrder(status));

  const kitchenModule: KitchenModule = {
    startPreparationUseCase: new StartPreparationUseCase(repository),
    finishPreparationUseCase: new FinishPreparationUseCase(repository),
  };

  return createApp({
    checkDatabase: async () => true,
    resolveActor: async () => actor,
    kitchenModule,
  });
}

describe('Kitchen HTTP - StartPreparation', () => {
  it('permite a un empleado iniciar la preparación', async () => {
    const response = await request(appWith(employee))
      .post(START_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 'order-1');
    assert.equal(response.body.status, 'PREPARING');
  });

  it('permite al administrador iniciar la preparación', async () => {
    const response = await request(appWith(admin))
      .post(START_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'PREPARING');
  });

  it('rechaza solicitudes sin autenticación', async () => {
    const response = await request(appWith(null))
      .post(START_URL);

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
  });

  it('rechaza a un cliente', async () => {
    const customer: Actor = {
      userId: 'customer-1',
      role: 'CUSTOMER',
    };

    const response = await request(appWith(customer))
      .post(START_URL);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const otherEmployee: Actor = {
      userId: 'employee-2',
      role: 'STORE_EMPLOYEE',
      storeId: 'store-2',
    };

    const response = await request(appWith(otherEmployee))
      .post(START_URL);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  it('rechaza iniciar un pedido no confirmado', async () => {
    const response = await request(appWith(employee, 'RESERVED'))
      .post(START_URL);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'INVALID_KITCHEN_STATE');
  });

  it('rechaza iniciar un pedido inexistente', async () => {
    const response = await request(appWith(employee))
      .post(
        '/api/v1/stores/store-1/kitchen/orders/order-inexistente/start'
      );

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'NOT_FOUND');
  });

  it('rechaza iniciar un pedido de otro buffet', async () => {
    const response = await request(appWith(employee))
      .post(
        '/api/v1/stores/store-2/kitchen/orders/order-1/start'
      );

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });
});

describe('Kitchen HTTP - FinishPreparation', () => {
  it('permite a un empleado finalizar la preparación', async () => {
    const response = await request(appWith(employee, 'PREPARING'))
      .post(FINISH_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 'order-1');
    assert.equal(response.body.status, 'PREPARING');
    assert.equal(response.body.preparedByUserId, 'employee-1');
    assert.ok(response.body.preparedAt);
  });

  it('permite al administrador finalizar la preparación', async () => {
    const response = await request(appWith(admin, 'PREPARING'))
      .post(FINISH_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.preparedByUserId, 'admin-1');
  });

  it('rechaza solicitudes sin autenticación', async () => {
    const response = await request(appWith(null, 'PREPARING'))
      .post(FINISH_URL);

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
  });

  it('rechaza a un cliente', async () => {
    const customer: Actor = {
      userId: 'customer-1',
      role: 'CUSTOMER',
    };

    const response = await request(appWith(customer, 'PREPARING'))
      .post(FINISH_URL);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const otherEmployee: Actor = {
      userId: 'employee-2',
      role: 'STORE_EMPLOYEE',
      storeId: 'store-2',
    };

    const response = await request(
      appWith(otherEmployee, 'PREPARING')
    ).post(FINISH_URL);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'FORBIDDEN');
  });

  it('rechaza finalizar un pedido no iniciado', async () => {
    const response = await request(appWith(employee, 'CONFIRMED'))
      .post(FINISH_URL);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'INVALID_KITCHEN_STATE');
  });

  it('rechaza finalizar dos veces el mismo pedido', async () => {
    const app = appWith(employee, 'PREPARING');

    const firstResponse = await request(app).post(FINISH_URL);
    const secondResponse = await request(app).post(FINISH_URL);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 409);
    assert.equal(
      secondResponse.body.code,
      'INVALID_KITCHEN_STATE'
    );
  });

  it('rechaza finalizar un pedido inexistente', async () => {
    const response = await request(appWith(employee, 'PREPARING'))
      .post(
        '/api/v1/stores/store-1/kitchen/orders/order-inexistente/finish'
      );

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'NOT_FOUND');
  });

  it('no habilita el retiro al finalizar la preparación', async () => {
    const response = await request(appWith(employee, 'PREPARING'))
      .post(FINISH_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'PREPARING');
    assert.ok(response.body.preparedAt);
  });
});
