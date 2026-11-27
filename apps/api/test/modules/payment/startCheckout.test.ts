import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CreatePaymentUseCase } from '../../../src/modules/payment/application/createPaymentUseCase';
import { StartCheckoutUseCase, type PayableOrder } from '../../../src/modules/payment/application/startCheckoutUseCase';
import { DomainError } from '../../../src/shared/domain/DomainError';
import { FakePaymentPort } from '../../support/fakePaymentPort';
import { FakePaymentRepository } from '../../support/fakePaymentRepository';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const RESERVED_UNTIL = new Date('2026-11-27T15:05:00.000Z');

function setup() {
  const repository = new FakePaymentRepository();
  const port = new FakePaymentPort();
  const createPayment = new CreatePaymentUseCase(repository, port, () => NOW);
  const useCase = new StartCheckoutUseCase(createPayment, () => NOW);
  return { repository, port, useCase };
}

const order = (overrides: Partial<PayableOrder> = {}): PayableOrder => ({
  id: 'order-1',
  status: 'RESERVED',
  totalCents: 230000,
  reservedUntil: RESERVED_UNTIL,
  ...overrides,
});

function hasCode(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

test('checkout: crea el pago por el total del pedido y vence con la reserva', async () => {
  const { useCase, port } = setup();

  const checkout = await useCase.execute(order());

  assert.equal(checkout.orderId, 'order-1');
  assert.equal(checkout.status, 'PENDING');
  assert.equal(checkout.amountCents, 230000);
  assert.equal(checkout.expiresAt.getTime(), RESERVED_UNTIL.getTime());
  assert.equal(checkout.checkoutUrl, `https://checkout.test/${checkout.paymentId}`);
  assert.deepEqual(port.createdIntents[0], {
    paymentId: checkout.paymentId,
    orderId: 'order-1',
    amountCents: 230000,
    expiresAt: RESERVED_UNTIL,
  });
});

test('checkout: repetir la solicitud devuelve el mismo pago y link sin llamar otra vez al proveedor', async () => {
  const { useCase, port } = setup();

  const first = await useCase.execute(order());
  const second = await useCase.execute(order());

  assert.deepEqual(second, first);
  assert.equal(port.createdIntents.length, 1);
});

test('checkout: rechaza pedidos que no están reservados', async () => {
  const { useCase, port } = setup();

  for (const status of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'PREPARING'] as const) {
    await assert.rejects(useCase.execute(order({ status })), hasCode('ORDER_NOT_PAYABLE'));
  }

  assert.equal(port.createdIntents.length, 0);
});

test('checkout: rechaza una reserva vencida o sin vencimiento', async () => {
  const { useCase, port } = setup();

  await assert.rejects(useCase.execute(order({ reservedUntil: NOW })), hasCode('RESERVATION_EXPIRED'));
  await assert.rejects(useCase.execute(order({ reservedUntil: null })), hasCode('RESERVATION_EXPIRED'));

  assert.equal(port.createdIntents.length, 0);
});

test('checkout: si el pedido cambió de monto, no reutiliza el pago anterior', async () => {
  const { useCase } = setup();

  await useCase.execute(order());

  await assert.rejects(useCase.execute(order({ totalCents: 999 })), hasCode('ORDER_NOT_PAYABLE'));
});

test('checkout: un error del proveedor no deja link guardado y se puede reintentar', async () => {
  const { useCase, port, repository } = setup();
  const original = port.createPaymentIntent.bind(port);
  let attempts = 0;

  port.createPaymentIntent = async input => {
    attempts++;
    if (attempts === 1) throw new DomainError('PAYMENT_PROVIDER_ERROR', 'Mercado Pago no respondió');
    return original(input);
  };

  await assert.rejects(useCase.execute(order()), hasCode('PAYMENT_PROVIDER_ERROR'));
  assert.equal((await repository.findByOrderId('order-1'))?.checkoutUrl, null);

  const checkout = await useCase.execute(order());
  assert.ok(checkout.checkoutUrl);
  assert.equal(attempts, 2);
});
