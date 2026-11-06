import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { StockCatalogAvailability } from '../src/modules/catalog/infrastructure/stockCatalogAvailability';
import { createApp } from '../src/app';
test('disponibilidad: oculta agotados y conserva la semántica de stock no configurado', async () => {
  const common = { id: 'stock', storeId: 's1', reservedStock: 0, createdAt: new Date(), updatedAt: new Date() };
  const availability = new StockCatalogAvailability({
    getProductStock: async (storeId, id) => {
      assert.equal(storeId, 's1');
      return id === 'untracked' ? null : { ...common, productId: id, availableStock: id === 'empty' ? 0 : 2 };
    },
    getAdditionStock: async (_storeId, id) => ({ ...common, additionId: id, availableStock: id === 'empty' ? 0 : 1 }),
  });
  const result = await availability.getAvailability('s1', ['available', 'empty', 'untracked'], ['available', 'empty']);
  assert.deepEqual([...result.availableProductIds], ['available', 'untracked']);
  assert.deepEqual([...result.availableAdditionIds], ['available']);
});
test('stock HTTP: rechaza anónimos, clientes y administradores de otro buffet', async () => {
  for (const [actor, expected] of [
    [null, 401],
    [{ userId: 'c', role: 'CUSTOMER' as const }, 403],
    [{ userId: 'u', role: 'STORE_ADMIN' as const, storeId: 'otro' }, 403],
  ] as const) {
    const app = createApp({ resolveActor: async () => actor });
    assert.equal((await request(app).get('/api/v1/stores/s1/stock')).status, expected);
  }
});
