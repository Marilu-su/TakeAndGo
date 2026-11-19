import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../src/app';
import type { Actor } from '../../../src/shared/auth/actor';
import type {
    AdditionUseCases,
    ProductUseCases,
} from '../../../src/modules/catalog/infrastructure/catalogModule';
import type { StockRepository } from '../../../src/modules/stock/domain/stockRepository';

const admin: Actor = { userId: 'admin-1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 's1' };
const now = new Date();

function appWith(actor: Actor | null, stock: Partial<StockRepository>) {
    return createApp({
        checkDatabase: async () => true,
        resolveActor: async () => actor,
        productUseCases: { listProducts: async () => [{ id: 'p1', name: 'Café' }] } as unknown as ProductUseCases,
        additionUseCases: { listAdditions: async () => [{ id: 'a1', name: 'Medialuna extra' }] } as unknown as AdditionUseCases,
        stockModule: { stockRepository: stock as StockRepository },
    });
}

test('reponer stock suma unidades con el actor y el motivo', async () => {
    let received: unknown[] = [];
    const app = appWith(admin, {
        restockProduct: async (...args) => {
        received = args;
        return { id: 'st', storeId: 's1', productId: 'p1', availableStock: 15, reservedStock: 0, createdAt: now, updatedAt: now };
        },
    });

    const response = await request(app)
        .post('/api/v1/stores/s1/stock/restock')
        .send({ productId: 'p1', quantity: 5, reason: '  Llegada de proveedor ' });

    assert.equal(response.status, 201);
    assert.equal(response.body.availableStock, 15);
    assert.deepEqual(received, ['s1', 'p1', 5, 'Llegada de proveedor', 'admin-1']);
});

test('reponer rechaza cantidades inválidas, falta de motivo o producto y adicional a la vez', async () => {
    const app = appWith(admin, {});
    const invalidBodies = [
        { productId: 'p1', quantity: 0, reason: 'x' },
        { productId: 'p1', quantity: 2.5, reason: 'x' },
        { productId: 'p1', quantity: 100001, reason: 'x' },
        { productId: 'p1', quantity: 5, reason: '   ' },
        { productId: 'p1', additionId: 'a1', quantity: 5, reason: 'x' },
        { quantity: 5, reason: 'x' },
    ];

    for (const body of invalidBodies) {
        const response = await request(app).post('/api/v1/stores/s1/stock/restock').send(body);
        assert.equal(response.status, 400, JSON.stringify(body));
    }
});

test('reponer un producto de otro buffet responde 404', async () => {
    const response = await request(appWith(admin, {}))
        .post('/api/v1/stores/s1/stock/restock')
        .send({ productId: 'producto-ajeno', quantity: 5, reason: 'x' });

    assert.equal(response.status, 404);
});

test('solo el administrador del buffet puede reponer o ver movimientos', async () => {
    const others: Array<[Actor | null, number]> = [
        [null, 401],
        [{ userId: 'c', role: 'CUSTOMER' }, 403],
        [{ userId: 'e', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: 's1' }, 403],
        [{ userId: 'o', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'otro' }, 403],
    ];

    for (const [actor, expected] of others) {
        const app = appWith(actor, {});
        assert.equal((await request(app).post('/api/v1/stores/s1/stock/restock').send({ productId: 'p1', quantity: 1, reason: 'x' })).status, expected);
        assert.equal((await request(app).get('/api/v1/stores/s1/stock/movements')).status, expected);
    }
});

test('el historial devuelve los movimientos con el nombre del producto o adicional', async () => {
    let receivedLimit: number | undefined;
    const app = appWith(admin, {
        listMovements: async (_storeId, limit) => {
        receivedLimit = limit;
        return [
            { id: 'm1', productId: 'p1', additionId: null, quantity: 10, type: 'RESTOCK', reason: 'Proveedor', actorUserId: 'admin-1', referenceId: null, createdAt: now },
            { id: 'm2', productId: null, additionId: 'a1', quantity: -2, type: 'INVENTORY_ADJUSTMENT', reason: 'Conteo', actorUserId: 'admin-1', referenceId: null, createdAt: now },
        ];
        },
    });

    const response = await request(app).get('/api/v1/stores/s1/stock/movements?limit=10');

    assert.equal(response.status, 200);
    assert.equal(receivedLimit, 10);
    assert.deepEqual(response.body.map((m: { itemName: string }) => m.itemName), ['Café', 'Medialuna extra']);
});