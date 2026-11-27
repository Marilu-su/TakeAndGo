import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { loadTs } from './helpers/load-ts.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver']) globalThis[key] = dom.window[key];
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { cleanup, fireEvent, render, within } = await import('@testing-library/react');
const { AppRouterContext } = createRequire(import.meta.url)('next/dist/shared/lib/app-router-context.shared-runtime');
const { SessionShell } = await loadTs('components/session-shell.tsx');
const { KitchenQueue } = await loadTs('components/kitchen-queue.tsx');
afterEach(cleanup);
after(() => dom.window.close());

const queuePath = '/api/v1/stores/demo/kitchen/orders';
const router = { prefetch: async () => {} };
const order = (overrides = {}) => ({
  id: 'o1', orderNumber: 1, status: 'CONFIRMED', preparedAt: null,
  promisedFrom: '2026-11-27T15:45:00Z',
  items: [{ productNameSnapshot: 'Tostado', quantity: 2, additions: [{ additionNameSnapshot: 'Queso', quantity: 1 }] }],
  ...overrides,
});

function mockApi(t, handle, getStore = () => 'demo') {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt-prueba' });
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-prueba');
    const path = new URL(url).pathname;
    if (path === '/api/v1/me') return Response.json({ userId: 'empleado', role: 'STORE_EMPLOYEE', storeId: getStore() });
    return handle(path, options);
  });
}

function staffSession(key = 'demo') {
  return createElement(AppRouterContext.Provider, { value: router },
    createElement(SessionShell, { key, staff: true }, createElement(KitchenQueue)));
}

function renderQueue() {
  return render(staffSession());
}

test('cocina DOM: muestra confirmado, productos, adicionales y horario de Buenos Aires', async t => {
  mockApi(t, path => {
    assert.equal(path, queuePath);
    return Response.json([order()]);
  });
  const view = renderQueue();
  await view.findByText('Confirmado');
  assert.ok(view.getByText('2 × Tostado — 1 × Queso'));
  assert.ok(view.getByText('Inicio de la ventana prometida: 12:45'));
  assert.ok(view.getByRole('button', { name: 'Iniciar preparación' }));
});

test('cocina DOM: inicia y finaliza una vez por acción, y retira de la cola al actualizar', async t => {
  let queue = [order(), order({ id: 'o2', orderNumber: 2 })];
  let complete;
  const actions = [];
  mockApi(t, (path, { method }) => {
    if (path === queuePath) return Response.json(queue);
    assert.equal(method, 'POST');
    actions.push(path);
    return new Promise(resolve => { complete = resolve; });
  });
  const view = renderQueue();
  const first = within((await view.findByRole('heading', { name: 'Pedido 1' })).closest('article'));
  const second = within(view.getByRole('heading', { name: 'Pedido 2' }).closest('article'));
  const start = first.getByRole('button', { name: 'Iniciar preparación' });
  await act(async () => {
    fireEvent.click(start);
    fireEvent.click(start);
  });
  assert.deepEqual(actions, [queuePath + '/o1/start']);
  assert.equal(first.getByRole('button', { name: 'Iniciando…' }).disabled, true);
  assert.equal(second.getByRole('button', { name: 'Iniciar preparación' }).disabled, false);
  queue[0] = order({ status: 'PREPARING' });
  await act(async () => complete(Response.json(queue[0])));

  const finish = await view.findByRole('button', { name: 'Finalizar preparación' });
  await act(async () => {
    fireEvent.click(finish);
    fireEvent.click(finish);
  });
  assert.deepEqual(actions, [queuePath + '/o1/start', queuePath + '/o1/finish']);
  assert.equal(view.getByRole('button', { name: 'Finalizando…' }).disabled, true);
  queue[0] = order({ status: 'PREPARING', preparedAt: '2026-11-27T15:40:00Z' });
  await act(async () => complete(Response.json(queue[0])));
  await view.findByText('Preparado');
  assert.ok(view.getByText('El retiro todavía no está habilitado.'));
  assert.equal(view.queryByRole('button', { name: 'Finalizar preparación' }), null);

  queue = queue.slice(1);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Actualizar cola' })));
  assert.equal(view.queryByRole('heading', { name: 'Pedido 1' }), null);
  assert.ok(view.getByRole('heading', { name: 'Pedido 2' }));
});

test('cocina DOM: permite reintentar inicio y finalización y separa los errores de retiro', async t => {
  let current = order();
  const attempts = { start: 0, finish: 0 };
  mockApi(t, path => {
    if (path === queuePath) return Response.json([current]);
    if (path.endsWith('/pickup/by-code')) return Response.json({ error: 'Código inválido' }, { status: 400 });
    const action = path.split('/').at(-1);
    assert.equal(path, queuePath + '/o1/' + action);
    if (++attempts[action] === 1) return Response.json({ error: 'Falló ' + action }, { status: 409 });
    current = order({ status: 'PREPARING', preparedAt: action === 'finish' ? '2026-11-27T15:40:00Z' : null });
    return Response.json(current);
  });
  const view = renderQueue();
  fireEvent.click(await view.findByRole('button', { name: 'Iniciar preparación' }));
  const kitchenAlert = await view.findByText('Falló start');
  assert.ok(kitchenAlert.closest('article'));
  assert.equal(kitchenAlert.closest('form'), null);
  fireEvent.change(view.getByLabelText('QR o código de retiro'), { target: { value: 'TEST00000001' } });
  fireEvent.click(view.getByRole('button', { name: 'Confirmar entrega' }));
  assert.ok((await view.findByText('Código inválido')).closest('form'));
  fireEvent.click(view.getByRole('button', { name: 'Iniciar preparación' }));
  fireEvent.click(await view.findByRole('button', { name: 'Finalizar preparación' }));
  assert.ok((await view.findByText('Falló finish')).closest('article'));
  assert.ok(view.getByText('Código inválido'));
  fireEvent.click(view.getByRole('button', { name: 'Finalizar preparación' }));
  await view.findByText('Preparado');
  assert.equal(view.queryByText('Falló finish'), null);
  assert.ok(view.getByText('Código inválido'));
  assert.deepEqual(attempts, { start: 2, finish: 2 });
});

test('cocina DOM: un preparado con ventana pasada o sin ventana no promete activación', async t => {
  const prepared = { status: 'PREPARING', preparedAt: '2020-01-01T15:40:00Z' };
  mockApi(t, path => {
    assert.equal(path, queuePath);
    return Response.json([
      order({ ...prepared, promisedFrom: '2020-01-01T15:45:00Z', promisedTo: '2020-01-01T15:50:00Z' }),
      order({ ...prepared, id: 'o2', orderNumber: 2, promisedFrom: null }),
    ]);
  });
  const view = renderQueue();
  const first = within((await view.findByRole('heading', { name: 'Pedido 1' })).closest('article'));
  const second = within(view.getByRole('heading', { name: 'Pedido 2' }).closest('article'));
  for (const row of [first, second]) {
    assert.ok(row.getByText('Preparado'));
    assert.ok(row.getByText('El retiro todavía no está habilitado.'));
    assert.equal(row.queryByRole('button', { name: 'Finalizar preparación' }), null);
    assert.doesNotMatch(row.getByRole('heading').closest('article').textContent, /se habilitará|podrá retirarse/i);
  }
  assert.ok(first.getByText('Inicio de la ventana prometida: 12:45'));
  assert.equal(second.queryByText(/ventana prometida/), null);
});

const lookupPath = '/api/v1/stores/demo/pickup/by-code';
const confirmPath = '/api/v1/stores/demo/pickup/orders/retirar/confirm';
const code = 'TEST00000001';
const qr = { orderId: 'retirar', token: 'qr-prueba' };
const inputLabel = 'QR o código de retiro';

function enterCredential(view, credential) {
  const field = view.getByLabelText(inputLabel);
  fireEvent.change(field, { target: { value: credential } });
  return field;
}

test('retiro DOM: el QR confirma una primera entrega y distingue la repetición', async t => {
  let attempts = 0;
  mockApi(t, (path, options) => {
    if (path === queuePath) return Response.json([order()]);
    assert.equal(path, confirmPath);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { credential: { type: 'QR', token: qr.token } });
    return Response.json({ alreadyPickedUp: ++attempts === 2 });
  });
  const view = renderQueue();
  await view.findByRole('button', { name: 'Iniciar preparación' });
  const field = enterCredential(view, JSON.stringify(qr));
  fireEvent.submit(field.closest('form'));
  const success = await view.findByText('Retiro confirmado.');
  assert.ok(success.classList.contains('success'));
  assert.equal(field.value, '');
  fireEvent.submit(enterCredential(view, JSON.stringify(qr)).closest('form'));
  const warning = await view.findByText('Pedido ya retirado. No entregar nuevamente.');
  assert.equal(warning.getAttribute('role'), 'alert');
  assert.equal(warning.classList.contains('success'), false);
  assert.equal(view.queryByText('Retiro confirmado.'), null);
  assert.equal(field.value, '');
  assert.equal(field.disabled, false);
  await view.findByRole('button', { name: 'Iniciar preparación' });
  assert.equal(attempts, 2);
});

test('retiro DOM: bloquea el doble envío manual durante la búsqueda y la confirmación', async t => {
  let finishLookup;
  let finishConfirmation;
  const requests = [];
  mockApi(t, (path, options) => {
    if (path === queuePath) return Response.json([]);
    requests.push([path, options.method, JSON.parse(options.body)]);
    if (path === lookupPath) return new Promise(resolve => { finishLookup = resolve; });
    assert.equal(path, confirmPath);
    return new Promise(resolve => { finishConfirmation = resolve; });
  });
  const view = renderQueue();
  await view.findByText('No hay pedidos pendientes de preparación.');
  const field = enterCredential(view, code);
  const form = field.closest('form');
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
  assert.deepEqual(requests, [[lookupPath, 'POST', { code }]]);
  assert.equal(field.disabled, true);
  assert.equal(view.getByRole('button', { name: 'Validando…' }).disabled, true);
  await act(async () => finishLookup(Response.json({ orderId: qr.orderId })));
  assert.equal(field.disabled, true);
  await act(async () => fireEvent.submit(form));
  assert.deepEqual(requests, [
    [lookupPath, 'POST', { code }],
    [confirmPath, 'POST', { credential: { type: 'MANUAL', code } }],
  ]);
  await act(async () => finishConfirmation(Response.json({ alreadyPickedUp: false })));
  assert.ok(view.getByText('Retiro confirmado.'));
  assert.equal(field.disabled, false);
});

test('retiro DOM: conserva la credencial ante resultado incierto o error y permite reintentar', async t => {
  const responses = [
    Response.json({ status: 'COMPLETED' }),
    Response.json({ alreadyPickedUp: 'false' }),
    Response.json({ error: 'La credencial de retiro es inválida o venció' }, { status: 422 }),
    Response.json({ error: 'No tenés permisos para operar en este buffet' }, { status: 403 }),
    Response.json({ alreadyPickedUp: false }),
  ];
  mockApi(t, path => {
    if (path === queuePath) return Response.json([order()]);
    if (path.endsWith('/kitchen/orders/o1/start')) return Response.json({ error: 'Error de preparación' }, { status: 409 });
    assert.equal(path, confirmPath);
    assert.ok(responses.length);
    return responses.shift();
  });
  const view = renderQueue();
  fireEvent.click(await view.findByRole('button', { name: 'Iniciar preparación' }));
  assert.ok((await view.findByText('Error de preparación')).closest('article'));
  const value = JSON.stringify(qr);
  const field = enterCredential(view, value);
  for (const message of [
    /No se pudo verificar el resultado del retiro/,
    /No se pudo verificar el resultado del retiro/,
    'La credencial de retiro es inválida o venció',
    'No tenés permisos para operar en este buffet',
  ]) {
    await act(async () => fireEvent.submit(field.closest('form')));
    assert.ok(view.getByText(message).closest('form'));
    assert.equal(view.queryByText('Retiro confirmado.'), null);
    assert.equal(field.value, value);
    assert.equal(field.disabled, false);
  }
  fireEvent.submit(field.closest('form'));
  await view.findByText('Retiro confirmado.');
  assert.equal(responses.length, 0);
  assert.ok((await view.findByText('Error de preparación')).closest('article'));
});

test('retiro DOM: cambiar de buffet descarta una búsqueda manual pendiente', async t => {
  let store = 'demo';
  let finishLookup;
  const requests = [];
  mockApi(t, path => {
    requests.push(path);
    if (path === queuePath) return Response.json([]);
    if (path === '/api/v1/stores/otro/kitchen/orders') return Response.json([order({ orderNumber: 2 })]);
    assert.equal(path, lookupPath);
    return new Promise(resolve => { finishLookup = resolve; });
  }, () => store);
  const view = renderQueue();
  await view.findByText('No hay pedidos pendientes de preparación.');
  const field = enterCredential(view, code);
  await act(async () => fireEvent.submit(field.closest('form')));
  assert.equal(field.disabled, true);
  store = 'otro';
  view.rerender(staffSession(store));
  await view.findByRole('heading', { name: 'Pedido 2' });
  await act(async () => finishLookup(Response.json({ orderId: qr.orderId })));
  assert.deepEqual(requests, [queuePath, lookupPath, '/api/v1/stores/otro/kitchen/orders']);
  assert.equal(view.getByLabelText(inputLabel).value, '');
  assert.equal(view.getByLabelText(inputLabel).disabled, false);
  assert.equal(view.queryByText('Retiro confirmado.'), null);
});
