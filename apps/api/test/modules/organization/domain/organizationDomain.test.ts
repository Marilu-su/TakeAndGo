import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';
import { createStoreCode } from '../../../../src/modules/organization/domain/storeCode';
import {
    DEFAULT_MAX_ADVANCE_DAYS,
    validateMaxAdvanceDays,
} from '../../../../src/modules/organization/domain/maxAdvanceDays';
import {
    createNewStore,
    deactivateStore,
    type Store,
} from '../../../../src/modules/organization/domain/store';
import { assertCanManageOrganization } from '../../../../src/modules/organization/domain/organizationAuthorization';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

// Código del buffet (RN-005)

test('acepta un código con 3 letras y 3 números', () => {
    assert.equal(createStoreCode('ABC123'), 'ABC123');
});

test('normaliza el código a mayúsculas y quita espacios', () => {
    assert.equal(createStoreCode('  abc123 '), 'ABC123');
});

test('rechaza códigos con formato inválido', () => {
    for (const invalid of ['AB123', 'ABCD12', 'ABC12', '123ABC', 'ABC1234', '']) {
        assert.throws(() => createStoreCode(invalid), { code: 'INVALID_STORE_CODE' });
    }
});

// Anticipación máxima (RN-054)

test('la anticipación máxima por defecto es 7 días', () => {
    assert.equal(DEFAULT_MAX_ADVANCE_DAYS, 7);
});

test('acepta una anticipación máxima entera y positiva', () => {
    assert.equal(validateMaxAdvanceDays(14), 14);
});

test('rechaza una anticipación máxima inválida', () => {
    for (const invalid of [0, -1, 2.5]) {
        assert.throws(() => validateMaxAdvanceDays(invalid), { code: 'INVALID_MAX_ADVANCE_DAYS' });
    }
});

// Buffet (RN-027, CA-01)

test('un buffet nuevo queda pendiente de configuración', () => {
    const store = createNewStore({ organizationId: ORG_A, name: 'Buffet Sistemas', code: 'sis001' });

    assert.equal(store.status, 'PENDING_SETUP');
    assert.equal(store.code, 'SIS001');
    assert.equal(store.organizationId, ORG_A);
});

test('rechaza un buffet sin nombre', () => {
    assert.throws(
        () => createNewStore({ organizationId: ORG_A, name: '   ', code: 'SIS001' }),
        { code: 'INVALID_STORE_NAME' },
    );
});

test('dar de baja un buffet lo deja inactivo sin perder sus datos', () => {
    const store: Store = {
        id: 'store-1',
        organizationId: ORG_A,
        name: 'Buffet Sistemas',
        code: createStoreCode('SIS001'),
        status: 'ACTIVE',
    };

    const deactivated = deactivateStore(store);

    assert.equal(deactivated.status, 'INACTIVE');
    assert.equal(deactivated.id, store.id);
    assert.equal(deactivated.code, store.code);
});

test('dar de baja un buffet ya inactivo no cambia nada', () => {
    const store: Store = {
        id: 'store-1',
        organizationId: ORG_A,
        name: 'Buffet Sistemas',
        code: createStoreCode('SIS001'),
        status: 'INACTIVE',
    };

    assert.deepEqual(deactivateStore(store), store);
});

// Autorización (TDD-0003, sección 4)

test('un ORGANIZATION_ADMIN puede administrar su organización', () => {
    const actor: Actor = { userId: 'u1', role: 'ORGANIZATION_ADMIN', organizationId: ORG_A };

    assert.doesNotThrow(() => assertCanManageOrganization(actor, ORG_A));
});

test('un ORGANIZATION_ADMIN no puede administrar otra organización', () => {
    const actor: Actor = { userId: 'u1', role: 'ORGANIZATION_ADMIN', organizationId: ORG_A };

    assert.throws(() => assertCanManageOrganization(actor, ORG_B), { code: 'FORBIDDEN' });
});

test('los demás roles no pueden administrar la organización', () => {
    const actors: Actor[] = [
        { userId: 'u2', role: 'STORE_ADMIN', organizationId: ORG_A, storeId: 'store-1' },
        { userId: 'u3', role: 'STORE_EMPLOYEE', organizationId: ORG_A, storeId: 'store-1' },
        { userId: 'u4', role: 'CUSTOMER' },
    ];

    for (const actor of actors) {
        assert.throws(() => assertCanManageOrganization(actor, ORG_A), { code: 'FORBIDDEN' });
    }
});