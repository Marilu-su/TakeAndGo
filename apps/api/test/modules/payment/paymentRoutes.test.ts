import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHmac } from 'node:crypto';
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

const status = {
  paymentId: 'pay-1',
  orderId: 'o1',
  paymentStatus: 'APPROVED',
  orderStatus: 'CONFIRMED',
  checkoutState: 'CONFIRMED',
  amountCents: 230000,
  expiresAt: checkout.expiresAt,
};

function app(
  actor: Actor | null,
  execute: (order: Order) => Promise<unknown> = async () => checkout,
  webhookSecret?: string,
) {
  const calls: Order[] = [];
  const notifications: string[] = [];
  const instance = express();
  instance.use(express.json());
  instance.use(createPaymentRouter({
    resolveActor: async () => actor,
    findOrder: async id => (id === 'o1' ? order : null),
    paymentModule: {
      startCheckout: { execute: async (o: Order) => { calls.push(o); return execute(o); } },
      getPaymentStatus: { execute: async (o: Order) => { calls.push(o); return status; } },
      handleNotification: { execute: async (id: string) => { notifications.push(id); } },
      webhookSecret,
    } as unknown as PaymentModule,
  }));
  instance.use(domainErrorHandler);
  return { instance, calls, notifications };
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

test('estado: devuelve el estado del pago del pedido propio', async () => {
  const { instance } = app(customer);

  const response = await request(instance).get('/orders/o1/payment');

  assert.equal(response.status, 200);
  assert.equal(response.body.checkoutState, 'CONFIRMED');
  assert.equal(response.body.orderStatus, 'CONFIRMED');
});

test('estado: exige sesión de cliente y oculta pedidos ajenos', async () => {
  assert.equal((await request(app(null).instance).get('/orders/o1/payment')).status, 401);
  assert.equal((await request(app({ userId: 'otro', role: 'CUSTOMER' }).instance).get('/orders/o1/payment')).status, 404);
});

test('aviso: es público y procesa solo avisos de pagos', async () => {
  const { instance, notifications } = app(null);

  const payment = await request(instance)
    .post('/payments/webhooks/mercadopago?data.id=123&type=payment')
    .send({ type: 'payment', action: 'payment.updated', data: { id: '123' } });
  const other = await request(instance)
    .post('/payments/webhooks/mercadopago?data.id=9&type=merchant_order')
    .send({ type: 'merchant_order', data: { id: '9' } });

  assert.equal(payment.status, 200);
  assert.equal(other.status, 200);
  assert.deepEqual(notifications, ['123']);
});

test('aviso: con clave configurada exige una firma válida', async () => {
  const secret = 'clave';
  const { instance, notifications } = app(null, undefined, secret);
  const v1 = createHmac('sha256', secret).update('id:123;request-id:req-1;ts:1;').digest('hex');
  const url = '/payments/webhooks/mercadopago?data.id=123&type=payment';
  const body = { type: 'payment', data: { id: '123' } };

  const unsigned = await request(instance).post(url).send(body);
  const forged = await request(instance).post(url).set('x-signature', 'ts=1,v1=falsa').set('x-request-id', 'req-1').send(body);
  const signed = await request(instance).post(url).set('x-signature', `ts=1,v1=${v1}`).set('x-request-id', 'req-1').send(body);

  assert.equal(unsigned.status, 401);
  assert.equal(forged.status, 401);
  assert.equal(signed.status, 200);
  assert.deepEqual(notifications, ['123']);
});

test('aviso: si Mercado Pago no responde, devuelve error para que reintente', async () => {
  const instance = express();
  instance.use(express.json());
  instance.use(createPaymentRouter({
    resolveActor: async () => null,
    findOrder: async () => null,
    paymentModule: {
      handleNotification: { execute: async () => { throw new DomainError('PAYMENT_PROVIDER_ERROR', 'timeout'); } },
    } as unknown as PaymentModule,
  }));
  instance.use(domainErrorHandler);

  const response = await request(instance).post('/payments/webhooks/mercadopago?data.id=1&type=payment').send({});

  assert.equal(response.status, 502);
});
