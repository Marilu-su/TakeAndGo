import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkoutStateOf,
  GetPaymentStatusUseCase,
} from '../../../src/modules/payment/application/getPaymentStatusUseCase';
import type { Order } from '../../../src/modules/order/domain/order';
import type { Payment } from '../../../src/modules/payment/domain/payment';
import { DomainError } from '../../../src/shared/domain/DomainError';
import { FakePaymentRepository } from '../../support/fakePaymentRepository';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const LATER = new Date('2026-11-27T15:05:00.000Z');

test('estado del checkout: traduce pago y pedido al estado de la pantalla', () => {
  const cases: Array<[Payment['status'], Order['status'], Date, string]> = [
    ['PENDING', 'RESERVED', LATER, 'PENDING'],
    ['PENDING', 'RESERVED', NOW, 'EXPIRED'],
    ['PENDING', 'EXPIRED', LATER, 'EXPIRED'],
    ['APPROVED', 'CONFIRMED', LATER, 'CONFIRMED'],
    ['APPROVED', 'PREPARING', NOW, 'CONFIRMED'],
    ['APPROVED', 'READY_FOR_PICKUP', NOW, 'CONFIRMED'],
    ['REJECTED', 'CANCELLED', LATER, 'REJECTED'],
    ['PENDING', 'CANCELLED', LATER, 'CANCELLED'],
    ['REFUNDED', 'EXPIRED', NOW, 'EXPIRED'],
    ['APPROVED', 'EXPIRED', NOW, 'EXPIRED'],
  ];

  for (const [paymentStatus, orderStatus, expiresAt, expected] of cases) {
    assert.equal(checkoutStateOf(paymentStatus, orderStatus, expiresAt, NOW), expected, `${paymentStatus}/${orderStatus}`);
  }
});

function order(status: Order['status'] = 'RESERVED'): Order {
  return { id: 'order-1', customerId: 'c1', status } as Order;
}

test('estado: sin pago iniciado responde PAYMENT_NOT_FOUND', async () => {
  const useCase = new GetPaymentStatusUseCase(new FakePaymentRepository(), { syncPending: async () => {} }, async () => null, () => NOW);

  await assert.rejects(
    useCase.execute(order()),
    (error: unknown) => error instanceof DomainError && error.code === 'PAYMENT_NOT_FOUND',
  );
});

test('estado: consulta al proveedor y devuelve el pedido ya confirmado', async () => {
  const repository = new FakePaymentRepository();
  const payment = await repository.create({ orderId: 'order-1', amountCents: 500, expiresAt: LATER });
  let currentOrder = order('RESERVED');

  const useCase = new GetPaymentStatusUseCase(
    repository,
    {
      syncPending: async p => {
        await repository.transitionStatus(p.id, 'PENDING', 'APPROVED');
        currentOrder = order('CONFIRMED');
      },
    },
    async () => currentOrder,
    () => NOW,
  );

  const status = await useCase.execute(order('RESERVED'));

  assert.deepEqual(status, {
    paymentId: payment.id,
    orderId: 'order-1',
    paymentStatus: 'APPROVED',
    orderStatus: 'CONFIRMED',
    checkoutState: 'CONFIRMED',
    amountCents: 500,
    expiresAt: LATER,
  });
});

test('estado: si el proveedor falla, informa el último estado conocido', async () => {
  const repository = new FakePaymentRepository();
  await repository.create({ orderId: 'order-1', amountCents: 500, expiresAt: LATER });
  const originalError = console.error;
  console.error = () => {};

  try {
    const useCase = new GetPaymentStatusUseCase(
      repository,
      { syncPending: async () => { throw new Error('timeout'); } },
      async () => order(),
      () => NOW,
    );

    const status = await useCase.execute(order());
    assert.equal(status.checkoutState, 'PENDING');
  } finally {
    console.error = originalError;
  }
});

test('estado: un pago ya resuelto no vuelve a consultar al proveedor', async () => {
  const repository = new FakePaymentRepository();
  const payment = await repository.create({ orderId: 'order-1', amountCents: 500, expiresAt: LATER });
  await repository.transitionStatus(payment.id, 'PENDING', 'APPROVED');
  let calls = 0;

  const useCase = new GetPaymentStatusUseCase(repository, { syncPending: async () => { calls++; } }, async () => null, () => NOW);
  const status = await useCase.execute(order('PREPARING'));

  assert.equal(calls, 0);
  assert.equal(status.checkoutState, 'CONFIRMED');
});
