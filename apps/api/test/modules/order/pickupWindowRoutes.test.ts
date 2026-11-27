import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../../../src/app';
import { makeRequireStoreCatalogAccess } from '../../../src/modules/catalog/application/viewStoreCatalog';
import { ListPickupWindowsUseCase } from '../../../src/modules/order/application/listPickupWindowsUseCase';
import { createResolvedDemoStoreSchedule } from '../../../src/modules/order/infrastructure/demoStoreSchedule';
import type { StoreStatus } from '../../../src/modules/organization/domain/store';
import { createStoreCode } from '../../../src/modules/organization/domain/storeCode';
import type { Actor } from '../../../src/shared/auth/actor';

const demoStoreId = 'demo-test-id';
const secondStoreId = 'other-test-id';
const customer: Actor = { role: 'CUSTOMER', userId: 'customer-test' };
const url = (id = demoStoreId) => `/api/v1/stores/${id}/pickup-windows`;
const catalog = { storeId: demoStoreId, categories: [] };

function fixture({
  actor = customer as Actor | null,
  now = '2026-11-27T20:59:59-03:00',
  status = 'ACTIVE' as StoreStatus | null,
  memberships = [demoStoreId, secondStoreId],
} = {}) {
  const lookups: string[] = [];
  const schedules = createResolvedDemoStoreSchedule({
    async findByCode(code) {
      lookups.push(code);
      return status === null ? null : {
        id: demoStoreId,
        code: createStoreCode('SIS001'),
        name: 'Buffet Sistemas',
        organizationId: 'org-test',
        status,
      };
    },
  });
  const useCase = new ListPickupWindowsUseCase(schedules, () => new Date(now));
  const requireCatalogAccess = makeRequireStoreCatalogAccess({
    async isCustomerAssociatedToStore(customerId, storeId) {
      return customerId === customer.userId && memberships.includes(storeId);
    },
  });

  return {
    app: createApp({
      resolveActor: async () => actor,
      pickupWindows: {
        requireCatalogAccess,
        getAvailability: storeId => useCase.getAvailability(storeId),
      },
      storeCatalogUseCases: {
        getStoreCatalog: async () => catalog,
        viewStoreCatalog: async (viewer, storeId) => {
          await requireCatalogAccess(viewer, storeId);
          return catalog;
        },
      },
      customerPreferences: {
        get: async () => ({ dietaryRestrictions: [], allergies: [] }),
        save: async () => { throw new Error('No se deben guardar preferencias'); },
      },
    }),
    lookups,
  };
}

test('devuelve ventanas ISO del día local para un cliente autorizado en SIS001', async () => {
  const { app, lookups } = fixture();
  const { body } = await request(app).get(url()).expect('Cache-Control', 'no-store').expect(200);
  assert.deepEqual(lookups, ['SIS001']);
  assert.equal(body.requiresPickupWindow, true);
  assert.deepEqual(body.windows[0], {
    promisedFrom: '2026-11-28T00:20:00.000Z',
    promisedTo: '2026-11-28T00:25:00.000Z',
    toleranceUntil: '2026-11-28T00:30:00.000Z',
  });
  assert.equal(body.windows.length, 30);
  assert.equal(body.windows.at(-1).toleranceUntil, '2026-11-28T00:59:00.000Z');
  const localDay = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
  });
  for (const window of body.windows) {
    assert.equal(localDay.format(new Date(window.promisedFrom)), '27');
    assert.equal(localDay.format(new Date(window.toleranceUntil)), '27');
  }
});

test('fuera del horario digital devuelve una lista vacía para hoy', async () => {
  for (const now of ['2026-11-27T07:59:59-03:00', '2026-11-27T21:00:00-03:00']) {
    const { app } = fixture({ now });
    await request(app).get(url()).expect(200, { requiresPickupWindow: true, windows: [] });
  }
});

test('otro buffet autorizado no hereda el horario de SIS001', async () => {
  const { app } = fixture();
  await request(app).get(url(secondStoreId)).expect(200, { requiresPickupWindow: false, windows: [] });
});

test('si SIS001 no existe, está inactivo o pendiente de configuración, no ofrece ventanas', async () => {
  for (const status of [null, 'INACTIVE', 'PENDING_SETUP'] as const) {
    const { app } = fixture({ status });
    await request(app).get(url()).expect(200, { requiresPickupWindow: false, windows: [] });
  }
});

test('sin autenticación responde 401 antes de buscar el buffet de demo', async () => {
  const { app, lookups } = fixture({ actor: null });
  await request(app).get(url()).expect(401, {
    error: 'Se requiere autenticación',
    code: 'UNAUTHENTICATED',
  });
  assert.deepEqual(lookups, []);
});

test('sin membresía o para un ID inexistente sin acceso responde 403', async () => {
  const { app, lookups } = fixture({ memberships: [] });
  for (const id of [demoStoreId, 'missing-store']) {
    await request(app).get(url(id)).expect(403, {
      error: 'No tiene acceso al catálogo de este buffet',
      code: 'FORBIDDEN',
    });
  }
  assert.deepEqual(lookups, []);
});

test('la ruta de ventanas requiere un perfil de cliente', async () => {
  const { app, lookups } = fixture({
    actor: { role: 'STORE_ADMIN', userId: 'staff-test', storeId: demoStoreId },
  });
  await request(app).get(url()).expect(403, {
    error: 'Se requiere un perfil de cliente',
    code: 'FORBIDDEN',
  });
  assert.deepEqual(lookups, []);
});

test('la ruta de catálogo sigue disponible en el mismo buffet', async () => {
  const { app, lookups } = fixture();
  await request(app).get(`/api/v1/stores/${demoStoreId}/catalog`).expect(200, catalog);
  assert.deepEqual(lookups, []);
});
