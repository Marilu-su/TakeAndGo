
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ConfirmPickupUseCase } from '../../src/modules/pickup/application/confirmPickupUseCase';

import type {
  ConfirmPickupInput,
  ConfirmPickupPort,
} from '../../src/modules/pickup/application/confirmPickupPort';

import type { Actor } from '../../src/shared/auth/actor';

const fixedDate = new Date('2026-11-08T12:00:00.000Z');

const employee: Actor = {
  userId: 'employee-1',
  role: 'STORE_EMPLOYEE',
  storeId: 'store-1',
};

function createPort() {
  const calls: ConfirmPickupInput[] = [];

  const port: ConfirmPickupPort = {
    async confirm(input) {
      calls.push(input);

      return {
        orderId: input.orderId,
        storeId: input.storeId,
        status: 'COMPLETED',
        pickedUpAt: input.now,
      };
    },
  };

  return { port, calls };
}

describe('ConfirmPickupUseCase', () => {
  it('permite solicitar el retiro por QR al empleado del buffet', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(
      port,
      () => fixedDate
    );

    const result = await useCase.execute(
      employee,
      'store-1',
      'order-1',
      {
        type: 'QR',
        token: 'test-token',
      }
    );

    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.orderId, 'order-1');
    assert.deepEqual(result.pickedUpAt, fixedDate);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].employeeUserId, 'employee-1');
    assert.equal(calls[0].storeId, 'store-1');
    assert.deepEqual(calls[0].credential, {
      type: 'QR',
      token: 'test-token',
    });
  });

  it('permite solicitar el retiro mediante código manual', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(
      port,
      () => fixedDate
    );

    await useCase.execute(
      employee,
      'store-1',
      'order-1',
      {
        type: 'MANUAL',
        code: 'ABC123',
      }
    );

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].credential, {
      type: 'MANUAL',
      code: 'ABC123',
    });
  });

  it('rechaza a un empleado de otro buffet', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(port);

    const otherEmployee: Actor = {
      userId: 'employee-2',
      role: 'STORE_EMPLOYEE',
      storeId: 'store-2',
    };

    await assert.rejects(
      () =>
        useCase.execute(
          otherEmployee,
          'store-1',
          'order-1',
          {
            type: 'QR',
            token: 'test-token',
          }
        ),
      { code: 'FORBIDDEN' }
    );

    assert.equal(calls.length, 0);
  });

  it('rechaza a un cliente', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(port);

    const customer: Actor = {
      userId: 'customer-1',
      role: 'CUSTOMER',
    };

    await assert.rejects(
      () =>
        useCase.execute(
          customer,
          'store-1',
          'order-1',
          {
            type: 'MANUAL',
            code: 'ABC123',
          }
        ),
      { code: 'FORBIDDEN' }
    );

    assert.equal(calls.length, 0);
  });

  it('rechaza una credencial vacía', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(port);

    await assert.rejects(
      () =>
        useCase.execute(
          employee,
          'store-1',
          'order-1',
          {
            type: 'QR',
            token: '  ',
          }
        ),
      { code: 'INVALID_REQUEST' }
    );

    assert.equal(calls.length, 0);
  });

  it('rechaza identificadores vacíos', async () => {
    const { port, calls } = createPort();

    const useCase = new ConfirmPickupUseCase(port);

    await assert.rejects(
      () =>
        useCase.execute(
          employee,
          'store-1',
          '',
          {
            type: 'MANUAL',
            code: 'ABC123',
          }
        ),
      { code: 'INVALID_REQUEST' }
    );

    assert.equal(calls.length, 0);
  });

  it('propaga los errores de la operación de retiro', async () => {
    const port: ConfirmPickupPort = {
      async confirm() {
        throw new Error('ORDER_NOT_READY_FOR_PICKUP');
      },
    };

    const useCase = new ConfirmPickupUseCase(port);

    await assert.rejects(
      () =>
        useCase.execute(
          employee,
          'store-1',
          'order-1',
          {
            type: 'QR',
            token: 'test-token',
          }
        ),
      /ORDER_NOT_READY_FOR_PICKUP/
    );
  });
});
