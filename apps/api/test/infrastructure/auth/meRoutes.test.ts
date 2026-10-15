import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../src/app';

test('GET /me sin autenticación responde 401', async () => {
    const app = createApp({ checkDatabase: async () => true, resolveActor: async () => null });

    const response = await request(app).get('/api/v1/me');

    assert.equal(response.status, 401);
});

test('GET /me devuelve el Actor del usuario autenticado', async () => {
    const app = createApp({
        checkDatabase: async () => true,
        resolveActor: async () => ({ userId: 'auth-1', role: 'STORE_ADMIN', organizationId: 'org-a', storeId: 'store-a' }),
    });

    const response = await request(app).get('/api/v1/me');

    assert.equal(response.status, 200);
    assert.equal(response.body.role, 'STORE_ADMIN');
    assert.equal(response.body.storeId, 'store-a');
});