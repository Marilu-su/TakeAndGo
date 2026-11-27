import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MercadoPagoPaymentPort,
  toMercadoPagoDate,
  toProviderStatus,
  type MercadoPagoConfig,
} from '../../../src/modules/payment/infrastructure/mercadoPagoPaymentPort';
import { createPaymentPort } from '../../../src/modules/payment/infrastructure/paymentModule';
import { FakeCheckoutPaymentPort } from '../../../src/modules/payment/infrastructure/fakeCheckoutPaymentPort';
import { DomainError } from '../../../src/shared/domain/DomainError';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const INPUT = {
  paymentId: 'pay-1',
  orderId: 'order-1',
  amountCents: 230050,
  expiresAt: new Date('2026-11-27T15:05:00.000Z'),
};

type Call = { url: string; init: RequestInit };

function port(response: Response | Error, overrides: Partial<MercadoPagoConfig> = {}) {
  const calls: Call[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;

  const adapter = new MercadoPagoPaymentPort({
    accessToken: 'TEST-token',
    frontendUrl: 'https://take-and-go-web.vercel.app/',
    publicApiUrl: 'https://api.takeandgo.test',
    useSandboxUrl: true,
    fetch: fakeFetch,
    now: () => NOW,
    ...overrides,
  });

  return { adapter, calls, body: () => JSON.parse(String(calls[0].init.body)) };
}

const okPreference = () =>
  new Response(JSON.stringify({
    id: 'pref-123',
    init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
    sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
  }), { status: 201 });

function hasCode(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

test('mercado pago: convierte fechas a hora de Argentina', () => {
  assert.equal(toMercadoPagoDate(INPUT.expiresAt), '2026-11-27T12:05:00.000-03:00');
});

test('mercado pago: crea la preferencia con monto, referencia, vencimiento y URLs', async () => {
  const { adapter, calls, body } = port(okPreference());

  const result = await adapter.createPaymentIntent(INPUT);

  assert.deepEqual(result, {
    providerPreferenceId: 'pref-123',
    checkoutUrl: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123',
  });

  assert.equal(calls[0].url, 'https://api.mercadopago.com/checkout/preferences');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer TEST-token');
  assert.equal(headers['X-Idempotency-Key'], 'pay-1');

  const sent = body();
  assert.equal(sent.items[0].unit_price, 2300.5);
  assert.equal(sent.items[0].quantity, 1);
  assert.equal(sent.items[0].currency_id, 'ARS');
  assert.equal(sent.external_reference, 'pay-1');
  assert.equal(sent.expires, true);
  assert.equal(sent.expiration_date_to, '2026-11-27T12:05:00.000-03:00');
  assert.equal(sent.back_urls.success, 'https://take-and-go-web.vercel.app/pedidos/order-1?pago=retorno');
  assert.equal(sent.auto_return, 'approved');
  assert.equal(sent.notification_url, 'https://api.takeandgo.test/api/v1/payments/webhooks/mercadopago');
  assert.deepEqual(sent.payment_methods.excluded_payment_types, [{ id: 'ticket' }, { id: 'atm' }]);
});

test('mercado pago: en local no pide vuelta automática ni webhook', async () => {
  const { adapter, body } = port(okPreference(), {
    frontendUrl: 'http://localhost:3000',
    publicApiUrl: undefined,
  });

  await adapter.createPaymentIntent(INPUT);

  assert.equal(body().auto_return, undefined);
  assert.equal(body().notification_url, undefined);
  assert.equal(body().back_urls.success, 'http://localhost:3000/pedidos/order-1?pago=retorno');
});

test('mercado pago: fuera del sandbox usa el link de producción', async () => {
  const { adapter } = port(okPreference(), { useSandboxUrl: false });

  const result = await adapter.createPaymentIntent(INPUT);

  assert.equal(result.checkoutUrl, 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-123');
});

test('mercado pago: errores del proveedor se informan como PAYMENT_PROVIDER_ERROR', async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    for (const response of [
      new Response('{"message":"invalid token"}', { status: 401 }),
      new Response('{}', { status: 500 }),
      new Response('{"id":"pref-sin-link"}', { status: 201 }),
      new Error('ECONNRESET'),
    ]) {
      const { adapter } = port(response);
      await assert.rejects(adapter.createPaymentIntent(INPUT), hasCode('PAYMENT_PROVIDER_ERROR'));
    }
  } finally {
    console.error = originalError;
  }
});

test('mercado pago: sin access token no llama al proveedor', async () => {
  const { adapter, calls } = port(okPreference(), { accessToken: undefined });

  await assert.rejects(adapter.createPaymentIntent(INPUT), hasCode('PAYMENT_PROVIDER_ERROR'));
  assert.equal(calls.length, 0);
});

test('proveedor: el simulador vuelve directo a la página del pedido', async () => {
  const fake = new FakeCheckoutPaymentPort('http://localhost:3000');

  const result = await fake.createPaymentIntent(INPUT);

  assert.equal(result.checkoutUrl, 'http://localhost:3000/pedidos/order-1?pago=retorno');
});

test('proveedor: se elige según PAYMENT_PROVIDER', async () => {
  assert.ok(createPaymentPort({}) instanceof FakeCheckoutPaymentPort);
  assert.ok(createPaymentPort({ PAYMENT_PROVIDER: 'mercadopago' }) instanceof MercadoPagoPaymentPort);
  assert.throws(() => createPaymentPort({ PAYMENT_PROVIDER: 'mercadopag' }), /PAYMENT_PROVIDER inválido/);
});

test('proveedor: el simulador nunca funciona en producción', async () => {
  const production = createPaymentPort({ PAYMENT_PROVIDER: 'fake', NODE_ENV: 'production' });

  assert.ok(!(production instanceof FakeCheckoutPaymentPort));
  await assert.rejects(production.createPaymentIntent(INPUT), hasCode('PAYMENT_PROVIDER_ERROR'));
});

const mpPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 1234567890,
  status: 'approved',
  external_reference: 'pay-1',
  transaction_amount: 2300.5,
  ...overrides,
});

test('mercado pago: traduce los estados del proveedor', () => {
  assert.equal(toProviderStatus('approved'), 'APPROVED');
  assert.equal(toProviderStatus('rejected'), 'REJECTED');
  assert.equal(toProviderStatus('cancelled'), 'REJECTED');
  for (const status of ['pending', 'in_process', 'authorized', undefined]) {
    assert.equal(toProviderStatus(status), 'PENDING');
  }
});

test('mercado pago: consulta un pago por id', async () => {
  const { adapter, calls } = port(new Response(JSON.stringify(mpPayment()), { status: 200 }));

  const payment = await adapter.getPayment('1234567890');

  assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/1234567890');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer TEST-token');
  assert.deepEqual(payment, {
    providerPaymentId: '1234567890',
    externalReference: 'pay-1',
    status: 'APPROVED',
    amountCents: 230050,
  });
});

test('mercado pago: un pago inexistente devuelve null', async () => {
  const { adapter } = port(new Response('{}', { status: 404 }));

  assert.equal(await adapter.getPayment('nope'), null);
});

test('mercado pago: busca el pago por referencia y prioriza el intento aprobado', async () => {
  const results = [
    mpPayment({ id: 3, status: 'rejected' }),
    mpPayment({ id: 2, status: 'approved' }),
    mpPayment({ id: 9, external_reference: 'otro-pago' }),
  ];
  const { adapter, calls } = port(new Response(JSON.stringify({ results }), { status: 200 }));

  const payment = await adapter.findPaymentByReference({ id: 'pay-1' });

  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/v1/payments/search');
  assert.equal(url.searchParams.get('external_reference'), 'pay-1');
  assert.equal(payment?.providerPaymentId, '2');
  assert.equal(payment?.status, 'APPROVED');
});

test('mercado pago: sin intentos de pago devuelve null', async () => {
  const { adapter } = port(new Response(JSON.stringify({ results: [] }), { status: 200 }));

  assert.equal(await adapter.findPaymentByReference({ id: 'pay-1' }), null);
});

test('mercado pago: si la consulta falla, informa PAYMENT_PROVIDER_ERROR', async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(port(new Response('{}', { status: 500 })).adapter.getPayment('1'), hasCode('PAYMENT_PROVIDER_ERROR'));
    await assert.rejects(port(new Error('timeout')).adapter.findPaymentByReference({ id: 'pay-1' }), hasCode('PAYMENT_PROVIDER_ERROR'));
  } finally {
    console.error = originalError;
  }
});

test('proveedor: el simulador aprueba el pago al consultarlo y no envía avisos', async () => {
  const fake = new FakeCheckoutPaymentPort('http://localhost:3000');

  const payment = await fake.findPaymentByReference({ id: 'pay-1', amountCents: 500 });

  assert.equal(payment.status, 'APPROVED');
  assert.equal(payment.externalReference, 'pay-1');
  assert.equal(payment.amountCents, 500);
  assert.equal(await fake.getPayment(), null);
});
