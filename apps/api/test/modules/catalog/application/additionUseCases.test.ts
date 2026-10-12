import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';
import { makeCreateAddition } from '../../../../src/modules/catalog/application/createAddition';
import { makeListAdditions } from '../../../../src/modules/catalog/application/listAdditions';
import { makeUpdateAddition } from '../../../../src/modules/catalog/application/updateAddition';
import { makeDeactivateAddition } from '../../../../src/modules/catalog/application/deactivateAddition';
import { makeConfigureProductAdditions } from '../../../../src/modules/catalog/application/configureProductAdditions';
import { makeListProductAdditions } from '../../../../src/modules/catalog/application/listProductAdditions';
import {
    FakeStoreScope,
    InMemoryAdditions,
    InMemoryProductAdditions,
    InMemoryProducts,
} from '../../../support/catalogFakes';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const adminA: Actor = { userId: 'admin-a', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_A };
const adminB: Actor = { userId: 'admin-b', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_B };
const orgAdmin: Actor = { userId: 'org-admin', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' };

function setup() {
    const products = new InMemoryProducts();
    const additions = new InMemoryAdditions();
    const productAdditions = new InMemoryProductAdditions();
    const stores = new FakeStoreScope([STORE_A, STORE_B]);

    products.items.set('coffee-a', {
        id: 'coffee-a',
        storeId: STORE_A,
        categoryId: 'cat-a',
        name: 'Café con leche',
        description: null,
        priceCents: 150000,
        basePreparationSeconds: 120,
        isActive: true,
    });

    additions.items.set('almond-a', { id: 'almond-a', storeId: STORE_A, name: 'Leche de almendras', priceCents: 50000, isActive: true });
    additions.items.set('croissant-a', { id: 'croissant-a', storeId: STORE_A, name: 'Medialuna extra', priceCents: 80000, isActive: true });
    additions.items.set('cheese-b', { id: 'cheese-b', storeId: STORE_B, name: 'Queso', priceCents: 30000, isActive: true });

    const dependencies = { products, additions, productAdditions };

    return {
        additions,
        productAdditions,
        createAddition: makeCreateAddition({ additions, stores }),
        listAdditions: makeListAdditions({ additions, stores }),
        updateAddition: makeUpdateAddition({ additions }),
        deactivateAddition: makeDeactivateAddition({ additions }),
        configureProductAdditions: makeConfigureProductAdditions(dependencies),
        listProductAdditions: makeListProductAdditions(dependencies),
    };
}

// Adicionales

test('el STORE_ADMIN crea un adicional en su buffet', async () => {
    const { createAddition } = setup();

    const addition = await createAddition(adminA, { storeId: STORE_A, name: 'Queso', priceCents: 30000 });

    assert.equal(addition.storeId, STORE_A);
    assert.equal(addition.isActive, true);
});

test('el ORGANIZATION_ADMIN no puede crear adicionales', async () => {
    const { createAddition } = setup();

    await assert.rejects(createAddition(orgAdmin, { storeId: STORE_A, name: 'Queso', priceCents: 30000 }), {
        code: 'FORBIDDEN',
    });
});

test('el listado incluye solo los adicionales del buffet', async () => {
    const { listAdditions } = setup();

    const result = await listAdditions(adminA, STORE_A);

    assert.equal(result.length, 2);
    assert.ok(result.every((addition) => addition.storeId === STORE_A));
});

test('el STORE_ADMIN cambia el precio de un adicional', async () => {
    const { updateAddition } = setup();

    const updated = await updateAddition(adminA, { storeId: STORE_A, additionId: 'almond-a', changes: { priceCents: 60000 } });

    assert.equal(updated.priceCents, 60000);
});

test('no se puede modificar un adicional de otro buffet', async () => {
    const { updateAddition, additions } = setup();

    await assert.rejects(
        updateAddition(adminA, { storeId: STORE_A, additionId: 'cheese-b', changes: { priceCents: 1 } }),
        { code: 'ADDITION_NOT_FOUND' },
    );
    assert.equal(additions.items.get('cheese-b')?.priceCents, 30000);
});

test('el STORE_ADMIN desactiva un adicional sin borrarlo', async () => {
    const { deactivateAddition, additions } = setup();

    const result = await deactivateAddition(adminA, { storeId: STORE_A, additionId: 'almond-a' });

    assert.equal(result.isActive, false);
    assert.ok(additions.items.has('almond-a'));
});

// Configuración de adicionales por producto

test('configura los adicionales de un producto', async () => {
    const { configureProductAdditions, listProductAdditions } = setup();

    await configureProductAdditions(adminA, {
        storeId: STORE_A,
        productId: 'coffee-a',
        additionIds: ['almond-a', 'croissant-a'],
    });

    const result = await listProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a' });

    assert.deepEqual(result.map((addition) => addition.id).sort(), ['almond-a', 'croissant-a']);
});

test('la nueva configuración reemplaza a la anterior y acepta una lista vacía', async () => {
    const { configureProductAdditions, productAdditions } = setup();

    await configureProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a', additionIds: ['almond-a', 'croissant-a'] });
    await configureProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a', additionIds: ['croissant-a'] });

    assert.deepEqual(await productAdditions.listAdditionIds('coffee-a'), ['croissant-a']);

    await configureProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a', additionIds: [] });

    assert.deepEqual(await productAdditions.listAdditionIds('coffee-a'), []);
});

test('los adicionales repetidos se guardan una sola vez', async () => {
    const { configureProductAdditions, productAdditions } = setup();

    await configureProductAdditions(adminA, {
        storeId: STORE_A,
        productId: 'coffee-a',
        additionIds: ['almond-a', 'almond-a'],
    });

    assert.deepEqual(await productAdditions.listAdditionIds('coffee-a'), ['almond-a']);
});

test('si un adicional es de otro buffet, no se guarda ninguno', async () => {
    const { configureProductAdditions, productAdditions } = setup();

    await configureProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a', additionIds: ['almond-a'] });

    await assert.rejects(
        configureProductAdditions(adminA, {
        storeId: STORE_A,
        productId: 'coffee-a',
        additionIds: ['croissant-a', 'cheese-b'],
        }),
        { code: 'INVALID_ADDITION_SCOPE' },
    );

    assert.deepEqual(await productAdditions.listAdditionIds('coffee-a'), ['almond-a']);
});

test('un adicional inexistente se rechaza igual que uno de otro buffet', async () => {
    const { configureProductAdditions } = setup();

    await assert.rejects(
        configureProductAdditions(adminA, { storeId: STORE_A, productId: 'coffee-a', additionIds: ['adicional-fantasma'] }),
        { code: 'INVALID_ADDITION_SCOPE' },
    );
});

test('no se pueden configurar los adicionales de un producto de otro buffet', async () => {
    const { configureProductAdditions } = setup();

    await assert.rejects(
        configureProductAdditions(adminB, { storeId: STORE_B, productId: 'coffee-a', additionIds: ['cheese-b'] }),
        { code: 'PRODUCT_NOT_FOUND' },
    );
});