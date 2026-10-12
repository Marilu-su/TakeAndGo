import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';
import {
    createNewCategory,
    deactivateCategory,
    renameCategory,
    type Category,
} from '../../../../src/modules/catalog/domain/category';
import { assertCanManageStoreCatalog } from '../../../../src/modules/catalog/domain/catalogAuthorization';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const activeCategory: Category = {
    id: 'category-1',
    storeId: STORE_A,
    name: 'Bebidas',
    isActive: true,
};

// Categoría: cada una pertenece a un buffet y nace activa

test('una categoría nueva queda activa y asociada a su buffet', () => {
    const category = createNewCategory({ storeId: STORE_A, name: '  Bebidas  ' });

    assert.equal(category.storeId, STORE_A);
    assert.equal(category.name, 'Bebidas');
    assert.equal(category.isActive, true);
});

test('rechaza una categoría sin nombre', () => {
    assert.throws(
        () => createNewCategory({ storeId: STORE_A, name: '   ' }),
        { code: 'INVALID_CATEGORY_NAME' },
    );
});

test('renombrar una categoría valida el nuevo nombre', () => {
    assert.equal(renameCategory(activeCategory, 'Bebidas frías').name, 'Bebidas frías');
    assert.throws(() => renameCategory(activeCategory, ''), { code: 'INVALID_CATEGORY_NAME' });
});

// Desactivación: no borra la categoría

test('desactivar una categoría la deja inactiva sin perder sus datos', () => {
    const deactivated = deactivateCategory(activeCategory);

    assert.equal(deactivated.isActive, false);
    assert.equal(deactivated.id, activeCategory.id);
    assert.equal(deactivated.name, activeCategory.name);
});

test('desactivar una categoría ya inactiva no cambia nada', () => {
    const inactive: Category = { ...activeCategory, isActive: false };

    assert.deepEqual(deactivateCategory(inactive), inactive);
});

// Autorización: solo el STORE_ADMIN del buffet administra su catálogo

test('el STORE_ADMIN del buffet puede administrar su catálogo', () => {
    const actor: Actor = { userId: 'u1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_A };

    assert.doesNotThrow(() => assertCanManageStoreCatalog(actor, STORE_A));
});

test('el STORE_ADMIN de otro buffet no puede administrar el catálogo', () => {
    const actor: Actor = { userId: 'u1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_B };

    assert.throws(() => assertCanManageStoreCatalog(actor, STORE_A), { code: 'FORBIDDEN' });
});

test('los demás roles no pueden administrar el catálogo', () => {
    const actors: Actor[] = [
        { userId: 'u2', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' },
        { userId: 'u3', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: STORE_A },
        { userId: 'u4', role: 'CUSTOMER' },
    ];

    for (const actor of actors) {
        assert.throws(() => assertCanManageStoreCatalog(actor, STORE_A), { code: 'FORBIDDEN' });
    }
});