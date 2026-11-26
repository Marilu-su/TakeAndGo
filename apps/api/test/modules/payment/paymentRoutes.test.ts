import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createPaymentRouter } from '../../../src/modules/payment/infrastructure/http/paymentRoutes';
import type { PaymentModule } from '../../../src/modules/payment/infrastructure/paymentModule';
import type { Order } from '../../../src/modules/order/domain/order';
import type { Actor } from '../../../src/shared/auth/actor';
import { DomainError } from '../../../src/shared/domain/DomainError';
import { domainErrorHandler } from '../../../src/shared/http/domainErrorHandler';

const order = { id: 'o1', customerId: 'c1', storeId: 's1', status: 'RESERVED', totalCents: 230000 } as Order;
const checkout = {
  paymentId: 'pay-1',
  orderId: 'o1',
  status: 'PENDING',
  amountCents: 230000,
  expiresAt: new Date('2026-11-27T15:05:00.000Z'),
  checkoutUrl: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1',
};

function app(actor: Actor | null, execute: (order: Order) => Promise<unknown> = async () => checkout) {
  const calls: Order[] = [];
  const instance = express();
  instance.use(express.json());
  instance.use(createPaymentRouter({
    resolveActor: async () => actor,
    findOrder: async id => (id === 'o1' ? order : null),
    paymentModule: {
      startCheckout: { execute: async (o: Order) => { calls.push(o); return execute(o); } },
    } as unknown as PaymentModule,
  }));
  instance.use(domainErrorHandler);
  return { instance, calls };
}

const customer: Actor = { userId: 'c1', role: 'CUSTOMER' };

test('pago: inicia el checkout del pedido propio y devuelve el link', async () => {
  const { instance, calls } = app(customer);

  const response = await request(instance).post('/orders/o1/payment');

  assert.equal(response.status, 201);
  assert.equal(response.body.checkoutUrl, checkout.checkoutUrl);
  assert.equal(response.body.expiresAt, '2026-11-27T15:05:00.000Z');
  assert.equal(calls[0].id, 'o1');
});

test('pago: exige sesión de cliente', async () => {
  assert.equal((await request(app(null).instance).post('/orders/o1/payment')).status, 401);
  assert.equal((await request(app({ userId: 'u', role: 'STORE_ADMIN' }).instance).post('/orders/o1/payment')).status, 403);
});

test('pago: oculta pedidos inexistentes o de otro cliente', async () => {
  const other = app({ userId: 'otro', role: 'CUSTOMER' });

  const foreign = await request(other.instance).post('/orders/o1/payment');
  const missing = await request(app(customer).instance).post('/orders/nope/payment');

  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, 'ORDER_NOT_FOUND');
  assert.equal(missing.status, 404);
  assert.equal(other.calls.length, 0);
});

test('pago: traduce los errores del contrato a su código HTTP', async () => {
  for (const [code, status] of [
    ['ORDER_NOT_PAYABLE', 409],
    ['RESERVATION_EXPIRED', 409],
    ['PAYMENT_PROVIDER_ERROR', 502],
  ] as const) {
    const { instance } = app(customer, async () => { throw new DomainError(code, 'error'); });
    const response = await request(instance).post('/orders/o1/payment');

    assert.equal(response.status, status);
    assert.equal(response.body.code, code);
  }
});
