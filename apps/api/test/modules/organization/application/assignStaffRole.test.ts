import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type {
    OrganizationRepositoryPort,
    StaffScopeRepositoryPort,
    StoreRepositoryPort,
} from '../../../../src/modules/organization/application/ports';
import { makeAssignStaffRole } from '../../../../src/modules/organization/application/assignStaffRole';
import type { NewStaffScope, StaffScope } from '../../../../src/modules/organization/domain/staffScope';

class InMemoryStaffScopes implements StaffScopeRepositoryPort {
    readonly items = new Map<string, StaffScope>();

    async findByAuthUserId(authUserId: string) {
        return this.items.get(authUserId) ?? null;
    }

    async save(scope: NewStaffScope) {
        const saved: StaffScope = { ...scope, id: this.items.get(scope.authUserId)?.id ?? randomUUID() };
        this.items.set(scope.authUserId, saved);
        return saved;
    }
}

function setup() {
    const staffScopes = new InMemoryStaffScopes();

    // Solo implementamos lo que usa el caso de uso
    const organizations = {
        findById: async (id: string) => (id === 'org-a' ? { id: 'org-a', name: 'UTN FRLP', maxAdvanceDays: 7 } : null),
    } as unknown as OrganizationRepositoryPort;

    const stores = {
        findById: async (id: string) =>
        id === 'store-a'
            ? { id: 'store-a', organizationId: 'org-a', name: 'Buffet Sistemas', code: 'SIS001', status: 'ACTIVE' }
            : null,
    } as unknown as StoreRepositoryPort;

    return { staffScopes, assignStaffRole: makeAssignStaffRole({ organizations, stores, staffScopes }) };
}

test('asigna un administrador de buffet con la organización de su buffet', async () => {
    const { assignStaffRole } = setup();

    const scope = await assignStaffRole({ authUserId: 'user-1', role: 'STORE_ADMIN', storeId: 'store-a' });

    assert.equal(scope.storeId, 'store-a');
    assert.equal(scope.organizationId, 'org-a');
});

test('asigna un administrador de organización sin buffet', async () => {
    const { assignStaffRole } = setup();

    const scope = await assignStaffRole({ authUserId: 'user-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' });

    assert.equal(scope.organizationId, 'org-a');
    assert.equal(scope.storeId, null);
});

test('reasignar un rol reemplaza el anterior', async () => {
    const { assignStaffRole, staffScopes } = setup();

    await assignStaffRole({ authUserId: 'user-1', role: 'STORE_ADMIN', storeId: 'store-a' });
    await assignStaffRole({ authUserId: 'user-1', role: 'STORE_EMPLOYEE', storeId: 'store-a' });

    assert.equal(staffScopes.items.size, 1);
    assert.equal(staffScopes.items.get('user-1')?.role, 'STORE_EMPLOYEE');
});

test('no se puede asignar personal a un buffet inexistente', async () => {
    const { assignStaffRole } = setup();

    await assert.rejects(
        assignStaffRole({ authUserId: 'user-1', role: 'STORE_EMPLOYEE', storeId: 'store-fantasma' }),
        { code: 'STORE_NOT_FOUND' },
    );
});

test('no se puede asignar un administrador a una organización inexistente', async () => {
    const { assignStaffRole } = setup();

    await assert.rejects(
        assignStaffRole({ authUserId: 'user-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-fantasma' }),
        { code: 'ORGANIZATION_NOT_FOUND' },
    );
});

test('el personal de buffet requiere indicar el buffet', async () => {
    const { assignStaffRole } = setup();

    await assert.rejects(assignStaffRole({ authUserId: 'user-1', role: 'STORE_ADMIN' }), {
        code: 'INVALID_STAFF_SCOPE',
    });
});