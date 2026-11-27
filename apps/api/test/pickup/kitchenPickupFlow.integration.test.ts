import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { getPrisma } from '../../src/infrastructure/database/prisma';

test('cocina y retiro HTTP: el worker habilita dos pedidos y cada entrega consume su reserva una vez', {
  skip: process.env.MVP12_KITCHEN_PICKUP_INTEGRATION !== '1' && 'Requiere PostgreSQL descartable verificado',
  timeout: 75_000,
}, async t => {
  const db = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(db.protocol, 'postgresql:');
  assert.equal(db.host, '127.0.0.1:5434');
  assert.equal(db.pathname, '/takeandgo');
  assert.ok(db.username && db.username !== 'postgres' && db.password);
  assert.equal(process.env.DOTENV_CONFIG_PATH, 'NUL');
  assert.equal(process.env.DOTENV_CONFIG_OVERRIDE, undefined);
  assert.equal(process.env.PAYMENT_PROVIDER, 'fake');
  assert.equal(process.env.NODE_ENV, 'test');

  const prisma = getPrisma();
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const storeId = randomUUID();
  const customerSubject = 'owner-' + suffix;
  const staffSubject = 'staff-' + suffix;
  let fixturesCreated = false;
  let keys: Server | undefined;
  let api: Server | undefined;
  const intervals: ReturnType<typeof setInterval>[] = [];
  const periods: number[] = [];
  let ticks = 0;
  const previousPort = process.env.PORT;
  const previousAuth = process.env.NEON_AUTH_URL;

  try {
    const [identity] = await prisma.$queryRaw<{ db: string; role: string; marker: string }[]>`
      SELECT current_database() AS db, current_user AS role, current_setting('takeandgo.mvp09_t08', true) AS marker
    `;
    assert.ok(identity?.db === 'takeandgo' && identity.role === decodeURIComponent(db.username)
      && identity.marker === 'takeandgo-mvp09-t08-postgres', 'Identidad de PostgreSQL inesperada');

    const from = new Date(Date.now() + 25_000);
    const to = new Date(from.getTime() + 300_000);
    const { product, addition, orderA, orderB } = await prisma.$transaction(async tx => {
      await tx.organization.create({ data: { id: organizationId, name: `Retiro ${suffix}` } });
      await tx.store.create({ data: { id: storeId, organizationId, name: 'Buffet retiro', code: 'K' + suffix.slice(0, 8) } });
      const owner = await tx.customer.create({ data: {
        authUserId: customerSubject, name: 'Cliente de prueba', email: customerSubject + '@example.test',
      } });
      await tx.staffScope.create({ data: { authUserId: staffSubject, organizationId, storeId, role: 'STORE_EMPLOYEE' } });
      const category = await tx.category.create({ data: { storeId, name: 'Categoría de prueba' } });
      const product = await tx.product.create({ data: {
        storeId, categoryId: category.id, name: 'Producto', priceCents: 100, basePreparationSeconds: 60,
      } });
      const addition = await tx.addition.create({ data: { storeId, name: 'Adicional', priceCents: 20 } });
      await tx.productStock.create({ data: { storeId, productId: product.id, availableStock: 7, reservedStock: 3 } });
      await tx.additionStock.create({ data: { storeId, additionId: addition.id, availableStock: 6, reservedStock: 4 } });
      const [orderA, orderB] = await Promise.all([[1, 2, 1], [2, 1, 3]].map(([orderNumber, quantity, extraQuantity]) =>
        tx.order.create({ data: {
          storeId, customerId: owner.id, orderNumber, status: 'CONFIRMED', promisedFrom: from, promisedTo: to, toleranceUntil: new Date(to.getTime() + 300_000),
          totalCents: quantity * 100 + extraQuantity * 20,
          items: { create: {
            productId: product.id, productNameSnapshot: product.name, unitPriceCentsSnapshot: 100,
            quantity, subtotalCents: quantity * 100,
            additions: { create: {
              additionId: addition.id, additionNameSnapshot: addition.name, unitPriceCentsSnapshot: 20,
              quantity: extraQuantity, subtotalCents: extraQuantity * 20,
            } },
          } },
        } })));
      await tx.stockMovement.createMany({ data: [
        { storeId, productId: product.id, quantity: 2, type: 'ORDER_RESERVED', referenceId: orderA.id },
        { storeId, additionId: addition.id, quantity: 1, type: 'ORDER_RESERVED', referenceId: orderA.id },
        { storeId, productId: product.id, quantity: 1, type: 'ORDER_RESERVED', referenceId: orderB.id },
        { storeId, additionId: addition.id, quantity: 3, type: 'ORDER_RESERVED', referenceId: orderB.id },
      ] });
      return { product, addition, orderA, orderB };
    });
    fixturesCreated = true;

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: suffix };
    keys = createServer((req, res) => {
      if (req.url !== '/.well-known/jwks.json') {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }));
    }).listen(0, '127.0.0.1');
    await once(keys, 'listening');
    const issuer = originOf(keys);
    process.env.NEON_AUTH_URL = issuer;
    process.env.PORT = '0';
    const { default: app } = await import('../../src/app');
    const listen = app.listen.bind(app);
    const listening = new Promise<Server>(resolve => {
      t.mock.method(app, 'listen', (_port: string, callback: () => void) => {
        const server = listen(0, '127.0.0.1', () => {
          callback();
          resolve(server);
        });
        api = server;
        return server;
      });
    });
    const schedule = globalThis.setInterval;
    t.mock.method(globalThis, 'setInterval', (callback: () => void, period: number) => {
      const timer = schedule(() => {
        if (period === 10_000) ticks++;
        callback();
      }, period);
      periods.push(period);
      intervals.push(timer);
      return timer;
    });
    await import('../../src/index');
    const apiOrigin = originOf(await listening);
    assert.deepEqual(periods, [10_000, 30_000]);
    const [owner, staff] = await Promise.all([customerSubject, staffSubject].map(subject =>
      new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: suffix }).setIssuer(issuer)
        .setAudience(issuer).setSubject(subject).setExpirationTime('2m').sign(privateKey)));

    async function request<T = unknown>(method: 'GET' | 'POST', path: string, jwt: string, status: number, body?: unknown): Promise<T> {
      const response = await fetch(apiOrigin + '/api/v1' + path, {
        method, headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(4000),
      });
      assert.equal(response.status, status, path);
      return await response.json() as T;
    }
    const post = <T = unknown>(path: string, jwt: string, status: number, body?: unknown) =>
      request<T>('POST', path, jwt, status, body);
    const confirmPath = (orderId: string) => `/stores/${storeId}/pickup/orders/${orderId}/confirm`;
    const lookupPath = `/stores/${storeId}/pickup/by-code`;
    const findOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
    async function snapshot(label: string, productReserved: number, additionReserved: number, completed: number) {
      const productStock = await prisma.productStock.findUniqueOrThrow({ where: { productId: product.id } });
      const additionStock = await prisma.additionStock.findUniqueOrThrow({ where: { additionId: addition.id } });
      const movements = await prisma.stockMovement.findMany({
        where: { storeId, type: 'ORDER_FULFILLED' },
        select: { id: true, referenceId: true, productId: true, additionId: true, quantity: true },
        orderBy: [{ referenceId: 'asc' }, { productId: 'asc' }],
      });
      assert.deepEqual([productStock.availableStock, productStock.reservedStock], [7, productReserved]);
      assert.deepEqual([additionStock.availableStock, additionStock.reservedStock], [6, additionReserved]);
      assert.equal(movements.length, completed * 2);
      if (movements.length) {
        const expected = [[orderA.id, 2, 1], [orderB.id, 1, 3]].slice(0, completed).flatMap(([referenceId, qty, extra]) => [
          { referenceId, productId: product.id, additionId: null, quantity: qty },
          { referenceId, productId: null, additionId: addition.id, quantity: extra },
        ]);
        assert.deepEqual(new Set(movements.map(({ id: _id, ...movement }) => JSON.stringify(movement))),
          new Set(expected.map(movement => JSON.stringify(movement))));
      }
      t.diagnostic(`${label}: producto 7/${productReserved}; adicional 6/${additionReserved}; movimientos ${movements.length}`);
      return { productStock, additionStock, movements };
    }

    type Confirmation = { orderId: string; storeId: string; status: 'COMPLETED'; pickedUpAt: string; alreadyPickedUp: boolean };
    type Credential = { type: 'QR'; token: string } | { type: 'MANUAL'; code: string };
    async function confirmFirst(orderId: string, credential: Credential) {
      const result = await post<Confirmation>(confirmPath(orderId), staff, 200, { credential });
      const saved = await findOrder(orderId);
      assert.ok(saved.pickedUpAt);
      assert.deepEqual(result, {
        orderId, storeId, status: 'COMPLETED', pickedUpAt: saved.pickedUpAt.toISOString(), alreadyPickedUp: false,
      });
      assert.equal(saved.status, 'COMPLETED');
      assert.equal(saved.pickedUpByUserId, staffSubject);
      assert.equal(saved.pickupMethod, credential.type);
      return { result, saved };
    }
    async function confirmAgain(orderId: string, credential: Credential, original: Awaited<ReturnType<typeof confirmFirst>>) {
      assert.deepEqual(await post<Confirmation>(confirmPath(orderId), staff, 200, { credential }),
        { ...original.result, alreadyPickedUp: true });
      assert.deepEqual(await findOrder(orderId), original.saved);
    }

    assert.notEqual(orderA.id, orderB.id);
    const kitchen = '/stores/' + storeId + '/kitchen/orders';
    const qrPath = '/orders/' + orderA.id + '/pickup/qr';
    const manualPath = '/orders/' + orderB.id + '/pickup/manual';
    const ids = [orderA.id, orderB.id];
    const before = await snapshot('Antes de cocina y retiro', 3, 4, 0);
    const queue = await request<{ id: string; status: string }[]>('GET', kitchen, staff, 200);
    assert.deepEqual(new Set(queue.map(({ id, status }) => id + ':' + status)),
      new Set(ids.map(id => id + ':CONFIRMED')));

    for (const id of ids) {
      const started = await post<{ status: string }>(kitchen + '/' + id + '/start', staff, 200);
      assert.equal(started.status, 'PREPARING');
      assert.equal((await findOrder(id)).status, 'PREPARING');
      const finished = await post<{ status: string; preparedAt: string; preparedByUserId: string }>(
        kitchen + '/' + id + '/finish', staff, 200);
      assert.equal(finished.status, 'PREPARING');
      const saved = await findOrder(id);
      assert.ok(saved.preparedAt);
      assert.equal(saved.preparedAt.toISOString(), finished.preparedAt);
      assert.equal(saved.preparedByUserId, staffSubject);
      assert.equal(finished.preparedByUserId, staffSubject);
    }

    const ticksAfterPreparation = ticks;
    while (ticks === ticksAfterPreparation && Date.now() < from.getTime()) {
      await delay(100, undefined, { signal: t.signal });
    }
    assert.ok(ticks > ticksAfterPreparation && Date.now() < from.getTime(), 'Debe ejecutarse un ciclo antes de la ventana');
    for (const id of ids) assert.equal((await findOrder(id)).status, 'PREPARING');
    await post(qrPath, owner, 404);
    await post(manualPath, owner, 404);
    assert.equal(await prisma.pickupToken.count({ where: { orderId: orderA.id } }), 0);
    assert.equal((await findOrder(orderB.id)).pickupCode, null);
    assert.deepEqual(await snapshot('Preparados antes de la ventana', 3, 4, 0), before);
    assert.ok(Date.now() < from.getTime());
    t.diagnostic('Ambos pedidos quedaron PREPARING con stock intacto tras un ciclo antes de su ventana. Emisión QR y manual: 404.');

    const deadline = from.getTime() + 16_000;
    let ready;
    do {
      ready = await prisma.order.findMany({ where: { id: { in: ids }, status: 'READY_FOR_PICKUP' } });
      if (ready.length === ids.length) break;
      await delay(200, undefined, { signal: t.signal });
    } while (Date.now() < deadline);
    assert.equal(ready.length, ids.length);
    assert.ok(Date.now() >= from.getTime() && Date.now() < to.getTime());
    for (const saved of ready) {
      assert.ok(saved.preparedAt);
      assert.equal(saved.preparedByUserId, staffSubject);
      assert.deepEqual(saved.promisedFrom, from);
      assert.deepEqual(saved.promisedTo, to);
    }
    assert.deepEqual(await request('GET', kitchen, staff, 200), []);
    t.diagnostic('El proceso periódico real habilitó los dos pedidos dentro de la ventana y el GET de cocina quedó vacío.');

    const { token } = await post<{ token: string }>(qrPath, owner, 201);
    const qr = { type: 'QR', token } as const;
    const qrDelivery = await confirmFirst(orderA.id, qr);
    const afterQr = await snapshot('QR entregado', 1, 3, 1);
    await confirmAgain(orderA.id, qr, qrDelivery);
    assert.deepEqual(await snapshot('QR repetido', 1, 3, 1), afterQr);

    const { code } = await post<{ code: string }>(manualPath, owner, 201);
    const found = await post<{ orderId: string }>(lookupPath, staff, 200, { code });
    assert.equal(found.orderId, orderB.id);
    const manual = { type: 'MANUAL', code } as const;
    const manualDelivery = await confirmFirst(orderB.id, manual);
    const afterManual = await snapshot('Manual entregado', 0, 0, 2);
    await confirmAgain(orderB.id, manual, manualDelivery);
    assert.deepEqual(await snapshot('Manual repetido', 0, 0, 2), afterManual);
    t.diagnostic('QR y manual: primeras confirmaciones 200 con alreadyPickedUp false; repeticiones 200 con true y auditoría original.');
  } finally {
    for (const timer of intervals) clearInterval(timer);
    try {
      await Promise.all([api, keys].map(server => server?.listening
        ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        : undefined));
    } finally {
      try {
        if (fixturesCreated) await prisma.$transaction(async tx => {
          await tx.stockMovement.deleteMany({ where: { storeId } });
          await tx.pickupToken.deleteMany({ where: { storeId } });
          await tx.order.deleteMany({ where: { storeId } });
          await tx.staffScope.deleteMany({ where: { organizationId } });
          await tx.customer.deleteMany({ where: { authUserId: customerSubject } });
          await tx.productStock.deleteMany({ where: { storeId } });
          await tx.additionStock.deleteMany({ where: { storeId } });
          await tx.product.deleteMany({ where: { storeId } });
          await tx.addition.deleteMany({ where: { storeId } });
          await tx.category.deleteMany({ where: { storeId } });
          await tx.store.deleteMany({ where: { organizationId } });
          await tx.organization.delete({ where: { id: organizationId } });
        });
      } finally {
        if (previousAuth === undefined) delete process.env.NEON_AUTH_URL;
        else process.env.NEON_AUTH_URL = previousAuth;
        if (previousPort === undefined) delete process.env.PORT;
        else process.env.PORT = previousPort;
        await prisma.$disconnect();
      }
    }
  }
});

function originOf(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
