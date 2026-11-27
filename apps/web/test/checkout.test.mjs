import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { ApiError } from '../src/lib/api.ts';

const require = createRequire(import.meta.url);
const jsxRuntime = JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href);

// Resolve the same extensionless imports as the existing session tests.
async function moduleUrl(file, dependencies) {
  let source = await readFile(new URL(file, import.meta.url), 'utf8');
  for (const [name, url] of Object.entries(dependencies)) {
    source = source.replace(`'${name}'`, JSON.stringify(url));
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText.replace('"react/jsx-runtime"', jsxRuntime)).toString('base64')}`;
}

const api = new URL('../src/lib/api.ts', import.meta.url).href;
const session = await moduleUrl('../src/lib/session.ts', { './api': api });
const checkoutModule = await moduleUrl('../src/lib/checkout.ts', { './api': api, './session': session });
const {
  startCheckout, getCheckoutStatus, isSafeCheckoutUrl, checkoutSecondsRemaining,
  canStartCheckout, formatCheckoutTime, shouldPollCheckout, isTerminalCheckoutState, checkoutMessage, checkoutErrorCode,
  isCheckoutReturn,
  checkoutFailure, checkoutPresentation,
} = await import(checkoutModule);
const { orderPickupSummary } = await import('../src/lib/pickup-windows.ts');
const { startCheckoutPolling } = await import(await moduleUrl('../src/lib/checkout-polling.ts', {
  './checkout': checkoutModule,
}));

const base = 'https://api.example.test';
const expiresAt = '2026-11-27T15:05:00.000Z';
const payment = { paymentId: 'p1', orderId: 'o1', amountCents: 230000, expiresAt };

function mockSession(t, respond) {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = base;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt-test' });
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-test');
    return respond(url, options);
  });
}

test('inicia el checkout con POST autenticado, ID codificado y sin cuerpo', async (t) => {
  const response = { ...payment, status: 'PENDING', checkoutUrl: 'https://sandbox.example.test/checkout?ref=a%2Fb' };
  mockSession(t, (url, options) => {
    assert.equal(url, `${base}/api/v1/orders/pedido%2F%3F%20uno/payment`);
    assert.equal(options.method, 'POST');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.has('Content-Type'), false);
    return Response.json(response, { status: 201 });
  });
  assert.deepEqual(await startCheckout('pedido/? uno'), response);
});

test('conserva la URL relativa de retorno del proveedor fake', async (t) => {
  const checkoutUrl = '/pedidos/o1?pago=retorno';
  mockSession(t, () => Response.json({ ...payment, status: 'PENDING', checkoutUrl }, { status: 201 }));
  assert.equal((await startCheckout('o1')).checkoutUrl, checkoutUrl);
  assert.equal(isSafeCheckoutUrl(checkoutUrl, 'http://localhost:3000'), true);
});

test('consulta con GET autenticado y conserva separados los estados devueltos', async (t) => {
  const response = { ...payment, paymentStatus: 'APPROVED', orderStatus: 'PREPARING', checkoutState: 'CONFIRMED' };
  mockSession(t, (url, options) => {
    assert.equal(url, `${base}/api/v1/orders/o%2F1/payment`);
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    return Response.json(response);
  });
  assert.deepEqual(await getCheckoutStatus('o/1'), response);
});

test('permite HTTPS y el fake del mismo origen, y rechaza destinos inseguros', () => {
  const origin = 'http://localhost:3000';
  assert.equal(isSafeCheckoutUrl('https://sandbox.example.test/checkout', origin), true);
  assert.equal(isSafeCheckoutUrl(`${origin}/pedidos/o1?pago=retorno`, origin), true);
  for (const value of [
    '', null, { url: 'https://example.test' }, 'javascript:alert(1)', 'data:text/html,foo', 'file:///tmp/foo', 'http://example.test',
    '//example.test', '/\\example.test', '\t//example.test', 'https://user:pass@example.test', 'https://[bad',
  ]) assert.equal(isSafeCheckoutUrl(value, origin), false, value);
});

test('solo permite iniciar un pedido RESERVED con una reserva vigente', () => {
  const order = { status: 'RESERVED', reservedUntil: expiresAt };
  const deadline = Date.parse(expiresAt);
  assert.equal(canStartCheckout(order, deadline - 1), true);
  assert.equal(canStartCheckout(order, deadline), false);
  assert.equal(canStartCheckout(order, deadline + 1), false);
  assert.equal(canStartCheckout({ ...order, reservedUntil: null }, deadline - 1), false);
  for (const status of ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED']) {
    assert.equal(canStartCheckout({ ...order, status }, deadline - 1), false, status);
  }
});

test('usa los cinco mensajes de MVP-05 y solo PENDING permite seguir consultando', () => {
  const messages = {
    PENDING: 'Esperando confirmación del pago',
    CONFIRMED: 'Pago aprobado. Tu pedido está confirmado',
    REJECTED: 'El pago fue rechazado',
    EXPIRED: 'Se venció el tiempo para pagar',
    CANCELLED: 'Cancelaste el pedido',
  };
  for (const [state, message] of Object.entries(messages)) {
    assert.equal(checkoutMessage(state), message);
    assert.equal(shouldPollCheckout(state), state === 'PENDING');
    assert.equal(isTerminalCheckoutState(state), state !== 'PENDING');
  }
});

test('calcula y formatea tiempo positivo, cero y vencido con reloj fijo', () => {
  assert.equal(checkoutSecondsRemaining(expiresAt, Date.parse('2026-11-27T15:03:56.500Z')), 64);
  assert.equal(checkoutSecondsRemaining(expiresAt, Date.parse(expiresAt)), 0);
  assert.equal(checkoutSecondsRemaining(expiresAt, Date.parse(expiresAt) + 1_000), 0);
  assert.equal(checkoutSecondsRemaining('inválido', Date.parse(expiresAt)), 0);
  assert.equal(formatCheckoutTime(64), '01:04');
  assert.equal(formatCheckoutTime(0), '00:00');
});

test('el reloj a cero conserva PENDING y la decisión de volver a consultar', () => {
  const response = { ...payment, checkoutState: 'PENDING' };
  assert.equal(checkoutSecondsRemaining(response.expiresAt, Date.parse(expiresAt)), 0);
  assert.equal(response.checkoutState, 'PENDING');
  assert.equal(shouldPollCheckout(response.checkoutState), true);
});

test('propaga los errores HTTP de checkout con su ApiError y código original', async (t) => {
  const errors = [
    [401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'ORDER_NOT_FOUND'], [404, 'PAYMENT_NOT_FOUND'],
    [409, 'ORDER_NOT_PAYABLE'], [409, 'RESERVATION_EXPIRED'], [502, 'PAYMENT_PROVIDER_ERROR'],
  ];
  let current;
  mockSession(t, () => Response.json({ error: 'Error simulado', code: current[1] }, { status: current[0] }));
  for (const [status, code] of errors) {
    current = [status, code];
    const request = status >= 409 ? startCheckout : getCheckoutStatus;
    await assert.rejects(request('o1'), error => (
      error instanceof ApiError && error.status === status &&
      error.message === 'Error simulado' && checkoutErrorCode(error) === code
    ));
  }
});

test('propaga un fallo de red como error técnico sin estado de negocio', async (t) => {
  mockSession(t, () => { throw new TypeError('offline'); });
  await assert.rejects(getCheckoutStatus('o1'), error => (
    error instanceof ApiError && error.status === undefined && checkoutErrorCode(error) === undefined
  ));
  assert.equal(checkoutErrorCode(new Error('RESERVATION_EXPIRED')), undefined);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function pollingFixture(t, request) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const states = [];
  const errors = [];
  function start() {
    const stop = startCheckoutPolling({
      request,
      onStatus: status => states.push(status.checkoutState),
      onError: error => errors.push(error),
    });
    t.after(stop);
    return stop;
  }
  return { states, errors, start };
}

test('solo pago=retorno activa la consulta inicial; los datos del proveedor no determinan el resultado', async (t) => {
  const status = { ...payment, paymentStatus: 'PENDING', orderStatus: 'RESERVED', checkoutState: 'PENDING' };
  let requests = 0;
  mockSession(t, () => { requests++; return Response.json(status); });
  const polling = pollingFixture(t, () => getCheckoutStatus('o1'));
  for (const pago of [undefined, 'approved', ['retorno', 'approved']]) {
    if (isCheckoutReturn(pago)) polling.start();
  }
  await flush();
  assert.equal(requests, 0);

  const query = new URLSearchParams('pago=retorno&status=approved&collection_status=rejected');
  assert.equal(isCheckoutReturn(query.get('pago')), true);
  polling.start();
  await flush();
  assert.equal(requests, 1);
  assert.deepEqual(polling.states, ['PENDING']);
});

for (const terminal of ['CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED']) {
  test(`consulta PENDING y luego ${terminal}; espera tres segundos y se detiene`, async (t) => {
    const results = ['PENDING', terminal];
    let calls = 0;
    const polling = pollingFixture(t, async () => ({ checkoutState: results[calls++] }));
    polling.start();
    await flush();
    assert.equal(calls, 1);
    t.mock.timers.tick(2999);
    assert.equal(calls, 1);
    t.mock.timers.tick(1);
    await flush();
    assert.deepEqual(polling.states, ['PENDING', terminal]);
    t.mock.timers.tick(9000);
    assert.equal(calls, 2);
  });
}

test('no solapa solicitudes y evita un GET mientras la cancelación tiene el bloqueo', async (t) => {
  let allowed = true;
  let release;
  let calls = 0;
  const polling = pollingFixture(t, async () => {
    if (!allowed) return;
    calls++;
    return new Promise(resolve => { release = resolve; });
  });
  polling.start();
  await flush();
  t.mock.timers.tick(12_000);
  assert.equal(calls, 1);
  release({ checkoutState: 'PENDING' });
  await flush();
  allowed = false;
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(calls, 1);
  allowed = true;
  t.mock.timers.tick(3000);
  assert.equal(calls, 2);
  release({ checkoutState: 'CANCELLED' });
  await flush();
  assert.deepEqual(polling.states, ['PENDING', 'CANCELLED']);
});

test('limpia temporizadores, evita un arranque descartado e ignora una respuesta atrasada', async (t) => {
  let calls = 0;
  let release;
  const polling = pollingFixture(t, async () => {
    calls++;
    if (calls === 1) return { checkoutState: 'PENDING' };
    return new Promise(resolve => { release = resolve; });
  });
  polling.start()();
  const stopFirst = polling.start();
  await flush();
  assert.equal(calls, 1);
  stopFirst();
  t.mock.timers.tick(3000);
  assert.equal(calls, 1);
  const stopNext = polling.start();
  await flush();
  assert.equal(calls, 2);
  stopNext();
  release({ checkoutState: 'CONFIRMED' });
  await flush();
  assert.deepEqual(polling.states, ['PENDING']);
});

test('conserva el último estado tras un error y recupera con una consulta explícita', async (t) => {
  let calls = 0;
  const failure = new ApiError('Proveedor temporalmente inaccesible', 502, 'PAYMENT_PROVIDER_ERROR');
  const polling = pollingFixture(t, async () => {
    calls++;
    if (calls === 1) return { checkoutState: 'PENDING' };
    if (calls === 2) throw failure;
    return { checkoutState: 'CONFIRMED' };
  });
  const stop = polling.start();
  await flush();
  t.mock.timers.tick(3000);
  await flush();
  assert.deepEqual(polling.states, ['PENDING']);
  assert.deepEqual(polling.errors, [failure]);
  assert.equal(checkoutFailure(failure, 'status').retry, true);
  assert.equal(checkoutPresentation({ status: 'RESERVED', reservedUntil: expiresAt }, polling.states.at(-1)).canPay, false);
  t.mock.timers.tick(9000);
  assert.equal(calls, 2);
  stop();
  polling.start();
  await flush();
  assert.deepEqual(polling.states, ['PENDING', 'CONFIRMED']);
});

const beforeExpiry = Date.parse(expiresAt) - 1000;
const reservation = { status: 'RESERVED', reservedUntil: expiresAt };

test('PENDING bloquea otro pago y permite consultar o cancelar una reserva', () => {
  const view = checkoutPresentation(reservation, 'PENDING', beforeExpiry);
  assert.equal(view.state, 'PENDING');
  assert.equal(view.canPay, false);
  assert.equal(view.canCheck, true);
  assert.equal(view.canCancel, true);
});

test('CONFIRMED impide pagar o cancelar aun si el detalle dice RESERVED', () => {
  for (const status of ['RESERVED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED']) {
    const order = { ...reservation, status };
    const view = checkoutPresentation(order, 'CONFIRMED', beforeExpiry);
    assert.equal(view.state, 'CONFIRMED');
    assert.equal(view.canPay, false);
    assert.equal(view.canCancel, false);
    assert.equal(view.canCheck, false);
    assert.equal(view.historicalPickup, false);
    assert.equal(order.status, status);
  }
});

test('EXPIRED y REJECTED ocultan acciones de pago sobre un detalle desactualizado y ofrecen volver al catálogo', () => {
  for (const state of ['EXPIRED', 'REJECTED']) {
    const view = checkoutPresentation(reservation, state, beforeExpiry);
    assert.equal(view.state, state);
    assert.equal(view.canPay, false);
    assert.equal(view.canCancel, false);
    assert.equal(view.canCheck, false);
    assert.equal(view.canReturnToCatalog, true);
    assert.equal(view.historicalPickup, true);
  }
  assert.equal(reservation.status, 'RESERVED');
});

test('muestra CANCELLED con el estado de pago o con el pedido cancelado sin pago previo', () => {
  const cancelled = { ...reservation, status: 'CANCELLED' };
  for (const view of [
    checkoutPresentation(cancelled, undefined, beforeExpiry),
    checkoutPresentation(reservation, 'CANCELLED', beforeExpiry),
  ]) {
    assert.equal(view.state, 'CANCELLED');
    assert.equal(view.canPay, false);
    assert.equal(view.canCancel, false);
    assert.equal(view.canCheck, false);
    assert.equal(view.historicalPickup, true);
  }
});

test('conserva el horario de retiro original para pedidos históricos', () => {
  const order = {
    ...reservation,
    promisedFrom: '2026-11-27T15:45:00.000Z',
    promisedTo: '2026-11-27T15:50:00.000Z',
    toleranceUntil: '2026-11-27T15:55:00.000Z',
  };
  const original = orderPickupSummary(order);
  for (const state of ['REJECTED', 'EXPIRED', 'CANCELLED']) {
    assert.equal(checkoutPresentation(order, state, beforeExpiry).historicalPickup, true);
    assert.deepEqual(orderPickupSummary(order), original);
  }
  assert.match(original.window, /12:45–12:50/);
  assert.equal(original.tolerance, '12:55');
});

test('PAYMENT_NOT_FOUND conserva la posibilidad de iniciar una reserva vigente y pide refrescar el pedido', () => {
  const failure = checkoutFailure(new ApiError('Detalle del servidor', 404, 'PAYMENT_NOT_FOUND'), 'status');
  assert.match(failure.message, /no hay un pago iniciado/);
  assert.equal(failure.retry, true);
  assert.equal(failure.refreshOrder, true);
  const view = checkoutPresentation(reservation, undefined, beforeExpiry);
  assert.equal(view.state, undefined);
  assert.equal(view.canPay, true);
});

test('los errores técnicos tienen textos por acción y no se convierten en estados de negocio', () => {
  const network = new ApiError('Detalle interno del transporte');
  const start = checkoutFailure(network, 'start');
  const check = checkoutFailure(network, 'status');
  assert.match(start.message, /inicio del pago/);
  assert.match(check.message, /consultar el pago/);
  assert.equal(start.retry && check.retry, true);
  assert.doesNotMatch(check.message, /Detalle interno|rechazado|venció/);
  for (const [status, code] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'ORDER_NOT_FOUND']]) {
    assert.equal(checkoutFailure(new ApiError('Detalle interno', status, code), 'status').retry, false);
  }
  assert.equal(checkoutFailure(new ApiError('Sesión local', 401), 'start').retry, false);
  for (const code of ['ORDER_NOT_PAYABLE', 'RESERVATION_EXPIRED']) {
    const failure = checkoutFailure(new ApiError('Detalle interno', 409, code), 'start');
    assert.equal(failure.refreshOrder, true);
    assert.equal(failure.retry, false);
  }
  assert.equal(checkoutPresentation(reservation, undefined, Date.parse(expiresAt)).state, undefined);
});

test('un fallo en la primera consulta al volver no habilita otro pago; PAYMENT_NOT_FOUND sí', () => {
  const verifyPayment = true;
  for (const [error, canPay] of [
    [new ApiError('Sin conexión'), false],
    [new ApiError('Proveedor caído', 502, 'PAYMENT_PROVIDER_ERROR'), false],
    [new ApiError('Sin pago', 404, 'PAYMENT_NOT_FOUND'), true],
  ]) {
    const failure = checkoutFailure(error, 'status');
    const view = checkoutPresentation(reservation, undefined, beforeExpiry,
      !verifyPayment || failure.paymentNotFound === true);
    assert.equal(view.canPay, canPay);
    assert.equal(view.state, undefined);
    assert.equal(view.canCheck, true);
  }
});

test('el panel real conserva PENDING ante un error y ofrece consultar, no pagar otra vez', async () => {
  const link = pathToFileURL(require.resolve('next/link')).href;
  const { OrderCheckout } = await import(await moduleUrl('../src/components/order-checkout.tsx', {
    'next/link': link,
    '@/lib/checkout': checkoutModule,
  }));
  const view = checkoutPresentation(reservation, 'PENDING', beforeExpiry);
  const failure = checkoutFailure(new ApiError('Fallo de red'), 'status');
  const html = renderToStaticMarkup(createElement(OrderCheckout, {
    state: view.state, canPay: view.canPay, canCheck: view.canCheck && failure.retry,
    polling: false, secondsLeft: 0, error: failure.message, orderStillReserved: true,
  }));
  assert.match(html, /role="status">Esperando confirmación del pago/);
  assert.match(html, /role="timer" aria-live="off">00:00/);
  assert.match(html, /role="alert"[^>]*>No se pudo consultar el pago/);
  assert.match(html, /Consultar estado del pago/);
  assert.doesNotMatch(html, /Pagar con Mercado Pago|Se venció el tiempo para pagar/);
});
