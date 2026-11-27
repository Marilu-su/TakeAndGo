import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';

import { CreateOrderUseCase } from '../../../src/modules/order/application/createOrderUseCase';
import { ListPickupWindowsUseCase } from '../../../src/modules/order/application/listPickupWindowsUseCase';
import type { Order } from '../../../src/modules/order/domain/order';
import type { CreateOrderInput, OrderRepository } from '../../../src/modules/order/domain/orderRepository';
import { createDemoStoreSchedule } from '../../../src/modules/order/infrastructure/demoStoreSchedule';
import { createOrderRouter } from '../../../src/modules/order/infrastructure/http/orderRoutes';
import type { OrderModule } from '../../../src/modules/order/infrastructure/orderModule';
import type { StockRepository } from '../../../src/modules/stock/domain/stockRepository';
import { domainErrorHandler } from '../../../src/shared/http/domainErrorHandler';

const now = '2026-11-27T20:59:00-03:00';
const promisedFrom = '2026-11-28T00:19:00.000Z';
const temporalFields = {
  scheduledForDate: '2026-11-27T00:00:00.000Z',
  promisedFrom,
  promisedTo: '2026-11-28T00:24:00.000Z',
  toleranceUntil: '2026-11-28T00:29:00.000Z',
  reservedUntil: '2026-11-28T00:04:00.000Z',
};
const path = '/api/v1/orders';

function fixture({
  instant = now,
  afterLock = instant,
  storeId = 'demo',
  stockAvailable = true,
} = {}) {
  let currentTime = instant;
  const clock = () => new Date(currentTime);
  const schedules = createDemoStoreSchedule('demo');
  const writes: string[] = [];
  let order: Order | null = null;
  const product = { id: 'p1', name: 'Producto', storeId, priceCents: 100, isActive: true };
  const addition = { id: 'a1', name: 'Adicional', storeId, priceCents: 20, isActive: true };
  const repository = {
    findById: async () => order,
    create: async (input: CreateOrderInput) => {
      writes.push('create');
      order = { ...input, id: 'o1' } as Order;
      return order;
    },
  };
  const stock = {
    hasSufficientStock: async () => stockAvailable,
    reserveStock: async () => { writes.push('reserve'); },
  };
  const useCase = new CreateOrderUseCase(
    repository as unknown as OrderRepository,
    stock as unknown as StockRepository,
    { getStore: async () => ({ id: storeId }), getProduct: async () => product, getAddition: async () => addition },
    async (input, _items, finalize) => {
      currentTime = afterLock;
      const created = await repository.create(finalize ? finalize(input) : input);
      await stock.reserveStock();
      return created;
    },
    schedules,
    clock,
  );

  const app = express();
  app.use(express.json());
  app.use('/api/v1', createOrderRouter({
    orderRepository: repository,
    createOrderUseCase: useCase,
  } as unknown as OrderModule, {
    resolveActor: async () => ({ role: 'CUSTOMER', userId: 'c1' }),
    getCustomerPreferences: async () => ({ dietaryRestrictions: [], allergies: [] }),
    listOrders: async () => order ? [order] : [],
    viewCatalog: async () => ({
      storeId,
      categories: [{
        id: 'cat',
        name: 'Categoría',
        products: [{
          ...product,
          description: null,
          basePreparationSeconds: 0,
          dietaryTags: [],
          allergens: [],
          allergensVerified: true,
          additions: [addition],
        }],
      }],
    }),
  }));
  app.use(domainErrorHandler);

  return {
    app,
    writes,
    listWindows: () => new ListPickupWindowsUseCase(schedules, clock).execute(storeId),
    body: { storeId, items: [{ productId: 'p1', quantity: 2, additionIds: ['a1'] }] },
  };
}

test('crea RESERVED, calcula los cuatro campos y conserva precio, snapshots y reserva de cinco minutos', async () => {
  const { app, body, writes } = fixture();
  const { body: order } = await request(app).post(path).send({
    ...body,
    promisedFrom,
    promisedTo: '2026-11-29T00:00:00.000Z',
    scheduledForDate: '2026-11-29T00:00:00.000Z',
    toleranceUntil: '2026-11-29T00:00:00.000Z',
    totalCents: 1,
  }).expect(201);
  assert.equal(order.status, 'RESERVED');
  assert.equal(order.totalCents, 240);
  assert.equal(order.items[0].unitPriceCentsSnapshot, 100);
  assert.equal(order.items[0].productNameSnapshot, 'Producto');
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].additions[0].unitPriceCentsSnapshot, 20);
  assert.deepEqual(writes, ['create', 'reserve']);
  const { body: detail } = await request(app).get(`${path}/o1`).expect(200);
  const { body: [listed] } = await request(app).get(path).expect(200);
  for (const [key, expected] of Object.entries(temporalFields)) {
    assert.equal(order[key], expected);
    assert.equal(detail[key], expected);
    assert.equal(listed[key], expected);
  }
});

test('devuelve 400 para valores inválidos, días inexistentes y fechas sin zona', async () => {
  const { app, body, writes } = fixture();
  for (const value of [null, 42, '', '2026-11-28T00:19:00', '2026-02-30T00:19:00Z']) {
    const response = await request(app).post(path).send({ ...body, promisedFrom: value }).expect(400);
    assert.equal(response.body.code, 'INVALID_REQUEST');
  }
  assert.deepEqual(writes, []);
});

test('devuelve 409 para una ventana pasada, demasiado cercana, fuera del minuto o futura', async () => {
  const { app, body, writes } = fixture();
  for (const value of [
    '2026-11-27T20:58:00-03:00',
    '2026-11-28T00:18:00Z',
    '2026-11-28T00:19:01Z',
    '2026-11-28T21:19:00-03:00',
  ]) {
    const response = await request(app).post(path).send({ ...body, promisedFrom: value }).expect(409);
    assert.equal(response.body.code, 'PICKUP_WINDOW_UNAVAILABLE');
  }
  assert.deepEqual(writes, []);
});

test('devuelve 409 si la tolerancia llega al cierre operativo o lo supera', async () => {
  const { app, body, writes } = fixture();
  for (const value of ['2026-11-27T21:50:00-03:00', '2026-11-27T21:51:00-03:00']) {
    const response = await request(app).post(path).send({ ...body, promisedFrom: value }).expect(409);
    assert.equal(response.body.code, 'PICKUP_WINDOW_UNAVAILABLE');
  }
  assert.deepEqual(writes, []);
});

test('devuelve 409 antes de abrir, al cierre digital y sin horario habilitado', async () => {
  for (const options of [
    { instant: '2026-11-27T07:59:00-03:00' },
    { instant: '2026-11-27T21:30:00-03:00' },
    { storeId: 'other' },
  ]) {
    const { app, body, writes } = fixture(options);
    const response = await request(app).post(path).send({ ...body, promisedFrom }).expect(409);
    assert.equal(response.body.code, 'PICKUP_WINDOW_UNAVAILABLE');
    assert.deepEqual(writes, []);
  }
});

test('rechaza sin escrituras si una ventana consultada deja de ser válida durante la espera del bloqueo', async () => {
  const { app, body, writes, listWindows } = fixture({ afterLock: '2026-11-27T20:59:00.001-03:00' });
  const [selected] = await listWindows();
  assert.equal(selected.promisedFrom.toISOString(), promisedFrom);
  const response = await request(app).post(path).send({ ...body, promisedFrom }).expect(409);
  assert.equal(response.body.code, 'PICKUP_WINDOW_UNAVAILABLE');
  assert.deepEqual(writes, []);
});

test('calcula el vencimiento del pago con el instante posterior al bloqueo', async () => {
  const { app, body } = fixture({ afterLock: '2026-11-27T20:59:10-03:00' });
  const response = await request(app).post(path).send({
    ...body,
    promisedFrom: '2026-11-27T21:20:00-03:00',
  }).expect(201);
  assert.equal(response.body.promisedFrom, '2026-11-28T00:20:00.000Z');
  assert.equal(response.body.reservedUntil, '2026-11-28T00:04:10.000Z');
});

test('con una ventana válida conserva el 409 por stock insuficiente', async () => {
  const { app, body, writes } = fixture({ stockAvailable: false });
  const response = await request(app).post(path).send({ ...body, promisedFrom }).expect(409);
  assert.equal(response.body.code, 'INSUFFICIENT_STOCK');
  assert.deepEqual(writes, []);
});

test('permite crear una reserva sin promisedFrom fuera del buffet de demo', async () => {
  const { app, body, writes } = fixture({ storeId: 'other' });
  const response = await request(app).post(path).send(body).expect(201);
  assert.equal(response.body.status, 'RESERVED');
  assert.equal(response.body.totalCents, 240);
  assert.equal(response.body.reservedUntil, temporalFields.reservedUntil);
  assert.equal(response.body.promisedFrom, undefined);
  assert.deepEqual(writes, ['create', 'reserve']);
});

test('exige promisedFrom en el buffet de demo y rechaza sin escrituras', async () => {
  const { app, body, writes } = fixture();
  const response = await request(app).post(path).send(body).expect(400);
  assert.equal(response.body.code, 'INVALID_REQUEST');
  assert.deepEqual(writes, []);
});
