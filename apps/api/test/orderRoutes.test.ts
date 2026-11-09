import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createOrderRouter } from '../src/modules/order/infrastructure/http/orderRoutes';
import type { OrderModule } from '../src/modules/order/infrastructure/orderModule';
import type { Actor } from '../src/shared/auth/actor';
import { domainErrorHandler } from '../src/shared/http/domainErrorHandler';
import { DomainError } from '../src/shared/domain/DomainError';

function app(actor: Actor | null, status = 'RESERVED', member = true) {
  const instance = express(); instance.use(express.json());
  const order = { id: 'o1', customerId: 'c1', storeId: 's1', status, pickupCode: 'secret-code' };
  const module = {
    orderRepository: { findById: async () => order },
    createOrderUseCase: { execute: async (input: object) => ({ ...input, pickupCode: 'secret-code' }) },
    cancelOrderUseCase: { execute: async () => ({ ...order, status: 'CANCELLED' }) },
  } as unknown as OrderModule;
  instance.use(createOrderRouter(module, {
    resolveActor: async () => actor,
    listOrders: async id => { assert.equal(id, 'c1'); return [order] as never; },
    viewCatalog: async () => {
      if (!member) throw new DomainError('FORBIDDEN', 'Sin membresía');
      return { storeId: 's1', categories: [{ id: 'cat', name: 'Cat', products: [{ id: 'p1', name: 'P', description: null, priceCents: 100, basePreparationSeconds: 0, additions: [{ id: 'a1', name: 'A', priceCents: 20 }] }] }] };
    },
  })); instance.use(domainErrorHandler); return instance;
}
const actor: Actor = { userId: 'c1', role: 'CUSTOMER' };
const body = { storeId: 's1', customerId: 'otra-persona', items: [{ productId: 'p1', quantity: 1, additionIds: ['a1'] }] };
test('pedidos: rechaza anónimos y staff', async () => {
  assert.equal((await request(app(null)).post('/orders').send(body)).status, 401);
  assert.equal((await request(app({ userId: 'u', role: 'STORE_ADMIN' })).get('/orders')).status, 403);
});
test('pedidos: usa el Customer del Actor e ignora precios enviados', async () => {
  const response = await request(app(actor)).post('/orders').send({ ...body, totalCents: 1 });
  assert.equal(response.status, 201); assert.equal(response.body.customerId, 'c1'); assert.equal(response.body.totalCents, undefined);
});
test('pedidos: valida membresía, cantidades y adicionales del producto', async () => {
  assert.equal((await request(app(actor, 'RESERVED', false)).post('/orders').send(body)).status, 403);
  for (const quantity of [0, -1, 1.5]) assert.equal((await request(app(actor)).post('/orders').send({ ...body, items: [{ productId: 'p1', quantity }] })).status, 400);
  for (const additionIds of [['ajeno'], ['a1', 'a1']]) assert.equal((await request(app(actor)).post('/orders').send({ ...body, items: [{ productId: 'p1', quantity: 1, additionIds }] })).status, 400);
});
test('pedidos: oculta pedidos de otro cliente para consulta y cancelación', async () => {
  const instance = app({ userId: 'otro', role: 'CUSTOMER' });
  assert.equal((await request(instance).get('/orders/o1')).status, 404);
  assert.equal((await request(instance).post('/orders/o1/cancel')).status, 404);
});
test('pedidos: permite consultar historial y cancelar solo reservas pendientes', async () => {
  assert.equal((await request(app(actor)).get('/orders')).status, 200);
  assert.equal((await request(app(actor)).post('/orders/o1/cancel')).status, 200);
  assert.equal((await request(app(actor, 'CONFIRMED')).post('/orders/o1/cancel')).status, 409);
});
test('pedidos: la liberación global no puede ser invocada por clientes', async () => {
  assert.equal((await request(app(actor)).post('/orders/release-expired')).status, 403);
});

test('pedidos: no expone códigos de retiro al crear, listar, consultar o cancelar', async () => {
  const instance = app(actor);
  const created = await request(instance).post('/orders').send(body);
  assert.equal(created.status, 201);
  assert.equal(Object.hasOwn(created.body, 'pickupCode'), false);
  const listed = await request(instance).get('/orders');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(Object.hasOwn(listed.body[0], 'pickupCode'), false);
  const detail = await request(instance).get('/orders/o1');
  assert.equal(detail.status, 200);
  assert.equal(Object.hasOwn(detail.body, 'pickupCode'), false);
  const cancelled = await request(instance).post('/orders/o1/cancel');
  assert.equal(cancelled.status, 200);
  assert.equal(Object.hasOwn(cancelled.body, 'pickupCode'), false);
});
