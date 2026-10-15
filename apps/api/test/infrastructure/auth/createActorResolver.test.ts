import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';

import { createActorResolver } from '../../../src/infrastructure/auth/createActorResolver';
import type { StaffScope } from '../../../src/modules/organization/domain/staffScope';
import { createTokenIdentityResolver } from '../../../src/shared/http/identityResolver';

const request = {} as Request;

function resolverFor(options: {
    identity?: { authUserId: string; email: string | null } | null;
    staff?: StaffScope | null;
    customer?: { id: string } | null;
    }) {
    return createActorResolver({
        resolveIdentity: async () => options.identity ?? null,
        findStaffScope: async () => options.staff ?? null,
        findCustomer: async () => options.customer ?? null,
    });
}

const identity = { authUserId: 'auth-1', email: 'usuario@takeandgo.test' };

// Armado del Actor

test('sin identidad no hay Actor', async () => {
    assert.equal(await resolverFor({ identity: null })(request), null);
});

test('un usuario con rol de staff se identifica con su rol y su buffet', async () => {
    const resolve = resolverFor({
        identity,
        staff: { id: 's1', authUserId: 'auth-1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' },
    });

    assert.deepEqual(await resolve(request), {
        userId: 'auth-1',
        role: 'STORE_ADMIN',
        organizationId: 'org-a',
        storeId: 'store-a',
    });
});

test('un administrador de organización se identifica sin buffet', async () => {
    const resolve = resolverFor({
        identity,
        staff: { id: 's1', authUserId: 'auth-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a', storeId: null },
    });

    assert.deepEqual(await resolve(request), { userId: 'auth-1', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' });
});

test('un cliente se identifica con el id de su Customer', async () => {
    const resolve = resolverFor({ identity, customer: { id: 'customer-1' } });

    assert.deepEqual(await resolve(request), { userId: 'customer-1', role: 'CUSTOMER' });
});

test('si es staff y cliente a la vez, prevalece el rol de staff', async () => {
    const resolve = resolverFor({
        identity,
        staff: { id: 's1', authUserId: 'auth-1', role: 'STORE_EMPLOYEE', organizationId: 'org-a', storeId: 'store-a' },
        customer: { id: 'customer-1' },
    });

    assert.equal((await resolve(request))?.role, 'STORE_EMPLOYEE');
});

test('un usuario autenticado sin rol en Take&Go no tiene Actor', async () => {
    assert.equal(await resolverFor({ identity })(request), null);
});

// Lectura y verificación del token

test('el resolver de identidad verifica el token del header Authorization', async () => {
    let receivedToken: string | undefined;
    const resolveIdentity = createTokenIdentityResolver({
        verify: async (token) => {
        receivedToken = token;
        return identity;
        },
    });

    const result = await resolveIdentity({ headers: { authorization: 'Bearer abc.def.ghi' } } as Request);

    assert.equal(receivedToken, 'abc.def.ghi');
    assert.deepEqual(result, identity);
});

test('sin header Authorization no se verifica ningún token', async () => {
    let called = false;
    const resolveIdentity = createTokenIdentityResolver({
        verify: async () => {
        called = true;
        return identity;
        },
    });

    assert.equal(await resolveIdentity({ headers: {} } as Request), null);
    assert.equal(called, false);
});