import '../support/checkTestDatabase';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { getPrisma } from '../../src/infrastructure/database/prisma';

test('retiro HTTP con Prisma: QR y código manual consumen la reserva una sola vez', {
  skip: process.env.MVP12_PICKUP_INTEGRATION !== '1' && 'Requiere PostgreSQL descartable verificado',
  timeout: 30_000,
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
  const otherStoreId = randomUUID();
  const customerSubjects = [`owner-${suffix}`, `outsider-${suffix}`];
  const staffSubjects = [`staff-${suffix}`, `other-staff-${suffix}`];
  let fixturesCreated = false;
  let keys: Server | undefined;
  let api: Server | undefined;
  const previousAuth = process.env.NEON_AUTH_URL;

  try {
    const [identity] = await prisma.$queryRaw<{ db: string; role: string; marker: string }[]>`
      SELECT current_database() AS db, current_user AS role, current_setting('takeandgo.mvp09_t08', true) AS marker
    `;
    assert.ok(identity?.db === 'takeandgo' && identity.role === decodeURIComponent(db.username)
      && identity.marker === 'takeandgo-mvp09-t08-postgres', 'Identidad de PostgreSQL inesperada');

    const { product, addition, orderA, orderB } = await prisma.$transaction(async tx => {
      await tx.organization.create({ data: { id: organizationId, name: `Retiro ${suffix}` } });
      await tx.store.createMany({ data: [
        { id: storeId, organizationId, name: 'Buffet retiro', code: `R${suffix.slice(0, 8)}` },
        { id: otherStoreId, organizationId, name: 'Otro buffet', code: `O${suffix.slice(0, 8)}` },
      ] });
      const [owner] = await Promise.all(customerSubjects.map(authUserId =>
        tx.customer.create({ data: { authUserId, name: 'Cliente de prueba', email: `${authUserId}@example.test` } })));
      await tx.staffScope.createMany({ data: staffSubjects.map((authUserId, index) => ({
        authUserId, organizationId, storeId: index === 0 ? storeId : otherStoreId, role: 'STORE_EMPLOYEE',
      })) });
      const category = await tx.category.create({ data: { storeId, name: 'Categoría de prueba' } });
      const product = await tx.product.create({ data: {
        storeId, categoryId: category.id, name: 'Producto', priceCents: 100, basePreparationSeconds: 60,
      } });
      const addition = await tx.addition.create({ data: { storeId, name: 'Adicional', priceCents: 20 } });
      await tx.productStock.create({ data: { storeId, productId: product.id, availableStock: 7, reservedStock: 3 } });
      await tx.additionStock.create({ data: { storeId, additionId: addition.id, availableStock: 6, reservedStock: 4 } });
      const [orderA, orderB] = await Promise.all([[1, 2, 1], [2, 1, 3]].map(([orderNumber, quantity, extraQuantity]) =>
        tx.order.create({ data: {
          storeId, customerId: owner.id, orderNumber, status: 'READY_FOR_PICKUP',
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
    const { default: app } = await import('../../src/app');
    api = app.listen(0, '127.0.0.1');
    await once(api, 'listening');
    const apiOrigin = originOf(api);
    const [owner, outsider, staff, otherStaff] = await Promise.all([...customerSubjects, ...staffSubjects].map(subject =>
      new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: suffix }).setIssuer(issuer)
        .setAudience(issuer).setSubject(subject).setExpirationTime('2m').sign(privateKey)));

    async function post<T = unknown>(path: string, jwt: string, status: number, body?: unknown): Promise<T> {
      const response = await fetch(apiOrigin + '/api/v1' + path, {
        method: 'POST', headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(4000),
      });
      assert.equal(response.status, status, path);
      return await response.json() as T;
    }
    const confirmPath = (orderId: string) => `/stores/${storeId}/pickup/orders/${orderId}/confirm`;
    const lookupPath = `/stores/${storeId}/pickup/by-code`;
    const findOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
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
      assert.equal(saved.pickedUpByUserId, staffSubjects[0]);
      assert.equal(saved.pickupMethod, credential.type);
      return { result, saved };
    }
    async function confirmAgain(orderId: string, credential: Credential, original: Awaited<ReturnType<typeof confirmFirst>>) {
      assert.deepEqual(await post<Confirmation>(confirmPath(orderId), staff, 200, { credential }),
        { ...original.result, alreadyPickedUp: true });
      assert.deepEqual(await findOrder(orderId), original.saved);
    }

    assert.notEqual(orderA.id, orderB.id);
    const beforeQr = await snapshot('QR antes', 3, 4, 0);
    const qrPath = `/orders/${orderA.id}/pickup/qr`;
    await post(qrPath, outsider, 404);
    assert.equal(await prisma.pickupToken.count({ where: { orderId: orderA.id } }), 0);
    const { token, expiresAt } = await post<{ token: string; expiresAt: string }>(qrPath, owner, 201);
    assert.ok(/^[a-f0-9]{64}$/.test(token));
    const tokenHash = hash(token);
    const findQr = () => prisma.pickupToken.findUniqueOrThrow({ where: { tokenHash } });
    const issued = await findQr();
    assert.equal(issued.orderId, orderA.id);
    assert.equal(issued.storeId, storeId);
    assert.equal(issued.expiresAt.toISOString(), expiresAt);
    assert.equal(issued.usedAt, null);
    const qr = { type: 'QR', token } as const;
    await post(confirmPath(orderA.id), otherStaff, 403, { credential: qr });
    assert.deepEqual(await findQr(), issued);
    assert.deepEqual(await findOrder(orderA.id), orderA);
    assert.deepEqual(await snapshot('QR tras rechazo', 3, 4, 0), beforeQr);

    const qrDelivery = await confirmFirst(orderA.id, qr);
    const consumed = await findQr();
    assert.deepEqual(consumed.usedAt, qrDelivery.saved.pickedUpAt);
    const afterQr = await snapshot('QR después', 1, 3, 1);
    await confirmAgain(orderA.id, qr, qrDelivery);
    assert.deepEqual(await findQr(), consumed);
    assert.deepEqual(await snapshot('QR después de repetir', 1, 3, 1), afterQr);

    const beforeManual = await snapshot('Manual antes', 1, 3, 1);
    const { code } = await post<{ code: string }>(`/orders/${orderB.id}/pickup/manual`, owner, 201);
    assert.ok(/^[A-Za-z0-9_-]{12}$/.test(code));
    assert.ok((await findOrder(orderB.id)).pickupCode === hash(code), 'El código manual debe persistirse por hash');
    const found = await post<{ orderId: string; storeId: string; status: string }>(lookupPath, staff, 200, { code });
    assert.equal(found.orderId, orderB.id);
    assert.equal(found.storeId, storeId);
    assert.equal(found.status, 'READY_FOR_PICKUP');
    await post(lookupPath, otherStaff, 403, { code });
    const manual = { type: 'MANUAL', code } as const;
    await post(confirmPath(orderB.id), otherStaff, 403, { credential: manual });
    assert.deepEqual(await snapshot('Manual tras rechazo', 1, 3, 1), beforeManual);

    const manualDelivery = await confirmFirst(orderB.id, manual);
    const afterManual = await snapshot('Manual después', 0, 0, 2);
    await post(lookupPath, staff, 404, { code });
    await confirmAgain(orderB.id, manual, manualDelivery);
    assert.deepEqual(await snapshot('Manual después de repetir', 0, 0, 2), afterManual);
    t.diagnostic('Titular: emisión 201. Cliente ajeno: QR 404. Staff ajeno: 403. Primera entrega y repetición: 200 con indicadores distintos.');
  } finally {
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
          await tx.customer.deleteMany({ where: { authUserId: { in: customerSubjects } } });
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
