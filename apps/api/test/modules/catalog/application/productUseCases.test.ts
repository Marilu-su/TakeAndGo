import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';
import { makeCreateProduct } from '../../../../src/modules/catalog/application/createProduct';
import { makeListProducts } from '../../../../src/modules/catalog/application/listProducts';
import { makeUpdateProduct } from '../../../../src/modules/catalog/application/updateProduct';
import { makeDeactivateProduct } from '../../../../src/modules/catalog/application/deactivateProduct';
import { FakeStoreScope, InMemoryCategories, InMemoryProducts } from '../../../support/catalogFakes';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const adminA: Actor = { userId: 'admin-a', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_A };
const adminB: Actor = { userId: 'admin-b', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_B };
const employeeA: Actor = { userId: 'emp-a', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: STORE_A };

function setup() {
    const categories = new InMemoryCategories();
    const products = new InMemoryProducts();
    const stores = new FakeStoreScope([STORE_A, STORE_B]);

    categories.items.set('cat-a', { id: 'cat-a', storeId: STORE_A, name: 'Bebidas', isActive: true });
    categories.items.set('cat-a2', { id: 'cat-a2', storeId: STORE_A, name: 'Panadería', isActive: true });
    categories.items.set('cat-b', { id: 'cat-b', storeId: STORE_B, name: 'Bebidas', isActive: true });

    return {
        products,
        createProduct: makeCreateProduct({ products, categories }),
        listProducts: makeListProducts({ products, stores }),
        updateProduct: makeUpdateProduct({ products, categories }),
        deactivateProduct: makeDeactivateProduct({ products }),
    };
}

const coffee = {
    storeId: STORE_A,
    categoryId: 'cat-a',
    name: 'Café con leche',
    priceCents: 150000,
    basePreparationSeconds: 120,
};

// Crear

test('el STORE_ADMIN crea un producto en una categoría de su buffet', async () => {
    const { createProduct, products } = setup();

    const product = await createProduct(adminA, coffee);

    assert.equal(product.categoryId, 'cat-a');
    assert.equal(product.priceCents, 150000);
    assert.equal(product.isActive, true);
    assert.equal(products.items.size, 1);
});

test('no se puede crear un producto con una categoría de otro buffet', async () => {
    const { createProduct, products } = setup();

    await assert.rejects(createProduct(adminA, { ...coffee, categoryId: 'cat-b' }), {
        code: 'INVALID_CATEGORY_SCOPE',
    });
    assert.equal(products.items.size, 0);
});

test('no se puede crear un producto con una categoría inexistente', async () => {
    const { createProduct } = setup();

    await assert.rejects(createProduct(adminA, { ...coffee, categoryId: 'cat-fantasma' }), {
        code: 'INVALID_CATEGORY_SCOPE',
    });
});

test('un STORE_EMPLOYEE no puede crear productos', async () => {
    const { createProduct } = setup();

    await assert.rejects(createProduct(employeeA, coffee), { code: 'FORBIDDEN' });
});

test('un precio inválido no crea el producto', async () => {
    const { createProduct, products } = setup();

    await assert.rejects(createProduct(adminA, { ...coffee, priceCents: 1500.5 }), { code: 'INVALID_PRICE' });
    assert.equal(products.items.size, 0);
});

// Listar

test('el listado incluye solo los productos del buffet', async () => {
    const { createProduct, listProducts } = setup();

    await createProduct(adminA, coffee);
    await createProduct(adminB, { ...coffee, storeId: STORE_B, categoryId: 'cat-b' });

    const result = await listProducts(adminA, STORE_A);

    assert.equal(result.length, 1);
    assert.equal(result[0].storeId, STORE_A);
});

// Modificar

test('el STORE_ADMIN cambia el precio y la categoría de un producto', async () => {
    const { createProduct, updateProduct } = setup();
    const product = await createProduct(adminA, coffee);

    const updated = await updateProduct(adminA, {
        storeId: STORE_A,
        productId: product.id,
        changes: { priceCents: 180000, categoryId: 'cat-a2' },
    });

    assert.equal(updated.priceCents, 180000);
    assert.equal(updated.categoryId, 'cat-a2');
    assert.equal(updated.name, 'Café con leche');
});

test('no se puede mover un producto a una categoría de otro buffet', async () => {
    const { createProduct, updateProduct, products } = setup();
    const product = await createProduct(adminA, coffee);

    await assert.rejects(
        updateProduct(adminA, { storeId: STORE_A, productId: product.id, changes: { categoryId: 'cat-b' } }),
        { code: 'INVALID_CATEGORY_SCOPE' },
    );
    assert.equal(products.items.get(product.id)?.categoryId, 'cat-a');
});

test('no se puede modificar un producto de otro buffet usando el propio buffet en la URL', async () => {
    const { createProduct, updateProduct, products } = setup();
    const productOfB = await createProduct(adminB, { ...coffee, storeId: STORE_B, categoryId: 'cat-b' });

    await assert.rejects(
        updateProduct(adminA, { storeId: STORE_A, productId: productOfB.id, changes: { priceCents: 1 } }),
        { code: 'PRODUCT_NOT_FOUND' },
    );
    assert.equal(products.items.get(productOfB.id)?.priceCents, 150000);
});

// Desactivar

test('el STORE_ADMIN desactiva un producto sin borrarlo', async () => {
    const { createProduct, deactivateProduct, products } = setup();
    const product = await createProduct(adminA, coffee);

    const result = await deactivateProduct(adminA, { storeId: STORE_A, productId: product.id });

    assert.equal(result.isActive, false);
    assert.equal(products.items.size, 1);
});

test('desactivar un producto inexistente informa que no existe', async () => {
    const { deactivateProduct } = setup();

    await assert.rejects(deactivateProduct(adminA, { storeId: STORE_A, productId: 'producto-fantasma' }), {
        code: 'PRODUCT_NOT_FOUND',
    });
});