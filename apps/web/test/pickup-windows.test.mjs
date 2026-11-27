import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, apiRequest } from '../src/lib/api.ts';
import {
  formatPickupTime,
  orderPickupSummary,
  orderRequestBody,
  pickupWindowsPath,
  resolvePickupSelection,
} from '../src/lib/pickup-windows.ts';

const window = {
  promisedFrom: '2026-11-28T00:30:00.000Z',
  promisedTo: '2026-11-28T00:35:00.000Z',
  toleranceUntil: '2026-11-28T00:40:00.000Z',
};
const cart = [{ productId: 'p1', quantity: 2, additions: [{ id: 'a1' }] }];
const apiBase = 'https://api.example.test';

test('conserva la selección durante la recarga y solo la invalida si desaparece de la respuesta', () => {
  const selected = window.promisedFrom;
  assert.deepEqual(resolvePickupSelection(undefined, selected), { window: undefined, expired: false });
  assert.deepEqual(resolvePickupSelection({ requiresPickupWindow: true, windows: [window] }, selected), { window, expired: false });
  assert.deepEqual(resolvePickupSelection({ requiresPickupWindow: true, windows: [] }, selected), { window: undefined, expired: true });
  assert.deepEqual(resolvePickupSelection({ requiresPickupWindow: true, windows: [window] }, ''), { window: undefined, expired: false });
});

function mockApi(t, callback) {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = apiBase;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  });
  t.mock.method(globalThis, 'fetch', callback);
}

test('muestra la ventana en Buenos Aires aunque UTC ya sea mañana', () => {
  assert.equal(formatPickupTime(window.promisedFrom), '21:30');
  assert.equal(formatPickupTime(window.promisedTo), '21:35');
  const summary = orderPickupSummary(window);
  assert.match(summary.window, /27\/11\/26.*21:30–21:35/);
  assert.equal(summary.tolerance, '21:40');
  assert.equal(orderPickupSummary({}), null);
  assert.equal(orderPickupSummary({ promisedFrom: null, promisedTo: null }), null);
});

test('consulta el buffet correcto y conserva la respuesta vacía', async (t) => {
  mockApi(t, async (url, options) => {
    assert.equal(url, `${apiBase}/api/v1/stores/buffet%2Fa/pickup-windows`);
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token');
    return Response.json({ requiresPickupWindow: true, windows: [] });
  });
  assert.deepEqual(await apiRequest(pickupWindowsPath('buffet/a'), { token: 'test-token' }), {
    requiresPickupWindow: true,
    windows: [],
  });
});

test('conserva el mensaje de error de la consulta de ventanas', async (t) => {
  mockApi(t, async () => Response.json({ error: 'Sin membresía', code: 'FORBIDDEN' }, { status: 403 }));
  await assert.rejects(apiRequest(pickupWindowsPath('demo')),
    error => error instanceof ApiError && error.status === 403 && error.code === 'FORBIDDEN' && error.message === 'Sin membresía');
});

test('envía solo el inicio ISO original junto con los ítems existentes', async (t) => {
  mockApi(t, async (url, options) => {
    assert.equal(url, `${apiBase}/api/v1/orders`);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      storeId: 'demo',
      items: [{ productId: 'p1', quantity: 2, additionIds: ['a1'] }],
      promisedFrom: window.promisedFrom,
    });
    return Response.json({ id: 'order-1' }, { status: 201 });
  });
  await apiRequest('/api/v1/orders', { method: 'POST', body: orderRequestBody('demo', cart, window.promisedFrom) });
  assert.equal(Object.hasOwn(JSON.parse(orderRequestBody('other', cart)), 'promisedFrom'), false);
});

test('distingue el rechazo por ventana desactualizada del rechazo por stock', async (t) => {
  let code = 'PICKUP_WINDOW_UNAVAILABLE';
  mockApi(t, async () => Response.json({ error: 'No disponible', code }, { status: 409 }));
  for (const expected of ['PICKUP_WINDOW_UNAVAILABLE', 'INSUFFICIENT_STOCK']) {
    code = expected;
    await assert.rejects(apiRequest('/api/v1/orders', {
      method: 'POST',
      body: orderRequestBody('demo', cart, window.promisedFrom),
    }), error => error instanceof ApiError && error.status === 409 && error.code === expected);
  }
});
