import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createCustomerStoreRouter } from '../../../../src/modules/customer/infrastructure/http/customerStoreRoutes';
import { domainErrorHandler } from '../../../../src/shared/http/domainErrorHandler';
import type { Actor } from '../../../../src/shared/auth/actor';

function app(actor: Actor | null) {
  const instance = express(); instance.use(express.json());
  instance.use(createCustomerStoreRouter({
    resolveActor: async () => actor,
    listStores: async id => { assert.equal(id, 'customer-1'); return []; },
    associateStore: async command => {
      assert.equal(command.customerId, 'customer-1');
      return { customerId: command.customerId, storeId: 'store-1', createdAt: new Date() };
    },
  }));
  instance.use(domainErrorHandler); return instance;
}
test('asociaciones: rechaza acceso anónimo y staff', async () => {
  assert.equal((await request(app(null)).get('/me/stores')).status, 401);
  assert.equal((await request(app({ userId: 'staff', role: 'STORE_ADMIN' })).get('/me/stores')).status, 403);
});
test('asociaciones: lista y deriva siempre el Customer del Actor', async () => {
  const instance = app({ userId: 'customer-1', role: 'CUSTOMER' });
  assert.deepEqual((await request(instance).get('/me/stores')).body, []);
  assert.equal((await request(instance).post('/me/stores').send({ storeCode: 'ABC123', customerId: 'otra-persona' })).status, 201);
  assert.equal((await request(instance).post('/me/stores').send({})).status, 400);
});
