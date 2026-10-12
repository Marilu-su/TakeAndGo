import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../../src/app';
import type { Actor } from '../../../../src/shared/auth/actor';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { Category } from '../../../../src/modules/catalog/domain/category';
import type { CategoryUseCases } from '../../../../src/modules/catalog/infrastructure/catalogModule';

const BASE_URL = '/api/v1/stores/store-a/categories';

const storeAdmin: Actor = { userId: 'admin-a', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' };

const category: Category = { id: 'category-1', storeId: 'store-a', name: 'Bebidas', isActive: true };

function fakeUseCases(overrides: Partial<CategoryUseCases> = {}): CategoryUseCases {
    return {
        createCategory: async (_actor, command) => ({ ...category, storeId: command.storeId, name: command.name }),
        listCategories: async () => [category],
        updateCategory: async (_actor, command) => ({ ...category, name: command.name }),
        deactivateCategory: async () => ({ ...category, isActive: false }),
        ...overrides,
    };
}

function appWith(actor: Actor | null, useCases: CategoryUseCases = fakeUseCases()) {
    return createApp({
        checkDatabase: async () => true,
        resolveActor: async () => actor,
        categoryUseCases: useCases,
    });
}

test('sin usuario autenticado las rutas de categorías responden 401', async () => {
    const response = await request(appWith(null)).get(BASE_URL);

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
});

test('crea una categoría con el buffet de la URL y responde 201', async () => {
    let receivedStoreId: string | undefined;

    const app = appWith(
        storeAdmin,
        fakeUseCases({
        createCategory: async (_actor, command) => {
            receivedStoreId = command.storeId;
            return { ...category, name: command.name };
        },
        }),
    );

    const response = await request(app).post(BASE_URL).send({ name: 'Bebidas' });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, 'Bebidas');
    assert.equal(receivedStoreId, 'store-a');
});

test('responde 400 si falta el nombre', async () => {
    const response = await request(appWith(storeAdmin)).post(BASE_URL).send({});

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_REQUEST');
});

test('lista las categorías del buffet', async () => {
    const response = await request(appWith(storeAdmin)).get(BASE_URL);

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].name, 'Bebidas');
});

test('renombra una categoría', async () => {
    let receivedCategoryId: string | undefined;

    const app = appWith(
        storeAdmin,
        fakeUseCases({
        updateCategory: async (_actor, command) => {
            receivedCategoryId = command.categoryId;
            return { ...category, name: command.name };
        },
        }),
    );

    const response = await request(app).patch(`${BASE_URL}/category-1`).send({ name: 'Bebidas frías' });

    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Bebidas frías');
    assert.equal(receivedCategoryId, 'category-1');
    });

    test('desactiva una categoría', async () => {
    const response = await request(appWith(storeAdmin)).post(`${BASE_URL}/category-1/deactivate`);

    assert.equal(response.status, 200);
    assert.equal(response.body.isActive, false);
});

test('traduce los errores de categorías a códigos HTTP', async () => {
    const cases: Array<[string, number]> = [
        ['FORBIDDEN', 403],
        ['STORE_NOT_FOUND', 404],
        ['CATEGORY_NOT_FOUND', 404],
        ['INVALID_CATEGORY_NAME', 422],
    ];

    for (const [code, status] of cases) {
        const app = appWith(
        storeAdmin,
        fakeUseCases({
            updateCategory: async () => {
            throw new DomainError(code, 'Error de prueba');
            },
        }),
        );

        const response = await request(app).patch(`${BASE_URL}/category-1`).send({ name: 'Bebidas' });

        assert.equal(response.status, status, `${code} debería responder ${status}`);
        assert.equal(response.body.code, code);
    }
});