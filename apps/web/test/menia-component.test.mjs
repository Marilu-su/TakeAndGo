import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadTs } from './helpers/load-ts.mjs';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'MutationObserver']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.self = dom.window;
const React = await import('react');
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react');
const { MeniaChat } = await loadTs('components/menia-chat.tsx');
const { default: BuffetsPage } = await loadTs('app/(customer)/buffets/page.tsx');
const originalUrl = process.env.NEXT_PUBLIC_API_URL;
process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
const context = id => ({ storeId: id, storeName: `Buffet ${id}`, organizationId: 'org-prueba' });
const response = id => ({ context: context(id), message: { role: 'assistant', text: 'Respuesta del backend para tu consulta' }, cards: [], actions: [] });
afterEach(() => cleanup());
process.on('exit', () => { if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalUrl; });

test('MenIA UI: carga contexto real sin iniciar chat, envía con Enter y muestra respuesta', async t => {
  const requests = [];
  let complete;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt-prueba' });
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-prueba');
    requests.push(url);
    if (url.endsWith('/context')) return Response.json(context('uno'));
    assert.equal(url, 'http://api.example.test/api/v1/stores/uno/menia/messages');
    assert.deepEqual(JSON.parse(options.body), { message: 'Hola desde la pantalla' });
    return new Promise(resolve => { complete = resolve; });
  });
  const view = render(React.createElement(MeniaChat, { storeId: 'uno' }));
  await view.findByText('Buffet uno');
  assert.equal(requests.length, 1);
  const input = view.getByLabelText('Tu mensaje');
  assert.equal(view.getByRole('button', { name: 'Enviar' }).disabled, true);
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  assert.equal(requests.length, 1);
  fireEvent.change(input, { target: { value: 'Hola desde la pantalla' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  assert.equal(requests.length, 1);
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => assert.equal(input.disabled, true));
  await waitFor(() => assert.equal(requests.length, 2));
  await React.act(async () => { complete(Response.json(response('uno'))); });
  await view.findByText('Respuesta del backend para tu consulta');
  assert.equal(view.getByRole('log').querySelectorAll('article').length, 2);
  assert.equal(input.disabled, false);
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
});

test('MenIA UI: error de red permite reintentar y cambiar buffet borra mensajes', async t => {
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt' });
    const id = url.includes('/dos/') ? 'dos' : 'uno';
    if (url.endsWith('/context')) return Response.json(context(id));
    if (++attempts === 1) throw new TypeError('Sin conexión');
    return Response.json(response(id));
  });
  const view = render(React.createElement(MeniaChat, { storeId: 'uno' }));
  const input = await view.findByLabelText('Tu mensaje');
  fireEvent.change(input, { target: { value: 'Mi consulta' } });
  fireEvent.click(view.getByRole('button', { name: 'Enviar' }));
  await view.findByRole('alert');
  fireEvent.click(view.getByRole('button', { name: 'Reintentar mensaje' }));
  await view.findByText('Respuesta del backend para tu consulta');
  assert.equal(view.getByRole('log').querySelectorAll('article').length, 2);
  view.rerender(React.createElement(MeniaChat, { storeId: 'dos' }));
  await view.findByText('Buffet dos');
  assert.equal(view.getByRole('log').querySelectorAll('article').length, 0);
  assert.equal(view.getByLabelText('Tu mensaje').value, '');
});

test('MenIA UI: muestra carga y errores de autorización sin habilitar el chat', async t => {
  let complete;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt' });
    return new Promise(resolve => { complete = resolve; });
  });
  const view = render(React.createElement(MeniaChat, { storeId: 'uno' }));
  assert.match(view.getByRole('status').textContent, /Cargando/);
  await waitFor(() => assert.equal(typeof complete, 'function'));
  await React.act(async () => { complete(Response.json({ error: 'No estás asociado a este buffet' }, { status: 403 })); });
  await view.findByRole('alert');
  assert.equal(view.queryByLabelText('Tu mensaje'), null);
});

test('MenIA UI: el acceso aparece al seleccionar un buffet activo', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt' });
    return Response.json([{ id: 'uno', name: 'Buffet uno', code: 'ABC123', status: 'ACTIVE', organizationId: 'org' }]);
  });
  const view = render(React.createElement(BuffetsPage));
  await view.findByText('Buffet uno');
  assert.equal(view.queryByRole('link', { name: 'Abrir MenIA' }), null);
  fireEvent.click(view.getByRole('button', { name: 'Seleccionar buffet' }));
  assert.equal(view.getByRole('link', { name: 'Abrir MenIA' }).getAttribute('href'), '/buffets/uno/menia');
});

test('MenIA integración: la pantalla conversa con Express mediante HTTP real y JWT de prueba', async t => {
  const child = fork(fileURLToPath(new URL('../../api/test/fixtures/menia-server.cjs', import.meta.url)), [], { silent: true });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  t.after(() => { child.kill(); process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test'; });
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`No inició Express: ${errors}`)), 20000);
    child.once('message', message => { clearTimeout(timeout); resolve(message.port); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Express terminó (${code}): ${errors}`)); });
  });
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}`;
  const fetchReal = globalThis.fetch;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'menia-integration-token' });
    calls.push(url);
    return fetchReal(url, options);
  });
  const view = render(React.createElement(MeniaChat, { storeId: 'integration-store' }));
  await view.findByText('Buffet de integración');
  fireEvent.change(view.getByLabelText('Tu mensaje'), { target: { value: 'Hola desde React a Express' } });
  fireEvent.click(view.getByRole('button', { name: 'Enviar' }));
  await view.findByText(/Recibí tu mensaje/);
  assert.equal(calls.length, 2);
  assert.equal(view.getByRole('log').querySelectorAll('article').length, 2);
  const denied = await fetchReal(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/stores/integration-store/menia/context`);
  assert.equal(denied.status, 401);
});
