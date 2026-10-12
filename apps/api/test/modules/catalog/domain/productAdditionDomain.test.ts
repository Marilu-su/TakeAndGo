import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Category } from '../../../../src/modules/catalog/domain/category';
import {
    validatePreparationSeconds,
    validatePriceCents,
} from '../../../../src/modules/catalog/domain/catalogValues';
import {
    assertCategoryBelongsToStore,
    createNewProduct,
    deactivateProduct,
    updateProduct,
    type Product,
} from '../../../../src/modules/catalog/domain/product';
import {
    assertAdditionsBelongToStore,
    createNewAddition,
    deactivateAddition,
    updateAddition,
    type Addition,
} from '../../../../src/modules/catalog/domain/addition';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const product: Product = {
    id: 'product-1',
    storeId: STORE_A,
    categoryId: 'category-1',
    name: 'Café con leche',
    description: 'Taza grande',
    priceCents: 150000,
    basePreparationSeconds: 120,
    isActive: true,
};

const addition: Addition = {
    id: 'addition-1',
    storeId: STORE_A,
    name: 'Leche de almendras',
    priceCents: 50000,
    isActive: true,
};

// Precio: entero en centavos y no negativo

test('acepta precios enteros en centavos, incluido 0', () => {
    assert.equal(validatePriceCents(150000), 150000);
    assert.equal(validatePriceCents(0), 0);
});

test('rechaza precios negativos o con decimales', () => {
    for (const invalid of [-1, 1500.5, Number.NaN]) {
        assert.throws(() => validatePriceCents(invalid), { code: 'INVALID_PRICE' });
    }
});

// Tiempo de preparación: entero en segundos y no negativo

test('acepta tiempos de preparación enteros, incluido 0', () => {
    assert.equal(validatePreparationSeconds(120), 120);
    assert.equal(validatePreparationSeconds(0), 0);
});

test('rechaza tiempos de preparación negativos o con decimales', () => {
    for (const invalid of [-10, 30.5]) {
        assert.throws(() => validatePreparationSeconds(invalid), { code: 'INVALID_PREPARATION_TIME' });
    }
});

// Producto

test('un producto nuevo queda activo y normaliza sus textos', () => {
    const created = createNewProduct({
        storeId: STORE_A,
        categoryId: 'category-1',
        name: '  Café con leche  ',
        description: '   ',
        priceCents: 150000,
        basePreparationSeconds: 120,
    });

    assert.equal(created.name, 'Café con leche');
    assert.equal(created.description, null);
    assert.equal(created.isActive, true);
});

test('rechaza un producto sin nombre o con precio inválido', () => {
    const base = { storeId: STORE_A, categoryId: 'category-1', priceCents: 1000, basePreparationSeconds: 60 };

    assert.throws(() => createNewProduct({ ...base, name: '' }), { code: 'INVALID_PRODUCT_NAME' });
    assert.throws(() => createNewProduct({ ...base, name: 'Café', priceCents: -5 }), { code: 'INVALID_PRICE' });
});

test('modificar un producto cambia solo los campos indicados', () => {
    const updated = updateProduct(product, { priceCents: 180000 });

    assert.equal(updated.priceCents, 180000);
    assert.equal(updated.name, product.name);
    assert.equal(updated.basePreparationSeconds, product.basePreparationSeconds);
});

test('modificar un producto valida los nuevos valores', () => {
    assert.throws(() => updateProduct(product, { name: '  ' }), { code: 'INVALID_PRODUCT_NAME' });
    assert.throws(() => updateProduct(product, { basePreparationSeconds: -1 }), { code: 'INVALID_PREPARATION_TIME' });
});

test('desactivar un producto no pierde sus datos', () => {
    const deactivated = deactivateProduct(product);

    assert.equal(deactivated.isActive, false);
    assert.equal(deactivated.priceCents, product.priceCents);
});

test('un producto solo puede usar categorías de su buffet', () => {
    const ownCategory: Category = { id: 'category-1', storeId: STORE_A, name: 'Bebidas', isActive: true };
    const foreignCategory: Category = { id: 'category-2', storeId: STORE_B, name: 'Bebidas', isActive: true };

    assert.doesNotThrow(() => assertCategoryBelongsToStore(ownCategory, STORE_A));
    assert.throws(() => assertCategoryBelongsToStore(foreignCategory, STORE_A), { code: 'INVALID_CATEGORY_SCOPE' });
});

// Adicional

test('un adicional nuevo queda activo', () => {
    const created = createNewAddition({ storeId: STORE_A, name: ' Medialuna extra ', priceCents: 80000 });

    assert.equal(created.name, 'Medialuna extra');
    assert.equal(created.isActive, true);
});

test('rechaza un adicional sin nombre o con precio inválido', () => {
    assert.throws(() => createNewAddition({ storeId: STORE_A, name: '', priceCents: 100 }), {
        code: 'INVALID_ADDITION_NAME',
    });
    assert.throws(() => createNewAddition({ storeId: STORE_A, name: 'Queso', priceCents: 10.5 }), {
        code: 'INVALID_PRICE',
    });
});

test('modificar y desactivar un adicional', () => {
    assert.equal(updateAddition(addition, { priceCents: 60000 }).priceCents, 60000);
    assert.equal(updateAddition(addition, { priceCents: 60000 }).name, addition.name);
    assert.equal(deactivateAddition(addition).isActive, false);
});

test('un producto solo puede tener adicionales de su buffet', () => {
    const foreignAddition: Addition = { ...addition, id: 'addition-2', storeId: STORE_B };

    assert.doesNotThrow(() => assertAdditionsBelongToStore([addition], STORE_A));
    assert.throws(() => assertAdditionsBelongToStore([addition, foreignAddition], STORE_A), {
        code: 'INVALID_ADDITION_SCOPE',
    });
});