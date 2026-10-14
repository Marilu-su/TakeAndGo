import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';

import { makeCreateCategory } from '../../../../src/modules/catalog/application/createCategory';
import { makeListCategories } from '../../../../src/modules/catalog/application/listCategories';
import { makeUpdateCategory } from '../../../../src/modules/catalog/application/updateCategory';
import { makeDeactivateCategory } from '../../../../src/modules/catalog/application/deactivateCategory';
import { FakeStoreScope, InMemoryCategories } from '../../../support/catalogFakes';


// Datos de prueba

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const adminA: Actor = { userId: 'admin-a', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_A };
const adminB: Actor = { userId: 'admin-b', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_B };
const orgAdmin: Actor = { userId: 'org-admin', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' };

function setup() {
    const categories = new InMemoryCategories();
    const stores = new FakeStoreScope([STORE_A, STORE_B]);

    return {
        categories,
        createCategory: makeCreateCategory({ categories, stores }),
        listCategories: makeListCategories({ categories, stores }),
        updateCategory: makeUpdateCategory({ categories }),
        deactivateCategory: makeDeactivateCategory({ categories }),
    };
}

// Crear

test('el STORE_ADMIN crea una categoría en su buffet', async () => {
    const { createCategory, categories } = setup();

    const category = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    assert.equal(category.storeId, STORE_A);
    assert.equal(category.isActive, true);
    assert.equal(categories.items.size, 1);
});

test('no se puede crear una categoría en otro buffet', async () => {
    const { createCategory, categories } = setup();

    await assert.rejects(createCategory(adminB, { storeId: STORE_A, name: 'Bebidas' }), { code: 'FORBIDDEN' });
    assert.equal(categories.items.size, 0);
});

test('el ORGANIZATION_ADMIN no puede crear categorías', async () => {
    const { createCategory } = setup();

    await assert.rejects(createCategory(orgAdmin, { storeId: STORE_A, name: 'Bebidas' }), { code: 'FORBIDDEN' });
});

test('no se puede crear una categoría en un buffet inexistente', async () => {
    const { createCategory } = setup();
    const adminGhost: Actor = { userId: 'x', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-ghost' };

    await assert.rejects(
        createCategory(adminGhost, { storeId: 'store-ghost', name: 'Bebidas' }),
        { code: 'STORE_NOT_FOUND' },
    );
});

test('una categoría sin nombre no se guarda', async () => {
    const { createCategory, categories } = setup();

    await assert.rejects(createCategory(adminA, { storeId: STORE_A, name: '  ' }), { code: 'INVALID_CATEGORY_NAME' });
    assert.equal(categories.items.size, 0);
});

// Listar

test('el listado incluye solo las categorías del buffet, activas e inactivas', async () => {
    const { createCategory, deactivateCategory, listCategories } = setup();

    await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });
    const toDeactivate = await createCategory(adminA, { storeId: STORE_A, name: 'Postres' });
    await createCategory(adminB, { storeId: STORE_B, name: 'Otra categoría' });
    await deactivateCategory(adminA, { storeId: STORE_A, categoryId: toDeactivate.id });

    const result = await listCategories(adminA, STORE_A);

    assert.equal(result.length, 2);
    assert.ok(result.every((category) => category.storeId === STORE_A));
});

test('no se puede listar el catálogo de otro buffet', async () => {
    const { listCategories } = setup();

    await assert.rejects(listCategories(adminB, STORE_A), { code: 'FORBIDDEN' });
});

// Modificar

test('el STORE_ADMIN renombra una categoría de su buffet', async () => {
    const { createCategory, updateCategory } = setup();
    const category = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    const updated = await updateCategory(adminA, { storeId: STORE_A, categoryId: category.id, name: 'Bebidas frías' });

    assert.equal(updated.name, 'Bebidas frías');
});

test('no se puede modificar una categoría de otro buffet usando el propio buffet en la URL', async () => {
    const { createCategory, updateCategory, categories } = setup();
    const categoryOfB = await createCategory(adminB, { storeId: STORE_B, name: 'Bebidas' });

    await assert.rejects(
        updateCategory(adminA, { storeId: STORE_A, categoryId: categoryOfB.id, name: 'Hackeada' }),
        { code: 'CATEGORY_NOT_FOUND' },
    );
    assert.equal(categories.items.get(categoryOfB.id)?.name, 'Bebidas');
});

test('un nombre inválido no modifica la categoría', async () => {
    const { createCategory, updateCategory, categories } = setup();
    const category = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    await assert.rejects(
        updateCategory(adminA, { storeId: STORE_A, categoryId: category.id, name: '' }),
        { code: 'INVALID_CATEGORY_NAME' },
    );
    assert.equal(categories.items.get(category.id)?.name, 'Bebidas');
});

// Desactivar

test('el STORE_ADMIN desactiva una categoría sin borrarla', async () => {
    const { createCategory, deactivateCategory, categories } = setup();
    const category = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    const result = await deactivateCategory(adminA, { storeId: STORE_A, categoryId: category.id });

    assert.equal(result.isActive, false);
    assert.equal(categories.items.size, 1);
});

test('desactivar una categoría inexistente informa que no existe', async () => {
    const { deactivateCategory } = setup();

    await assert.rejects(
        deactivateCategory(adminA, { storeId: STORE_A, categoryId: 'categoria-inexistente' }),
        { code: 'CATEGORY_NOT_FOUND' },
    );
});

// Nombres únicos entre categorías activas del buffet

test('no se puede crear una categoría con el nombre de otra activa, sin importar mayúsculas ni espacios', async () => {
    const { createCategory } = setup();

    await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    for (const duplicate of ['Bebidas', 'bebidas', '  BEBIDAS  ']) {
        await assert.rejects(createCategory(adminA, { storeId: STORE_A, name: duplicate }), {
        code: 'CATEGORY_NAME_ALREADY_EXISTS',
        });
    }
});

test('otro buffet puede tener una categoría con el mismo nombre', async () => {
    const { createCategory } = setup();

    await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    await assert.doesNotReject(createCategory(adminB, { storeId: STORE_B, name: 'Bebidas' }));
});

test('desactivar una categoría libera su nombre para una nueva', async () => {
    const { createCategory, deactivateCategory } = setup();

    const old = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });
    await deactivateCategory(adminA, { storeId: STORE_A, categoryId: old.id });

    const renewed = await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });

    assert.equal(renewed.isActive, true);
    assert.notEqual(renewed.id, old.id);
});

test('no se puede renombrar una categoría con el nombre de otra activa', async () => {
    const { createCategory, updateCategory, categories } = setup();

    await createCategory(adminA, { storeId: STORE_A, name: 'Bebidas' });
    const snacks = await createCategory(adminA, { storeId: STORE_A, name: 'Snacks' });

    await assert.rejects(
        updateCategory(adminA, { storeId: STORE_A, categoryId: snacks.id, name: 'bebidas' }),
        { code: 'CATEGORY_NAME_ALREADY_EXISTS' },
    );
    assert.equal(categories.items.get(snacks.id)?.name, 'Snacks');
});

test('una categoría puede renombrarse cambiando solo las mayúsculas de su propio nombre', async () => {
    const { createCategory, updateCategory } = setup();

    const category = await createCategory(adminA, { storeId: STORE_A, name: 'bebidas' });

    const updated = await updateCategory(adminA, { storeId: STORE_A, categoryId: category.id, name: 'Bebidas' });

    assert.equal(updated.name, 'Bebidas');
});