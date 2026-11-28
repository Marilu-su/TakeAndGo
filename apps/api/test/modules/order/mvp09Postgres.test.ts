import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { getPrisma } from '../../../src/infrastructure/database/prisma';
import { makeRequireStoreCatalogAccess } from '../../../src/modules/catalog/application/viewStoreCatalog';
import { CustomerModuleMemberships } from '../../../src/modules/catalog/infrastructure/customerModuleMemberships';
import { createPrismaListCustomerStores } from '../../../src/modules/customer/infrastructure/customerModule';
import { CreateOrderUseCase } from '../../../src/modules/order/application/createOrderUseCase';
import { ListPickupWindowsUseCase } from '../../../src/modules/order/application/listPickupWindowsUseCase';
import { createResolvedDemoStoreSchedule } from '../../../src/modules/order/infrastructure/demoStoreSchedule';
import { createOrderModule } from '../../../src/modules/order/infrastructure/orderModule';
import { placeReservedOrder } from '../../../src/modules/order/infrastructure/prismaOrderReservation';
import { PrismaStoreRepository } from '../../../src/modules/organization/infrastructure/prismaStoreRepository';
import { PrismaStockRepository } from '../../../src/modules/stock/infrastructure/prismaStockRepository';

const databaseName = 'takeandgo_mvp09_e2';
const databaseRole = 'mvp09_e2_runner';
const databaseMarker = 'takeandgo-mvp09-e2-postgres';
const enabled = process.env.RUN_MVP09_POSTGRES === '1';
const clock = () => new Date('2026-11-27T20:59:00-03:00');
const start = '2026-11-28T00:19:00.000Z';
const path = '/api/v1/orders';

describe('MVP-09 con PostgreSQL descartable', {
  skip: enabled ? false : 'Requiere RUN_MVP09_POSTGRES=1 y el contenedor descartable',
}, () => {
  let storeId: string;
  let prisma: ReturnType<typeof getPrisma> | undefined;

  before(async () => {
    const url = URL.parse(process.env.DATABASE_URL ?? '');
    assert.ok(url, 'Se requiere una conexión descartable válida');
    assert.equal(url.protocol, 'postgresql:');
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(Number(url.port) > 1024 && url.port !== '5432', 'Requiere un puerto de prueba explícito');
    assert.equal(url.pathname, `/${databaseName}`);
    assert.equal(url.username, databaseRole);
    const client = getPrisma();
    prisma = client;
    const [identity] = await client.$queryRaw<Array<{ db: string; role: string; marker: string | null }>>`
      SELECT current_database() AS db, current_user AS role,
             current_setting('takeandgo.mvp09_e2', true) AS marker
    `;
    assert.deepEqual(identity, { db: databaseName, role: databaseRole, marker: databaseMarker });
    const store = await client.store.findUniqueOrThrow({ where: { code: 'SIS001' } });
    assert.equal(store.status, 'ACTIVE');
    storeId = store.id;
  });

  after(async () => { await prisma?.$disconnect(); });

  async function withFixture(run: (fixture: Awaited<ReturnType<typeof setup>>) => Promise<void>, now = clock) {
    const fixture = await setup(now);
    try {
      await run(fixture);
    } finally {
      await fixture.clean();
    }
  }

  async function setup(now: () => Date) {
    const client = getPrisma();
    const tag = randomUUID();
    const { category, product, customer } = await client.$transaction(async tx => {
      const category = await tx.category.create({ data: { storeId, name: `MVP09 ${tag}` } });
      const product = await tx.product.create({ data: {
        storeId, categoryId: category.id, name: 'Producto E.2', priceCents: 100,
        basePreparationSeconds: 120,
      } });
      const customer = await tx.customer.create({ data: { name: 'Cliente E.2', email: `${tag}@example.test` } });
      await tx.customerStoreMembership.create({ data: { customerId: customer.id, storeId } });
      await tx.productStock.create({ data: { storeId, productId: product.id, availableStock: 1 } });
      return { category, product, customer };
    });
    const stock = new PrismaStockRepository();
    const schedules = createResolvedDemoStoreSchedule(new PrismaStoreRepository(client));
    const orderModule = createOrderModule(stock, schedules);
    const windows = new ListPickupWindowsUseCase(schedules, now);
    const app = createApp({
      resolveActor: async () => ({ role: 'CUSTOMER', userId: customer.id }),
      orderModule: {
        ...orderModule,
        createOrderUseCase: new CreateOrderUseCase(
          orderModule.orderRepository, stock, undefined, placeReservedOrder, schedules, now,
        ),
      },
      pickupWindows: {
        requireCatalogAccess: makeRequireStoreCatalogAccess(
          new CustomerModuleMemberships(createPrismaListCustomerStores()),
        ),
        getAvailability: id => windows.getAvailability(id),
      },
    });
    const post = (quantity: number, promisedFrom: string) => request(app).post(path).send({
      storeId, promisedFrom, items: [{ productId: product.id, quantity }],
    });
    const state = async () => {
      const balance = await client.productStock.findUniqueOrThrow({ where: { productId: product.id } });
      return {
        orders: await client.order.count({ where: { storeId, customerId: customer.id } }),
        availableStock: balance.availableStock,
        reservedStock: balance.reservedStock,
        movements: await client.stockMovement.findMany({ where: { storeId, productId: product.id } }),
      };
    };
    const clean = async () => client.$transaction(async tx => {
      await tx.stockMovement.deleteMany({ where: { storeId, productId: product.id } });
      await tx.order.deleteMany({ where: { storeId, customerId: customer.id } });
      await tx.product.delete({ where: { id: product.id } });
      await tx.category.delete({ where: { id: category.id } });
      await tx.customerStoreMembership.deleteMany({ where: { storeId, customerId: customer.id } });
      await tx.customer.delete({ where: { id: customer.id } });
    });
    return { app, product, post, state, clean };
  }

  test('lee el horario persistido de SIS001 y aplica apertura y cierre al listar y reservar', async () => {
    let instant = '2026-11-29T07:59:59-03:00';
    await withFixture(async ({ app, post, product, state }) => {
      await getPrisma().productStock.update({ where: { productId: product.id }, data: { availableStock: 2 } });
      const availability = () => request(app).get(`/api/v1/stores/${storeId}/pickup-windows`).expect(200);
      assert.deepEqual((await availability()).body.windows, []);
      instant = '2026-11-29T08:00:00-03:00';
      assert.equal((await availability()).body.windows[0].promisedFrom, '2026-11-29T11:20:00.000Z');
      instant = '2026-11-29T21:29:00-03:00';
      const [last] = (await availability()).body.windows;
      assert.equal(last.promisedFrom, '2026-11-30T00:49:00.000Z');
      assert.equal(last.toleranceUntil, '2026-11-30T00:59:00.000Z');
      await post(1, last.promisedFrom).expect(201);
      const beforeClose = await state();
      instant = '2026-11-29T21:30:00-03:00';
      assert.deepEqual((await availability()).body.windows, []);
      const rejected = await post(1, last.promisedFrom).expect(409);
      assert.equal(rejected.body.code, 'PICKUP_WINDOW_UNAVAILABLE');
      assert.deepEqual(await state(), beforeClose);
    }, () => new Date(instant));
  });

  const initial = { orders: 0, availableStock: 1, reservedStock: 0, movements: [] };

  test('A: stock insuficiente conserva pedidos, saldo y movimientos', () => withFixture(async ({ app, product, post, state }) => {
    const { body: catalog } = await request(app).get(`/api/v1/stores/${storeId}/catalog`).expect(200);
    assert.ok(catalog.categories.some((category: { products: Array<{ id: string }> }) =>
      category.products.some(item => item.id === product.id)));
    const { body: availability } = await request(app).get(`/api/v1/stores/${storeId}/pickup-windows`).expect(200);
    assert.equal(availability.requiresPickupWindow, true);
    assert.equal(availability.windows[0].promisedFrom, start);
    const { body } = await post(2, availability.windows[0].promisedFrom).expect(409);
    assert.equal(body.code, 'INSUFFICIENT_STOCK');
    assert.deepEqual(await state(), initial);
  }));

  test('B: persiste ventana, pedido RESERVED y movimiento de stock', () => withFixture(async ({ app, post, state }) => {
    const { body: availability } = await request(app).get(`/api/v1/stores/${storeId}/pickup-windows`).expect(200);
    const { body: order } = await post(1, availability.windows[0].promisedFrom).expect(201);
    const { body: detail } = await request(app).get(`${path}/${order.id}`).expect(200);
    const fields = {
      status: 'RESERVED',
      scheduledForDate: '2026-11-27T00:00:00.000Z',
      promisedFrom: start,
      promisedTo: '2026-11-28T00:24:00.000Z',
      toleranceUntil: '2026-11-28T00:29:00.000Z',
      reservedUntil: '2026-11-28T00:04:00.000Z',
    };
    for (const [field, value] of Object.entries(fields)) {
      assert.equal(order[field], value, field);
      assert.equal(detail[field], value, field);
    }
    const { orders, availableStock, reservedStock, movements } = await state();
    assert.deepEqual({ orders, availableStock, reservedStock }, { orders: 1, availableStock: 0, reservedStock: 1 });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].type, 'ORDER_RESERVED');
    assert.equal(movements[0].referenceId, order.id);
    assert.equal(movements[0].quantity, -1);
  }));

  test('C: rechaza una ventana vencida sin crear pedido ni reserva', () => withFixture(async ({ post, state }) => {
    const { body } = await post(1, '2026-11-28T00:18:00.000Z').expect(409);
    assert.equal(body.code, 'PICKUP_WINDOW_UNAVAILABLE');
    assert.deepEqual(await state(), initial);
  }));
});
