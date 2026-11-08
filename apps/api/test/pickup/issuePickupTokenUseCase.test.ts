
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { IssuePickupTokenUseCase } from '../../src/modules/pickup/application/issuePickupTokenUseCase';

import type {
  IssuePickupTokenPort,
  IssuePickupTokenInput,
} from '../../src/modules/pickup/application/issuePickupTokenPort';

import type { Actor } from '../../src/shared/auth/actor';

const fixedDate = new Date('2026-11-08T12:00:00.000Z');

function createPort() {
  const calls: IssuePickupTokenInput[] = [];

  const port: IssuePickupTokenPort = {
    async issue(input) {
      calls.push(input);

      return {
        token: 'test-token',
        expiresAt: new Date(
          input.now.getTime() + 300_000
        ),
      };
    },
  };

  return { port, calls };
}

describe('IssuePickupTokenUseCase', () => {
  const customer: Actor = {
    userId: 'customer-1',
    role: 'CUSTOMER',
  };

  it('permite al cliente solicitar un QR', async () => {
    const { port, calls } = createPort();

    const useCase = new IssuePickupTokenUseCase(
      port,
      () => fixedDate
    );

    const result = await useCase.execute(
      customer,
      'order-1'
    );

    assert.equal(result.token, 'test-token');
    assert.equal(calls.length, 1);

    assert.deepEqual(calls[0], {
      orderId: 'order-1',
      customerId: 'customer-1',
      now: fixedDate,
    });
  });

  it('rechaza solicitudes del personal del buffet', async () => {
    const { port, calls } = createPort();
    const useCase = new IssuePickupTokenUseCase(port);

    const employee: Actor = {
      userId: 'employee-1',
      role: 'STORE_EMPLOYEE',
      storeId: 'store-1',
    };

    await assert.rejects(
      () => useCase.execute(employee, 'order-1'),
      { code: 'FORBIDDEN' }
    );

    assert.equal(calls.length, 0);
  });

  it('rechaza un identificador de pedido vacío', async () => {
    const { port, calls } = createPort();
    const useCase = new IssuePickupTokenUseCase(port);

    await assert.rejects(
      () => useCase.execute(customer, '   '),
      { code: 'INVALID_REQUEST' }
    );

    assert.equal(calls.length, 0);
  });
});
