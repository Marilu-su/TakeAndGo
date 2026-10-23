import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStaffScope, isStaffRole } from '../../../../src/modules/organization/domain/staffScope';

test('el personal de buffet se asigna a un buffet', () => {
    const scope = createStaffScope({ authUserId: ' user-1 ', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' });

    assert.equal(scope.authUserId, 'user-1');
    assert.equal(scope.storeId, 'store-a');
});

test('el personal de buffet sin buffet se rechaza', () => {
    for (const role of ['STORE_ADMIN', 'STORE_EMPLOYEE'] as const) {
        assert.throws(
        () => createStaffScope({ authUserId: 'user-1', role, organizationId: 'org-a', storeId: null }),
        { code: 'INVALID_STAFF_SCOPE' },
        );
    }
});

test('un administrador de organización no se asigna a un buffet', () => {
    assert.throws(
        () => createStaffScope({ authUserId: 'user-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a', storeId: 'store-a' }),
        { code: 'INVALID_STAFF_SCOPE' },
    );
    assert.doesNotThrow(() =>
        createStaffScope({ authUserId: 'user-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a', storeId: null }),
    );
});

test('un rol de staff sin usuario se rechaza', () => {
    assert.throws(
        () => createStaffScope({ authUserId: '  ', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' }),
        { code: 'INVALID_STAFF_SCOPE' },
    );
});

test('reconoce solo los roles de staff válidos', () => {
    assert.equal(isStaffRole('STORE_ADMIN'), true);
    assert.equal(isStaffRole('CUSTOMER'), false);
    assert.equal(isStaffRole('admin'), false);
});