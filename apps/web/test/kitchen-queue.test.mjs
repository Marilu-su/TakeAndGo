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

function mockApi(t, handle) {
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
    if (path === '/api/v1/me') return Response.json({ userId: 'empleado', role: 'STORE_EMPLOYEE', storeId: 'demo' });
    return handle(path, options);
  });
}

function renderQueue() {
  return render(createElement(AppRouterContext.Provider, { value: router },
    createElement(SessionShell, { staff: true }, createElement(KitchenQueue))));
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
