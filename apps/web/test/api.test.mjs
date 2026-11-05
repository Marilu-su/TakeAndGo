import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ApiError } from '../src/lib/api.ts';

test('HTTP: envía JWT, JSON y evita cachear respuestas privadas', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/v1/me');
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-de-prueba');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.cache, 'no-store');
    return Response.json({ ok: true });
  });
  const old = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/';
  try { assert.deepEqual(await apiRequest('/api/v1/me', { token: 'jwt-de-prueba', body: '{}', method: 'POST' }), { ok: true }); }
  finally { if (old === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = old; }
});

test('HTTP: conserva el mensaje del backend y el estado 403', async (t) => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Sin permisos' }, { status: 403 }));
  await assert.rejects(apiRequest('/private'), e => e instanceof ApiError && e.status === 403 && e.message === 'Sin permisos');
});

test('HTTP: acepta 204 sin intentar interpretar JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await apiRequest('/empty'), undefined);
});

test('HTTP: traduce errores de conexión', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(apiRequest('/offline'), /No se pudo conectar/);
});
