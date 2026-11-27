import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadTs } from './helpers/load-ts.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver']) globalThis[key] = dom.window[key];
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement, StrictMode } = await import('react');
const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');
const { default: QRCode } = await import('react-qr-code');
const { OrderDetail } = await loadTs('components/order-view.tsx');
const { default: Page } = await loadTs('app/(customer)/pedidos/[id]/page.tsx');
afterEach(cleanup);

function mockCheckoutTimers(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => {
    try {
      cleanup();
    } finally {
      t.mock.timers.reset();
    }
  });
}

function order(id, overrides = {}) {
  return {
    id, storeId: 'demo', orderNumber: id === 'o1' ? 1 : 2, status: 'RESERVED',
    totalCents: 100, reservedUntil: new Date(Date.now() + 60_000).toISOString(),
    createdAt: '2026-11-27T15:15:00Z',
    promisedFrom: '2026-11-27T15:45:00Z', promisedTo: '2026-11-27T15:50:00Z',
    toleranceUntil: '2026-11-27T15:55:00Z',
    items: [{ productNameSnapshot: 'Producto', quantity: 1, subtotalCents: 100, additions: [] }],
    ...overrides,
  };
}

function payment(id, checkoutState, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return Response.json({
    paymentId: 'p-' + id, orderId: id, amountCents: 100, expiresAt, checkoutState,
    paymentStatus: checkoutState === 'CONFIRMED' ? 'APPROVED' : 'PENDING',
    orderStatus: checkoutState === 'CONFIRMED' ? 'CONFIRMED' : 'RESERVED',
  });
}

function deferred() {
  let resolve;
  const response = new Promise(resolvePromise => { resolve = resolvePromise; });
  return { response, resolve };
}

function mockOrders(t, handle, getOrder = order) {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  });
  const actions = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt-prueba' });
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-prueba');
    const [, id, action] = new URL(url).pathname.match(/^\/api\/v1\/orders\/([^/]+)(?:\/(.+))?$/) ?? [];
    assert.ok(id, url);
    if (!action) return Response.json(getOrder(id));
    const request = { id, action, method: options.method, body: options.body };
    actions.push(request);
    return handle(request);
  });
  return actions;
}

const detail = (id = 'o1', returnedFromCheckout = false) => createElement(OrderDetail, { id, returnedFromCheckout });

test('checkout DOM: el doble clic y cancelar mientras inicia producen un solo POST de pago', async t => {
  const pending = deferred();
  const actions = mockOrders(t, () => pending.response);
  const view = render(detail());
  const pay = await view.findByRole('button', { name: 'Pagar con Mercado Pago' });
  const cancel = view.getByRole('button', { name: 'Cancelar reserva' });
  await act(async () => {
    fireEvent.click(pay);
    fireEvent.click(pay);
    fireEvent.click(cancel);
  });
  assert.deepEqual(actions, [{ id: 'o1', action: 'payment', method: 'POST', body: undefined }]);
  assert.equal(cancel.disabled, true);
  assert.equal(view.queryByRole('alertdialog'), null);
  await act(async () => pending.resolve(Response.json({ code: 'PAYMENT_PROVIDER_ERROR' }, { status: 502 })));
  assert.equal(pay.disabled, false);
});

test('checkout DOM: el diálogo y el POST de cancelación excluyen pagar y consultar', async t => {
  const pending = deferred();
  let cancelled = false;
  const actions = mockOrders(t, () => pending.response, id => order(id, cancelled ? { status: 'CANCELLED' } : {}));
  const view = render(detail());
  const pay = await view.findByRole('button', { name: 'Pagar con Mercado Pago' });
  const check = view.getByRole('button', { name: 'Consultar estado del pago' });
  fireEvent.click(view.getByRole('button', { name: 'Cancelar reserva' }));
  assert.ok(view.getByRole('alertdialog'));
  assert.equal(pay.disabled, true);
  assert.equal(check.disabled, true);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Confirmar cancelación' })));
  fireEvent.click(check);
  assert.equal(pay.disabled, true);
  assert.deepEqual(actions.map(({ action, method }) => [action, method]), [['cancel', 'POST']]);
  cancelled = true;
  await act(async () => pending.resolve(Response.json({ status: 'CANCELLED' })));
  await view.findByText('Cancelaste el pedido');
  assert.equal(view.queryByRole('button', { name: 'Pagar con Mercado Pago' }), null);
});

test('checkout DOM: un GET atrasado no actualiza otro pedido y desmontar impide programar otro', async t => {
  const first = deferred();
  const second = deferred();
  const actions = mockOrders(t, ({ id }) => id === 'o1' ? first.response : second.response);
  mockCheckoutTimers(t);
  let view;
  await act(async () => { view = render(detail('o1', true)); });
  assert.equal(actions.length, 1);
  await act(async () => view.rerender(detail('o2')));
  assert.ok(view.getByRole('heading', { name: 'Pedido #2' }));
  await act(async () => first.resolve(payment('o1', 'CONFIRMED')));
  assert.equal(view.queryByText('Pago aprobado. Tu pedido está confirmado'), null);
  assert.equal(actions.length, 1);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Consultar estado del pago' })));
  assert.equal(actions.length, 2);
  view.unmount();
  await act(async () => second.resolve(payment('o2', 'PENDING')));
  await act(async () => t.mock.timers.tick(9000));
  assert.deepEqual(actions.map(({ id, method }) => [id, method]), [['o1', 'GET'], ['o2', 'GET']]);
});

test('checkout DOM: retorno manipulado usa la API, mantiene PENDING a cero y detiene las consultas al confirmar', async t => {
  const next = deferred();
  let calls = 0;
  const actions = mockOrders(t, () => ++calls === 1 ? payment('o1', 'PENDING', new Date(Date.now() - 1000).toISOString()) : next.response);
  const page = await Page({
    params: Promise.resolve({ id: 'o1' }),
    searchParams: Promise.resolve({ pago: 'retorno', status: 'approved', collection_status: 'rejected' }),
  });
  mockCheckoutTimers(t);
  let view;
  await act(async () => { view = render(createElement(StrictMode, null, page)); });
  assert.equal(actions.length, 1);
  assert.ok(view.getByText('Esperando confirmación del pago'));
  assert.equal(view.getByRole('timer').textContent, '00:00');
  assert.equal(view.queryByText('Se venció el tiempo para pagar'), null);
  await act(async () => t.mock.timers.tick(3000));
  assert.equal(actions.length, 2);
  await act(async () => next.resolve(payment('o1', 'CONFIRMED')));
  assert.ok(view.getByText('Pago aprobado. Tu pedido está confirmado'));
  assert.ok(view.getByText('Estado: Reservado'));
  assert.equal(view.queryByRole('button', { name: 'Pagar con Mercado Pago' }), null);
  assert.equal(view.queryByRole('button', { name: 'Cancelar reserva' }), null);
  assert.match(view.getByText(/Ventana de retiro/).textContent, /12:45–12:50/);
  await act(async () => t.mock.timers.tick(9000));
  assert.equal(actions.length, 2);
});

test('checkout DOM: tras fallar el GET de retorno solo permite consultar; PAYMENT_NOT_FOUND recupera el pago', async t => {
  let calls = 0;
  const actions = mockOrders(t, () => {
    if (++calls === 1) throw new TypeError('Sin conexión');
    return Response.json({ code: 'PAYMENT_NOT_FOUND' }, { status: 404 });
  });
  const view = render(detail('o1', true));
  await view.findByText('No se pudo consultar el pago. Podés volver a consultar.');
  assert.equal(view.queryByRole('button', { name: 'Pagar con Mercado Pago' }), null);
  fireEvent.click(view.getByRole('button', { name: 'Consultar estado del pago' }));
  await view.findByText('Todavía no hay un pago iniciado para este pedido.');
  const pay = await view.findByRole('button', { name: 'Pagar con Mercado Pago' });
  await waitFor(() => assert.equal(pay.disabled, false));
  assert.deepEqual(actions.map(({ method }) => method), ['GET', 'GET']);
});

// Verifica la recuperación mediante código manual cuando falla la generación del QR.
// El renderizado exitoso del QR en un navegador real queda fuera de este caso.
test('checkout DOM: un pedido listo conserva el retiro manual tras un error al solicitar QR', async t => {
  const actions = mockOrders(t, ({ action }) => {
    if (action === 'payment') return payment('o1', 'CONFIRMED');
    if (action === 'pickup/qr') return Response.json({ error: 'No se pudo generar el QR' }, { status: 502 });
    assert.equal(action, 'pickup/manual');
    return Response.json({ code: 'TEST00000001' });
  }, id => order(id, { status: 'READY_FOR_PICKUP' }));
  const view = render(detail('o1', true));
  await view.findByText('Pago aprobado. Tu pedido está confirmado');
  await waitFor(() => assert.equal(view.getByRole('button', { name: 'Generar QR' }).disabled, false));
  fireEvent.click(view.getByRole('button', { name: 'Generar QR' }));
  await view.findByText('No se pudo generar el QR');
  fireEvent.click(view.getByRole('button', { name: 'Generar código manual' }));
  assert.equal((await view.findByLabelText('Código manual de retiro')).textContent, 'TEST00000001');
  assert.match(view.getByText(/Tolerancia hasta las/).textContent, /12:55/);
  assert.deepEqual(actions.map(({ action, method }) => [action, method]),
    [['payment', 'GET'], ['pickup/qr', 'POST'], ['pickup/manual', 'POST']]);
});

function assertQrSvg(view, orderId, token) {
  const actual = view.getByLabelText('Código QR de retiro').querySelector('svg');
  assert.ok(actual, 'Se debe renderizar el SVG real del QR');
  const reference = render(createElement(QRCode, {
    value: JSON.stringify({ orderId, token }),
    size: 208,
  }));
  try {
    const expected = reference.container.querySelector('svg');
    assert.ok(expected);
    assert.ok(actual.querySelector('path[d]'));
    assert.equal(actual.outerHTML, expected.outerHTML);
    return actual.outerHTML;
  } finally {
    reference.unmount();
  }
}

test('retiro DOM: renderiza y regenera el QR real, bloquea clics simultáneos y limpia al cambiar de pedido', async t => {
  const first = deferred();
  const expiresAt = '2026-11-27T15:50:00Z';
  const tokens = ['qr-prueba-primero', 'qr-prueba-renovado'];
  let calls = 0;
  const actions = mockOrders(t, () => ++calls === 1
    ? first.response
    : Response.json({ token: tokens[1], expiresAt }), id =>
    order(id, { status: id === 'o1' ? 'READY_FOR_PICKUP' : 'CONFIRMED' }));
  const view = render(detail());
  const qr = await view.findByRole('button', { name: 'Generar QR' });
  const manual = view.getByRole('button', { name: 'Generar código manual' });
  await act(async () => {
    fireEvent.click(qr);
    fireEvent.click(qr);
    fireEvent.click(manual);
  });
  assert.deepEqual(actions.map(({ id, action, method }) => [id, action, method]), [['o1', 'pickup/qr', 'POST']]);
  assert.equal(qr.disabled, true);
  assert.equal(manual.disabled, true);

  await act(async () => first.resolve(Response.json({ token: tokens[0], expiresAt })));
  const firstSvg = assertQrSvg(view, 'o1', tokens[0]);
  const displayedExpiry = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(expiresAt));
  assert.ok(view.getByText(`Vence: ${displayedExpiry}. Generá otro si vence.`));

  await act(async () => fireEvent.click(qr));
  assert.equal(calls, 2);
  assert.notEqual(assertQrSvg(view, 'o1', tokens[1]), firstSvg);

  view.rerender(detail('o2'));
  await view.findByRole('heading', { name: 'Pedido #2' });
  assert.equal(view.queryByLabelText('Código QR de retiro'), null);
  assert.equal(view.queryByText(/Generá otro si vence/), null);
  assert.equal(view.queryByRole('button', { name: 'Generar QR' }), null);
  assert.equal(view.queryByRole('button', { name: 'Generar código manual' }), null);
});

test('retiro DOM: una credencial recibida tarde no aparece en otro pedido listo', async t => {
  const pending = deferred();
  const actions = mockOrders(t, () => pending.response, id => order(id, { status: 'READY_FOR_PICKUP' }));
  const view = render(detail());
  const manual = await view.findByRole('button', { name: 'Generar código manual' });
  await act(async () => fireEvent.click(manual));
  view.rerender(detail('o2'));
  await view.findByRole('heading', { name: 'Pedido #2' });
  await act(async () => pending.resolve(Response.json({ code: 'TEST00000001' })));
  assert.equal(view.queryByLabelText('Código manual de retiro'), null);
  assert.equal(view.getByRole('button', { name: 'Generar código manual' }).disabled, false);
  assert.deepEqual(actions.map(({ id, action }) => [id, action]), [['o1', 'pickup/manual']]);
});
