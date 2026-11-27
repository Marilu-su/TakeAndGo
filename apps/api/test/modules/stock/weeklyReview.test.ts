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
import { parseWeeklyReviewItems, startOfWeek } from '../../../src/modules/stock/domain/weeklyReview';

const admin: Actor = { userId: 'admin-1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 's1' };
const URL = '/api/v1/stores/s1/stock/weekly-review';

function appWith(actor: Actor | null, stock: Partial<StockRepository>) {
    return createApp({
        checkDatabase: async () => true,
        resolveActor: async () => actor,
        productUseCases: { listProducts: async () => [{ id: 'p1', name: 'Café' }] } as unknown as ProductUseCases,
        additionUseCases: { listAdditions: async () => [{ id: 'a1', name: 'Medialuna extra' }] } as unknown as AdditionUseCases,
        stockModule: { stockRepository: stock as StockRepository },
    });
}

// Inicio de la semana en hora argentina

test('la semana empieza el lunes a las 00:00 de Argentina', () => {
    const monday = '2026-11-16T03:00:00.000Z';

    // Miércoles 18/11 a las 23:20 en Argentina
    assert.equal(startOfWeek(new Date('2026-11-19T02:20:00Z')).toISOString(), monday);
    // Lunes 16/11 a las 00:30 en Argentina
    assert.equal(startOfWeek(new Date('2026-11-16T03:30:00Z')).toISOString(), monday);
    // Domingo 15/11 a las 23:59 en Argentina: todavía es la semana anterior
    assert.equal(startOfWeek(new Date('2026-11-16T02:59:00Z')).toISOString(), '2026-11-09T03:00:00.000Z');
});

// Validación de la lista

test('valida los ítems de la revisión', () => {
    assert.deepEqual(parseWeeklyReviewItems([{ productId: 'p1', countedStock: 4 }, { additionId: 'a1', countedStock: 0 }]), [
        { productId: 'p1', countedStock: 4 },
        { additionId: 'a1', countedStock: 0 },
    ]);

    const invalid = [
        [],
        'no-es-lista',
        [{ productId: 'p1', additionId: 'a1', countedStock: 1 }],
        [{ countedStock: 1 }],
        [{ productId: 'p1', countedStock: -1 }],
        [{ productId: 'p1', countedStock: 1.5 }],
        [{ productId: 'p1', countedStock: 1 }, { productId: 'p1', countedStock: 2 }],
    ];

    for (const value of invalid) {
        assert.throws(() => parseWeeklyReviewItems(value), { code: 'INVALID_REQUEST' }, JSON.stringify(value));
    }
});

// Endpoints

test('registra la revisión semanal con el actor', async () => {
    let received: unknown[] = [];
    const app = appWith(admin, {
        recordWeeklyReview: async (...args) => {
        received = args;
        return 'review-1';
        },
    });

    const response = await request(app).post(URL).send({ items: [{ productId: 'p1', countedStock: 8 }] });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { reviewId: 'review-1', reviewedItems: 1 });
    assert.deepEqual(received, ['s1', [{ productId: 'p1', countedStock: 8 }], 'admin-1']);
});

test('la revisión rechaza productos de otro buffet y ítems inválidos', async () => {
    const app = appWith(admin, {});

    assert.equal((await request(app).post(URL).send({ items: [{ productId: 'ajeno', countedStock: 1 }] })).status, 404);
    assert.equal((await request(app).post(URL).send({ items: [] })).status, 400);
});

test('el estado indica si la revisión de esta semana está hecha', async () => {
    const today = await request(appWith(admin, { findLastWeeklyReviewAt: async () => new Date() })).get(URL);
    const tenDaysAgo = await request(
        appWith(admin, { findLastWeeklyReviewAt: async () => new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }),
    ).get(URL);
    const never = await request(appWith(admin, { findLastWeeklyReviewAt: async () => null })).get(URL);

    assert.equal(today.body.done, true);
    assert.equal(tenDaysAgo.body.done, false);
    assert.equal(never.body.done, false);
    assert.equal(never.body.lastReviewAt, null);
});

test('solo el administrador del buffet registra o consulta la revisión', async () => {
    const others: Array<[Actor | null, number]> = [
        [null, 401],
        [{ userId: 'e', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: 's1' }, 403],
        [{ userId: 'o', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'otro' }, 403],
    ];

    for (const [actor, expected] of others) {
        const app = appWith(actor, {});
        assert.equal((await request(app).post(URL).send({ items: [{ productId: 'p1', countedStock: 1 }] })).status, expected);
        assert.equal((await request(app).get(URL)).status, expected);
    }
});