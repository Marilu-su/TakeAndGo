import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp, type AppDependencies } from '../../../../src/app';
import type { Actor } from '../../../../src/shared/auth/actor';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { StoreCatalog } from '../../../../src/modules/catalog/domain/storeCatalog';
import type { StoreCatalogUseCases } from '../../../../src/modules/catalog/infrastructure/catalogModule';

const URL = '/api/v1/stores/store-a/catalog';

const customer: Actor = { userId: 'customer-1', role: 'CUSTOMER' };

const catalog: StoreCatalog = {
    storeId: 'store-a',
    categories: [
        {
        id: 'bebidas',
        name: 'Bebidas',
        products: [
            {
            id: 'cafe',
            name: 'Café con leche',
            description: null,
            priceCents: 150000,
            basePreparationSeconds: 120,
            dietaryTags: ['VEGETARIAN'],
            allergens: ['Leche'],
            allergensVerified: true,
            additions: [{ id: 'almendras', name: 'Leche de almendras', priceCents: 50000 }],
            },
        ],
        },
    ],
};

function appWith(actor: Actor | null, viewStoreCatalog: StoreCatalogUseCases['viewStoreCatalog'], customerPreferences: AppDependencies['customerPreferences'] = {
    get: async id => { assert.equal(id, customer.userId); return { dietaryRestrictions: [], allergies: [] }; },
    save: async () => { throw new Error('No debe guardar preferencias al consultar'); },
}) {
    return createApp({
        checkDatabase: async () => true,
        customerPreferences,
        resolveActor: async () => actor,
        storeCatalogUseCases: {
        getStoreCatalog: async () => catalog,
        viewStoreCatalog,
        },
    });
}

test('sin usuario autenticado el catálogo responde 401', async () => {
    const response = await request(appWith(null, async () => catalog)).get(URL);

    assert.equal(response.status, 401);
});

test('devuelve el catálogo del buffet de la URL para el usuario identificado', async () => {
    let receivedActor: Actor | undefined;
    let receivedStoreId: string | undefined;

    const app = appWith(customer, async (actor, storeId) => {
        receivedActor = actor;
        receivedStoreId = storeId;
        return catalog;
    });

    const response = await request(app).get(URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.categories[0].products[0].name, 'Café con leche');
    assert.equal(receivedActor?.userId, 'customer-1');
    assert.equal(receivedStoreId, 'store-a');
});

test('traduce los errores del catálogo a códigos HTTP', async () => {
    const cases: Array<[string, number]> = [
        ['FORBIDDEN', 403],
        ['STORE_NOT_FOUND', 404],
    ];

    for (const [code, status] of cases) {
        const app = appWith(customer, async () => {
        throw new DomainError(code, 'Error de prueba');
        });

        const response = await request(app).get(URL);

        assert.equal(response.status, status, `${code} debería responder ${status}`);
    }
});

test('filtra el catálogo según las preferencias del Customer identificado', async () => {
    for (const preferences of [
        { dietaryRestrictions: ['VEGAN'], allergies: [] },
        { dietaryRestrictions: [], allergies: ['leche'] },
    ]) {
        const app = appWith(customer, async () => catalog, {
            get: async id => { assert.equal(id, customer.userId); return preferences; },
            save: async () => { throw new Error('No debe guardar'); },
        });
        const response = await request(app).get(URL);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.categories, []);
    }
});

test('un Customer inexistente responde 404 al consultar catálogo o crear un pedido', async () => {
    const app = appWith(customer, async () => catalog, {
        get: async () => { throw new DomainError('CUSTOMER_NOT_FOUND', 'No se encontró el perfil de cliente.'); },
        save: async () => { throw new DomainError('CUSTOMER_NOT_FOUND', 'No se encontro el perfil de cliente.'); },
    });
    const responses = [
        await request(app).get(URL),
        await request(app).post('/api/v1/orders').send({ storeId: 'store-a', items: [{ productId: 'cafe', quantity: 1 }] }),
    ];
    for (const response of responses) {
        assert.equal(response.status, 404);
        assert.equal(response.body.code, 'CUSTOMER_NOT_FOUND');
    }
    for (const response of [
        await request(app).get('/api/v1/me/preferences'),
        await request(app).patch('/api/v1/me/preferences').send({ dietaryRestrictions: [], allergies: [] }),
    ]) {
        assert.equal(response.status, 404);
        assert.equal(response.body.code, 'NOT_FOUND');
    }
});
