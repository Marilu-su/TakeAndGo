import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Addition } from '../../../../src/modules/catalog/domain/addition';
import type { Category } from '../../../../src/modules/catalog/domain/category';
import type { Product } from '../../../../src/modules/catalog/domain/product';
import {
    buildStoreCatalog,
    type ProductAdditionLink,
} from '../../../../src/modules/catalog/domain/storeCatalog';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

function category(id: string, overrides: Partial<Category> = {}): Category {
    return { id, storeId: STORE_A, name: `Categoría ${id}`, isActive: true, ...overrides };
}

function product(id: string, categoryId: string, overrides: Partial<Product> = {}): Product {
    return {
        id,
        storeId: STORE_A,
        categoryId,
        name: `Producto ${id}`,
        description: null,
        priceCents: 100000,
        basePreparationSeconds: 60,
        isActive: true,
        ...overrides,
    };
}

function addition(id: string, overrides: Partial<Addition> = {}): Addition {
    return { id, storeId: STORE_A, name: `Adicional ${id}`, priceCents: 20000, isActive: true, ...overrides };
}

function build(data: {
    categories: Category[];
    products?: Product[];
    additions?: Addition[];
    links?: ProductAdditionLink[];
    unavailableProductIds?: string[];
    unavailableAdditionIds?: string[];
    }) {
    const products = data.products ?? [];
    const additions = data.additions ?? [];
    const unavailableProducts = new Set(data.unavailableProductIds ?? []);
    const unavailableAdditions = new Set(data.unavailableAdditionIds ?? []);

    return buildStoreCatalog({
        storeId: STORE_A,
        categories: data.categories,
        products,
        additions,
        links: data.links ?? [],
        availableProductIds: new Set(products.map((p) => p.id).filter((id) => !unavailableProducts.has(id))),
        availableAdditionIds: new Set(additions.map((a) => a.id).filter((id) => !unavailableAdditions.has(id))),
    });
}

// Agrupación por categorías

test('agrupa los productos por categoría con sus adicionales y precios', () => {
    const catalog = build({
        categories: [category('bebidas'), category('panaderia')],
        products: [product('cafe', 'bebidas', { priceCents: 150000 }), product('medialuna', 'panaderia')],
        additions: [addition('almendras', { priceCents: 50000 })],
        links: [{ productId: 'cafe', additionId: 'almendras' }],
    });

    assert.equal(catalog.categories.length, 2);

    const coffee = catalog.categories[0].products[0];
    assert.equal(coffee.id, 'cafe');
    assert.equal(coffee.priceCents, 150000);
    assert.deepEqual(coffee.additions, [{ id: 'almendras', name: 'Adicional almendras', priceCents: 50000 }]);
});

test('un producto sin adicionales aparece con la lista vacía', () => {
    const catalog = build({
        categories: [category('panaderia')],
        products: [product('medialuna', 'panaderia')],
    });

    assert.deepEqual(catalog.categories[0].products[0].additions, []);
});

// Solo lo activo

test('una categoría desactivada no aparece aunque tenga productos activos', () => {
    const catalog = build({
        categories: [category('bebidas', { isActive: false }), category('panaderia')],
        products: [product('cafe', 'bebidas'), product('medialuna', 'panaderia')],
    });

    assert.deepEqual(catalog.categories.map((c) => c.id), ['panaderia']);
});

test('un producto desactivado no aparece', () => {
    const catalog = build({
        categories: [category('bebidas')],
        products: [product('cafe', 'bebidas'), product('te', 'bebidas', { isActive: false })],
    });

    assert.deepEqual(catalog.categories[0].products.map((p) => p.id), ['cafe']);
});

test('un adicional desactivado no aparece entre los adicionales del producto', () => {
    const catalog = build({
        categories: [category('bebidas')],
        products: [product('cafe', 'bebidas')],
        additions: [addition('almendras'), addition('medialuna-extra', { isActive: false })],
        links: [
        { productId: 'cafe', additionId: 'almendras' },
        { productId: 'cafe', additionId: 'medialuna-extra' },
        ],
    });

    assert.deepEqual(catalog.categories[0].products[0].additions.map((a) => a.id), ['almendras']);
});

test('una categoría sin productos para mostrar no aparece', () => {
    const catalog = build({
        categories: [category('bebidas'), category('vacia')],
        products: [product('cafe', 'bebidas')],
    });

    assert.deepEqual(catalog.categories.map((c) => c.id), ['bebidas']);
});

// Disponibilidad

test('los productos y adicionales sin disponibilidad no aparecen', () => {
    const catalog = build({
        categories: [category('bebidas')],
        products: [product('cafe', 'bebidas'), product('te', 'bebidas')],
        additions: [addition('almendras'), addition('miel')],
        links: [
        { productId: 'cafe', additionId: 'almendras' },
        { productId: 'cafe', additionId: 'miel' },
        ],
        unavailableProductIds: ['te'],
        unavailableAdditionIds: ['miel'],
    });

    const products = catalog.categories[0].products;
    assert.deepEqual(products.map((p) => p.id), ['cafe']);
    assert.deepEqual(products[0].additions.map((a) => a.id), ['almendras']);
});

// Aislamiento entre buffets

test('el catálogo no incluye datos de otros buffets', () => {
    const catalog = build({
        categories: [category('bebidas'), category('ajena', { storeId: STORE_B })],
        products: [
        product('cafe', 'bebidas'),
        product('producto-ajeno', 'bebidas', { storeId: STORE_B }),
        ],
        additions: [addition('adicional-ajeno', { storeId: STORE_B })],
        links: [{ productId: 'cafe', additionId: 'adicional-ajeno' }],
    });

    assert.deepEqual(catalog.categories.map((c) => c.id), ['bebidas']);
    assert.deepEqual(catalog.categories[0].products.map((p) => p.id), ['cafe']);
    assert.deepEqual(catalog.categories[0].products[0].additions, []);
});