import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { ApiError } from '../src/lib/api.ts';

// Compile the real module, resolving its extensionless Next.js import for Node.
const source = (await readFile(new URL('../src/lib/session.ts', import.meta.url), 'utf8'))
  .replace("'./api'", JSON.stringify(new URL('../src/lib/api.ts', import.meta.url).href));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sessionRequest } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('sesión: sin JWT informa 401 para redirigir al login sin consultar la API', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ token: null }); });
  await assert.rejects(sessionRequest('/api/v1/me'), e => e instanceof ApiError && e.status === 401);
  assert.equal(calls, 1);
});

test('sesión: conserva fallos del proveedor para permitir reintentar', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(sessionRequest('/api/v1/me'), e => e instanceof ApiError && e.status === 503);
});

test('sesión: usa el JWT obtenido para consultar el Actor real', async (t) => {
  const previous = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  t.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = previous; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/token') return Response.json({ token: 'jwt-test' });
    assert.equal(url, 'https://api.example.test/api/v1/me');
    assert.equal(options.headers.get('Authorization'), 'Bearer jwt-test');
    return Response.json({ role: 'CUSTOMER', userId: 'customer-test' });
  });
  assert.deepEqual(await sessionRequest('/api/v1/me'), { role: 'CUSTOMER', userId: 'customer-test' });
});
