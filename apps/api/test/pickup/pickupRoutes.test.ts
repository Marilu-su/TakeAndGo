
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../src/app';
import { ConfirmPickupUseCase } from '../../src/modules/pickup/application/confirmPickupUseCase';
import { IssuePickupTokenUseCase } from '../../src/modules/pickup/application/issuePickupTokenUseCase';
import { ManualPickupUseCase } from '../../src/modules/pickup/application/manualPickupUseCase';

import type { ConfirmPickupPort } from '../../src/modules/pickup/application/confirmPickupPort';
import type { IssuePickupTokenPort } from '../../src/modules/pickup/application/issuePickupTokenPort';
import type { ManualPickupPort } from '../../src/modules/pickup/application/manualPickupUseCase';
import type { PickupModule } from '../../src/modules/pickup/infrastructure/pickupModule';
import type { Actor } from '../../src/shared/auth/actor';

const CONFIRM_URL =
  '/api/v1/stores/store-1/pickup/orders/order-1/confirm';

const QR_URL = '/api/v1/orders/order-1/pickup/qr';

const MANUAL_URL = '/api/v1/orders/order-1/pickup/manual';

const LOOKUP_URL = '/api/v1/stores/store-1/pickup/by-code';

const manualCode = 'AbCdEf123456';

const employee: Actor = {
  userId: 'employee-1',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-1',
};

const customer: Actor = {
  userId: 'customer-1',
  role: 'CUSTOMER',
};

function appWith(
  actor: Actor | null,
  confirmError?: string
) {
  const confirmPort: ConfirmPickupPort = {
    async confirm(input) {
      if (confirmError) {
        throw new Error(confirmError);
      }

      return {
        orderId: input.orderId,
        storeId: input.storeId,
        status: 'COMPLETED',
        pickedUpAt: input.now,
      };
    },
  };

  const issuePort: IssuePickupTokenPort = {
    async issue(input) {
      return {
        token: 'test-token',
        expiresAt: new Date(
          input.now.getTime() + 300_000
        ),
      };
    },
  };

  const manualPort: ManualPickupPort = {
    async issue(orderId) {
      return {
        orderId,
        storeId: 'store-1',
        orderNumber: 1,
        code: manualCode,
      };
    },

    async findByCode(storeId) {
      return {
        orderId: 'order-1',
        storeId,
        orderNumber: 1,
        status: 'READY_FOR_PICKUP',
      };
    },
  };

  const pickupModule: PickupModule = {
    confirmPickupUseCase:
      new ConfirmPickupUseCase(confirmPort),
    issuePickupTokenUseCase:
      new IssuePickupTokenUseCase(issuePort),
    manualPickupUseCase:
      new ManualPickupUseCase(manualPort),
  };

  return createApp({
    checkDatabase: async () => true,
    resolveActor: async () => actor,
    pickupModule,
  });
}

describe('Pickup HTTP', () => {
  it('permite al cliente solicitar un QR', async () => {
    const response = await request(appWith(customer))
      .post(QR_URL);

    assert.equal(response.status, 201);
    assert.equal(response.body.token, 'test-token');
    assert.equal(
      response.headers['cache-control'],
      'no-store'
    );
  });

  it('rechaza emitir QR sin autenticación', async () => {
    const response = await request(appWith(null))
      .post(QR_URL);

    assert.equal(response.status, 401);
  });

  it('permite al cliente obtener un código manual', async () => {
    const response = await request(appWith(customer))
      .post(MANUAL_URL);

    assert.equal(response.status, 201);
    assert.equal(response.body.code, manualCode);
    assert.equal(
      response.headers['cache-control'],
      'no-store'
    );
  });

  it('rechaza emitir un código manual al personal', async () => {
    const response = await request(appWith(employee))
      .post(MANUAL_URL);

    assert.equal(response.status, 403);
  });

  it('permite buscar un pedido por código manual', async () => {
    const response = await request(appWith(employee))
      .post(LOOKUP_URL)
      .send({ code: manualCode });

    assert.equal(response.status, 200);
    assert.equal(response.body.orderId, 'order-1');
  });

  it('rechaza buscar códigos desde otro buffet', async () => {
    const response = await request(
      appWith({
        userId: 'employee-2',
        role: 'STORE_EMPLOYEE',
        storeId: 'store-2',
      })
    )
      .post(LOOKUP_URL)
      .send({ code: manualCode });

    assert.equal(response.status, 403);
  });

  it('rechaza un código manual mal formado', async () => {
    const response = await request(appWith(employee))
      .post(LOOKUP_URL)
      .send({ code: '123' });

    assert.equal(response.status, 400);
  });

  it('permite confirmar por QR', async () => {
    const response = await request(appWith(employee))
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'QR',
          token: 'test-token',
        },
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'COMPLETED');
  });

  it('permite confirmar con código manual', async () => {
    const response = await request(appWith(employee))
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'MANUAL',
          code: manualCode,
        },
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'COMPLETED');
  });

  it('rechaza confirmar sin autenticación', async () => {
    const response = await request(appWith(null))
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'QR',
          token: 'test-token',
        },
      });

    assert.equal(response.status, 401);
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const response = await request(
      appWith({
        userId: 'employee-2',
        role: 'STORE_EMPLOYEE',
        storeId: 'store-2',
      })
    )
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'QR',
          token: 'test-token',
        },
      });

    assert.equal(response.status, 403);
  });

  it('rechaza confirmar sin credencial', async () => {
    const response = await request(appWith(employee))
      .post(CONFIRM_URL)
      .send({});

    assert.equal(response.status, 400);
  });

  it('responde 422 ante un QR vencido', async () => {
    const response = await request(
      appWith(
        employee,
        'INVALID_OR_EXPIRED_PICKUP_TOKEN'
      )
    )
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'QR',
          token: 'expired-token',
        },
      });

    assert.equal(response.status, 422);
  });

  it('responde 409 si el pedido ya fue retirado', async () => {
    const response = await request(
      appWith(
        employee,
        'ORDER_NOT_READY_FOR_PICKUP'
      )
    )
      .post(CONFIRM_URL)
      .send({
        credential: {
          type: 'QR',
          token: 'test-token',
        },
      });

    assert.equal(response.status, 409);
  });
});
