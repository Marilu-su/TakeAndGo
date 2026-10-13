import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeGetStoreCatalog } from '../../../../src/modules/catalog/application/getStoreCatalog';
import {
    FakeAvailability,
    FakeStoreScope,
    InMemoryAdditions,
    InMemoryCategories,
    InMemoryProductAdditions,
    InMemoryProducts,
} from '../../../support/catalogFakes';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

function setup(unavailableIds: string[] = []) {
    const categories = new InMemoryCategories();
    const products = new InMemoryProducts();
    const additions = new InMemoryAdditions();
    const productAdditions = new InMemoryProductAdditions();

    categories.items.set('bebidas', { id: 'bebidas', storeId: STORE_A, name: 'Bebidas', isActive: true });
    categories.items.set('bebidas-b', { id: 'bebidas-b', storeId: STORE_B, name: 'Bebidas', isActive: true });

    products.items.set('cafe', {
        id: 'cafe',
        storeId: STORE_A,
        categoryId: 'bebidas',
        name: 'Café con leche',
        description: null,
        priceCents: 150000,
        basePreparationSeconds: 120,
        isActive: true,
    });
    products.items.set('te', {
        id: 'te',
        storeId: STORE_A,
        categoryId: 'bebidas',
        name: 'Té',
        description: null,
        priceCents: 100000,
        basePreparationSeconds: 60,
        isActive: true,
    });
    products.items.set('cafe-b', {
        id: 'cafe-b',
        storeId: STORE_B,
        categoryId: 'bebidas-b',
        name: 'Café del otro buffet',
        description: null,
        priceCents: 1,
        basePreparationSeconds: 1,
        isActive: true,
    });

    additions.items.set('almendras', { id: 'almendras', storeId: STORE_A, name: 'Leche de almendras', priceCents: 50000, isActive: true });
    additions.items.set('queso-b', { id: 'queso-b', storeId: STORE_B, name: 'Queso', priceCents: 30000, isActive: true });

    productAdditions.links.set('cafe', { storeId: STORE_A, additionIds: ['almendras'] });
    productAdditions.links.set('cafe-b', { storeId: STORE_B, additionIds: ['queso-b'] });

    return makeGetStoreCatalog({
        stores: new FakeStoreScope([STORE_A, STORE_B]),
        categories,
        products,
        additions,
        productAdditions,
        availability: new FakeAvailability(unavailableIds),
    });
}

test('arma el catálogo del buffet con sus productos y adicionales', async () => {
    const getStoreCatalog = setup();

    const catalog = await getStoreCatalog(STORE_A);

    assert.equal(catalog.storeId, STORE_A);
    assert.equal(catalog.categories.length, 1);

    const [coffee, tea] = catalog.categories[0].products;
    assert.equal(coffee.name, 'Café con leche');
    assert.deepEqual(coffee.additions.map((a) => a.id), ['almendras']);
    assert.equal(tea.name, 'Té');
    assert.deepEqual(tea.additions, []);
});

test('el catálogo no incluye datos de otros buffets', async () => {
    const getStoreCatalog = setup();

    const catalog = await getStoreCatalog(STORE_A);

    const productIds = catalog.categories.flatMap((category) => category.products.map((product) => product.id));
    assert.ok(!productIds.includes('cafe-b'));
});

test('respeta la disponibilidad informada por el contrato de disponibilidad', async () => {
    const getStoreCatalog = setup(['te', 'almendras']);

    const catalog = await getStoreCatalog(STORE_A);

    const products = catalog.categories[0].products;
    assert.deepEqual(products.map((p) => p.id), ['cafe']);
    assert.deepEqual(products[0].additions, []);
});

test('el catálogo de un buffet inexistente informa que no existe', async () => {
    const getStoreCatalog = setup();

    await assert.rejects(getStoreCatalog('store-fantasma'), { code: 'STORE_NOT_FOUND' });
});