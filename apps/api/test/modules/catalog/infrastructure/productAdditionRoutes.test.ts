import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../../src/app';
import type { Actor } from '../../../../src/shared/auth/actor';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { Addition } from '../../../../src/modules/catalog/domain/addition';
import type { Product } from '../../../../src/modules/catalog/domain/product';
import type {
    AdditionUseCases,
    ProductUseCases,
} from '../../../../src/modules/catalog/infrastructure/catalogModule';

const PRODUCTS_URL = '/api/v1/stores/store-a/products';
const ADDITIONS_URL = '/api/v1/stores/store-a/additions';

const storeAdmin: Actor = { userId: 'admin-a', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' };

const product: Product = {
    id: 'product-1',
    storeId: 'store-a',
    categoryId: 'category-1',
    name: 'Café con leche',
    description: null,
    priceCents: 150000,
    basePreparationSeconds: 120,
    isActive: true,
};

const addition: Addition = {
    id: 'addition-1',
    storeId: 'store-a',
    name: 'Leche de almendras',
    priceCents: 50000,
    isActive: true,
};

function fakeProductUseCases(overrides: Partial<ProductUseCases> = {}): ProductUseCases {
    return {
        createProduct: async () => product,
        listProducts: async () => [product],
        updateProduct: async () => product,
        deactivateProduct: async () => ({ ...product, isActive: false }),
        configureProductAdditions: async () => [addition],
        listProductAdditions: async () => [addition],
        ...overrides,
    };
}

function fakeAdditionUseCases(overrides: Partial<AdditionUseCases> = {}): AdditionUseCases {
    return {
        createAddition: async () => addition,
        listAdditions: async () => [addition],
        updateAddition: async () => addition,
        deactivateAddition: async () => ({ ...addition, isActive: false }),
        ...overrides,
    };
}

function appWith(
    actor: Actor | null,
    productUseCases: ProductUseCases = fakeProductUseCases(),
    additionUseCases: AdditionUseCases = fakeAdditionUseCases(),
    ) {
    return createApp({
        checkDatabase: async () => true,
        resolveActor: async () => actor,
        productUseCases,
        additionUseCases,
    });
}

// Productos

test('sin usuario autenticado las rutas de productos responden 401', async () => {
    const response = await request(appWith(null)).get(PRODUCTS_URL);

    assert.equal(response.status, 401);
});

test('crea un producto con los datos del cuerpo y el buffet de la URL', async () => {
    let received: unknown;
    const app = appWith(
        storeAdmin,
        fakeProductUseCases({
        createProduct: async (_actor, command) => {
            received = command;
            return product;
        },
        }),
    );

    const response = await request(app).post(PRODUCTS_URL).send({
        categoryId: 'category-1',
        name: 'Café con leche',
        priceCents: 150000,
        basePreparationSeconds: 120,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(received, {
        storeId: 'store-a',
        categoryId: 'category-1',
        name: 'Café con leche',
        description: undefined,
        priceCents: 150000,
        basePreparationSeconds: 120,
    });
});

test('rechaza un precio que no es numérico', async () => {
    const response = await request(appWith(storeAdmin)).post(PRODUCTS_URL).send({
        categoryId: 'category-1',
        name: 'Café con leche',
        priceCents: 'mil quinientos',
        basePreparationSeconds: 120,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_REQUEST');
});

test('modificar un producto envía solo los campos indicados', async () => {
    let receivedChanges: unknown;
    const app = appWith(
        storeAdmin,
        fakeProductUseCases({
        updateProduct: async (_actor, command) => {
            receivedChanges = command.changes;
            return product;
        },
        }),
    );

    const response = await request(app).patch(`${PRODUCTS_URL}/product-1`).send({ priceCents: 180000 });

    assert.equal(response.status, 200);
    assert.equal((receivedChanges as { priceCents?: number }).priceCents, 180000);
    assert.equal((receivedChanges as { name?: string }).name, undefined);
});

test('una modificación sin campos responde 400', async () => {
    const response = await request(appWith(storeAdmin)).patch(`${PRODUCTS_URL}/product-1`).send({});

    assert.equal(response.status, 400);
    });

    test('desactiva un producto', async () => {
    const response = await request(appWith(storeAdmin)).post(`${PRODUCTS_URL}/product-1/deactivate`);

    assert.equal(response.status, 200);
    assert.equal(response.body.isActive, false);
});

test('configura los adicionales de un producto', async () => {
    let receivedIds: string[] | undefined;
    const app = appWith(
        storeAdmin,
        fakeProductUseCases({
        configureProductAdditions: async (_actor, command) => {
            receivedIds = command.additionIds;
            return [addition];
        },
        }),
    );

    const response = await request(app)
        .put(`${PRODUCTS_URL}/product-1/additions`)
        .send({ additionIds: ['addition-1'] });

    assert.equal(response.status, 200);
    assert.deepEqual(receivedIds, ['addition-1']);
});

test('configurar adicionales sin una lista válida responde 400', async () => {
    const response = await request(appWith(storeAdmin))
        .put(`${PRODUCTS_URL}/product-1/additions`)
        .send({ additionIds: 'addition-1' });

    assert.equal(response.status, 400);
});

test('lista los adicionales de un producto', async () => {
    const response = await request(appWith(storeAdmin)).get(`${PRODUCTS_URL}/product-1/additions`);

    assert.equal(response.status, 200);
    assert.equal(response.body[0].id, 'addition-1');
});

// Adicionales

test('crea, modifica y desactiva adicionales', async () => {
    const app = appWith(storeAdmin);

    const created = await request(app).post(ADDITIONS_URL).send({ name: 'Queso', priceCents: 30000 });
    const updated = await request(app).patch(`${ADDITIONS_URL}/addition-1`).send({ priceCents: 60000 });
    const deactivated = await request(app).post(`${ADDITIONS_URL}/addition-1/deactivate`);

    assert.equal(created.status, 201);
    assert.equal(updated.status, 200);
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.isActive, false);
});

// Errores de negocio

test('traduce los errores de productos y adicionales a códigos HTTP', async () => {
    const cases: Array<[string, number]> = [
        ['PRODUCT_NOT_FOUND', 404],
        ['INVALID_CATEGORY_SCOPE', 422],
        ['INVALID_ADDITION_SCOPE', 422],
        ['INVALID_PRICE', 422],
        ['INVALID_PREPARATION_TIME', 422],
    ];

    for (const [code, status] of cases) {
        const app = appWith(
        storeAdmin,
        fakeProductUseCases({
            updateProduct: async () => {
            throw new DomainError(code, 'Error de prueba');
            },
        }),
        );

        const response = await request(app).patch(`${PRODUCTS_URL}/product-1`).send({ priceCents: 1 });

        assert.equal(response.status, status, `${code} debería responder ${status}`);
    }

    const additionApp = appWith(
        storeAdmin,
        fakeProductUseCases(),
        fakeAdditionUseCases({
        updateAddition: async () => {
            throw new DomainError('ADDITION_NOT_FOUND', 'Error de prueba');
        },
        }),
    );

    const response = await request(additionApp).patch(`${ADDITIONS_URL}/addition-1`).send({ priceCents: 1 });

    assert.equal(response.status, 404);
});