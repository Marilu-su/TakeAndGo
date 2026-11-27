import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { getPrisma } from '../../src/infrastructure/database/prisma';

const marker = 'takeandgo-mvp09-t08-postgres';

test('cola HTTP por buffet y activación por el proceso periódico de la API', {
  skip: process.env.MVP11_KITCHEN_INTEGRATION !== '1' && 'Requiere el PostgreSQL descartable verificado',
  timeout: 65_000,
}, async t => {
  const db = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(db.protocol, 'postgresql:');
  assert.equal(db.host, '127.0.0.1:5434');
  assert.equal(db.pathname, '/takeandgo');
  assert.equal(process.env.DOTENV_CONFIG_PATH, 'NUL');
  assert.equal(process.env.PAYMENT_PROVIDER, 'fake');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.notEqual(process.env.DOTENV_CONFIG_OVERRIDE, 'true');

  const prisma = getPrisma();
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const storeId = randomUUID();
  const otherStoreId = randomUUID();
  const customerId = randomUUID();
  const employee = `employee-${suffix}`;
  const otherEmployee = `other-${suffix}`;
  let identityVerified = false;
  let api: Server | undefined;
  let keys: Server | undefined;
  const intervals: ReturnType<typeof setInterval>[] = [];
  const periods: number[] = [];
  let pickupTicks = 0;
  const previousAuth = process.env.NEON_AUTH_URL;
  const previousPort = process.env.PORT;

  try {
    const [identity] = await prisma.$queryRaw<{ db: string; role: string; marker: string }[]>`
      SELECT current_database() AS db, current_user AS role, current_setting('takeandgo.mvp09_t08', true) AS marker
    `;
    assert.deepEqual(identity, { db: 'takeandgo', role: decodeURIComponent(db.username), marker });
    identityVerified = true;

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const key = { ...await exportJWK(publicKey), kid: suffix };
    keys = createServer((req, res) => {
      if (req.url !== '/.well-known/jwks.json') {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [key] }));
    }).listen(0, '127.0.0.1');
    await once(keys, 'listening');
    const issuer = localOrigin(keys);
    process.env.NEON_AUTH_URL = issuer;
    process.env.PORT = '0';

    await prisma.organization.create({ data: { id: organizationId, name: `Cocina ${suffix}` } });
    await prisma.store.createMany({ data: [
      { id: storeId, organizationId, code: `K${suffix.slice(0, 8)}`, name: 'Cocina principal' },
      { id: otherStoreId, organizationId, code: `O${suffix.slice(0, 8)}`, name: 'Otra cocina' },
    ] });
    await prisma.customer.create({ data: { id: customerId, name: 'Cliente cocina', email: `${suffix}@example.test` } });
    await prisma.staffScope.createMany({ data: [
      { organizationId, storeId, authUserId: employee, role: 'STORE_EMPLOYEE' },
      { organizationId, storeId: otherStoreId, authUserId: otherEmployee, role: 'STORE_EMPLOYEE' },
    ] });

    const { default: app } = await import('../../src/app');
    const listen = app.listen.bind(app);
    t.mock.method(app, 'listen', (_port: string, callback: () => void) => {
      api = listen(0, '127.0.0.1', callback);
      return api;
    });
    const setRealInterval = globalThis.setInterval;
    t.mock.method(globalThis, 'setInterval', (callback: () => void, period: number) => {
      const timer = setRealInterval(() => {
        if (period === 10_000) pickupTicks++;
        callback();
      }, period);
      intervals.push(timer);
      periods.push(period);
      return timer;
    });

    const now = Date.now();
    const from = new Date(now + 20_000);
    const to = new Date(from.getTime() + 300_000);
    const earlier = new Date(now - 3_600_000);
    const [target, preparing, first, foreign] = await Promise.all([
      prisma.order.create({ data: {
        orderNumber: 1, storeId, customerId, totalCents: 100, status: 'CONFIRMED',
        scheduledForDate: new Date(from.toISOString().slice(0, 10)),
        promisedFrom: from, promisedTo: to, toleranceUntil: new Date(to.getTime() + 300_000),
        createdAt: new Date(now - 1000),
      } }),
      prisma.order.create({ data: {
        orderNumber: 2, storeId, customerId, totalCents: 100, status: 'PREPARING',
        promisedFrom: from, promisedTo: to, createdAt: new Date(now - 2000),
      } }),
      prisma.order.create({ data: {
        orderNumber: 3, storeId, customerId, totalCents: 100, status: 'CONFIRMED',
        promisedFrom: earlier, createdAt: new Date(now - 500),
      } }),
      prisma.order.create({ data: {
        orderNumber: 1, storeId: otherStoreId, customerId, totalCents: 100, status: 'CONFIRMED',
      } }),
    ]);
    await prisma.order.createMany({ data: (['RESERVED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'READY_FOR_PICKUP'] as const)
      .map((status, index) => ({ orderNumber: index + 4, storeId, customerId, totalCents: 100, status })) });

    await import('../../src/index');
    assert.ok(api);
    const server: Server = api;
    if (!server.listening || intervals.length === 0) await once(server, 'listening');
    assert.deepEqual(periods, [10_000, 30_000]);
    const origin = localOrigin(server);
    const token = (subject: string) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: suffix })
      .setIssuer(issuer).setAudience(issuer).setSubject(subject).setExpirationTime('2m').sign(privateKey);
    const [ownToken, otherToken] = await Promise.all([token(employee), token(otherEmployee)]);
    const path = (store: string) => `/api/v1/stores/${store}/kitchen/orders`;
    async function call(route: string, jwt: string, method = 'GET', expected = 200) {
      const response = await fetch(origin + route, { method, headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(3000) });
      const body = await response.json();
      assert.equal(response.status, expected, JSON.stringify(body));
      return body;
    }
    const queue = await call(path(storeId), ownToken);
    assert.deepEqual(queue.map(({ id, status }: { id: string; status: string }) => [id, status]), [
      [first.id, 'CONFIRMED'], [preparing.id, 'PREPARING'], [target.id, 'CONFIRMED'],
    ]);
    assert.deepEqual((await call(path(otherStoreId), otherToken)).map(({ id }: { id: string }) => id), [foreign.id]);
    await call(path(storeId), otherToken, 'GET', 403);
    const targetPath = `${path(storeId)}/${target.id}`;
    await call(targetPath + '/start', otherToken, 'POST', 403);
    assert.equal((await call(targetPath + '/start', ownToken, 'POST')).status, 'PREPARING');
    await call(targetPath + '/finish', otherToken, 'POST', 403);
    const finished = await call(targetPath + '/finish', ownToken, 'POST');
    assert.equal(finished.status, 'PREPARING');
    assert.ok(finished.preparedAt);
    assert.equal(finished.preparedByUserId, employee);
    t.diagnostic('Cola ordenada y aislada. GET, start y finish de otro buffet devolvieron 403.');

    // Wait through the first scheduled cycle while the pickup window is still closed.
    const before = from.getTime() - 2000;
    assert.ok(Date.now() < before, 'El fixture debe finalizar antes de comenzar la ventana');
    await delay(before - Date.now(), undefined, { signal: t.signal });
    assert.ok(pickupTicks > 0);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: target.id } })).status, 'PREPARING');
    assert.ok(Date.now() < from.getTime());
    t.diagnostic('Persistió PREPARING con preparación registrada tras el primer ciclo, antes de la ventana.');

    const deadline = from.getTime() + 16_000;
    let saved;
    do {
      saved = await prisma.order.findUniqueOrThrow({ where: { id: target.id } });
      if (saved.status === 'READY_FOR_PICKUP') break;
      await delay(250, undefined, { signal: t.signal });
    } while (Date.now() < deadline);
    assert.equal(saved.status, 'READY_FOR_PICKUP');
    assert.equal(saved.preparedAt?.toISOString(), finished.preparedAt);
    assert.equal(saved.preparedByUserId, employee);
    assert.deepEqual(saved.promisedFrom, from);
    assert.deepEqual(saved.promisedTo, to);
    assert.deepEqual((await call(path(storeId), ownToken)).map(({ id }: { id: string }) => id), [first.id, preparing.id]);
    t.diagnostic('El proceso periódico persistió READY_FOR_PICKUP durante la ventana y el GET quitó el pedido de la cola.');
  } finally {
    for (const timer of intervals) clearInterval(timer);
    try {
      await Promise.all([api, keys].map(server => server?.listening
        ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        : undefined));
      if (identityVerified) {
        await prisma.order.deleteMany({ where: { customerId } });
        await prisma.staffScope.deleteMany({ where: { organizationId } });
        await prisma.customer.deleteMany({ where: { id: customerId } });
        await prisma.store.deleteMany({ where: { organizationId } });
        await prisma.organization.deleteMany({ where: { id: organizationId } });
      }
    } finally {
      if (previousAuth === undefined) delete process.env.NEON_AUTH_URL;
      else process.env.NEON_AUTH_URL = previousAuth;
      if (previousPort === undefined) delete process.env.PORT;
      else process.env.PORT = previousPort;
      await prisma.$disconnect();
    }
  }
});

function localOrigin(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
