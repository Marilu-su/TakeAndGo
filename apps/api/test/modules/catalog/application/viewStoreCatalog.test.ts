import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Actor } from '../../../../src/shared/auth/actor';
import { makeViewStoreCatalog } from '../../../../src/modules/catalog/application/viewStoreCatalog';
import type { StoreCatalog } from '../../../../src/modules/catalog/domain/storeCatalog';
import { FakeMemberships } from '../../../support/catalogFakes';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const catalogA: StoreCatalog = { storeId: STORE_A, categories: [] };

function setup() {
    return makeViewStoreCatalog({
        getStoreCatalog: async (storeId) => ({ ...catalogA, storeId }),
        memberships: new FakeMemberships([{ customerId: 'customer-1', storeId: STORE_A }]),
    });
}

// Pueden ver el catálogo

test('un CUSTOMER asociado al buffet puede ver su catálogo', async () => {
    const viewStoreCatalog = setup();
    const customer: Actor = { userId: 'customer-1', role: 'CUSTOMER' };

    const catalog = await viewStoreCatalog(customer, STORE_A);

    assert.equal(catalog.storeId, STORE_A);
});

test('el personal del buffet puede ver su catálogo', async () => {
    const viewStoreCatalog = setup();
    const staff: Actor[] = [
        { userId: 'admin', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: STORE_A },
        { userId: 'empleado', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: STORE_A },
    ];

    for (const actor of staff) {
        const catalog = await viewStoreCatalog(actor, STORE_A);
        assert.equal(catalog.storeId, STORE_A);
    }
});

// No pueden ver el catálogo

test('un CUSTOMER no asociado al buffet no puede ver su catálogo', async () => {
    const viewStoreCatalog = setup();
    const customer: Actor = { userId: 'customer-1', role: 'CUSTOMER' };

    await assert.rejects(viewStoreCatalog(customer, STORE_B), { code: 'FORBIDDEN' });
});

test('el personal de otro buffet no puede ver el catálogo', async () => {
    const viewStoreCatalog = setup();
    const otherStaff: Actor = { userId: 'empleado-b', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: STORE_B };

    await assert.rejects(viewStoreCatalog(otherStaff, STORE_A), { code: 'FORBIDDEN' });
});

test('el ORGANIZATION_ADMIN no puede ver el catálogo de un buffet', async () => {
    const viewStoreCatalog = setup();
    const orgAdmin: Actor = { userId: 'org-admin', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' };

    await assert.rejects(viewStoreCatalog(orgAdmin, STORE_A), { code: 'FORBIDDEN' });
});

test('sin acceso no se llega a consultar el catálogo', async () => {
    let consulted = false;
    const viewStoreCatalog = makeViewStoreCatalog({
        getStoreCatalog: async () => {
        consulted = true;
        return catalogA;
        },
        memberships: new FakeMemberships(),
    });

    await assert.rejects(viewStoreCatalog({ userId: 'x', role: 'CUSTOMER' }, STORE_A), { code: 'FORBIDDEN' });
    assert.equal(consulted, false);
});