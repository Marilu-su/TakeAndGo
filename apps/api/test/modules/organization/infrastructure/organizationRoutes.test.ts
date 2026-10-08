import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../../src/app';
import type { Actor } from '../../../../src/shared/auth/actor';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { Store } from '../../../../src/modules/organization/domain/store';
import type { StoreCode } from '../../../../src/modules/organization/domain/storeCode';
import type { CreateStore } from '../../../../src/modules/organization/infrastructure/organizationModule';

const URL = '/api/v1/organizations/org-a/stores';

const admin: Actor = { userId: 'admin-a', role: 'ORGANIZATION_ADMIN', organizationId: 'org-a' };

const createdStore: Store = {
    id: 'store-1',
    organizationId: 'org-a',
    name: 'Buffet Sistemas',
    code: 'SIS001' as StoreCode,
    status: 'PENDING_SETUP',
};

function appWith(actor: Actor | null, createStore: CreateStore) {
    return createApp({
        checkDatabase: async () => true,
        resolveActor: async () => actor,
        createStore,
    });
}

test('sin usuario autenticado responde 401 y no crea el buffet', async () => {
    let called = false;
    const app = appWith(null, async () => {
        called = true;
        return createdStore;
    });

    const response = await request(app).post(URL).send({ name: 'Buffet Sistemas', code: 'SIS001' });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHENTICATED');
    assert.equal(called, false);
    });

    test('crea el buffet con la organización de la URL y responde 201', async () => {
    let receivedActor: Actor | undefined;
    let receivedOrganizationId: string | undefined;

    const app = appWith(admin, async (actor, command) => {
        receivedActor = actor;
        receivedOrganizationId = command.organizationId;
        return createdStore;
    });

    const response = await request(app).post(URL).send({ name: 'Buffet Sistemas', code: 'SIS001' });

    assert.equal(response.status, 201);
    assert.equal(response.body.id, 'store-1');
    assert.equal(receivedActor?.userId, 'admin-a');
    assert.equal(receivedOrganizationId, 'org-a');
    });

    test('responde 400 si faltan campos obligatorios', async () => {
    const app = appWith(admin, async () => createdStore);

    const response = await request(app).post(URL).send({ name: 'Buffet Sistemas' });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_REQUEST');
    });

    test('traduce los errores de negocio a códigos HTTP', async () => {
    const cases: Array<[string, number]> = [
        ['FORBIDDEN', 403],
        ['ORGANIZATION_NOT_FOUND', 404],
        ['STORE_CODE_ALREADY_EXISTS', 409],
        ['INVALID_STORE_CODE', 422],
    ];

    for (const [code, status] of cases) {
        const app = appWith(admin, async () => {
        throw new DomainError(code, 'Error de prueba');
        });

        const response = await request(app).post(URL).send({ name: 'Buffet', code: 'SIS001' });

        assert.equal(response.status, status, `${code} debería responder ${status}`);
        assert.equal(response.body.code, code);
    }
});