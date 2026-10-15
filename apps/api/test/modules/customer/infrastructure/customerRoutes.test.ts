import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../../../../src/app';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { AuthenticatedIdentity } from '../../../../src/shared/auth/tokenVerifier';
import type { RegisterCustomer } from '../../../../src/modules/customer/infrastructure/customerModule';

const URL = '/api/v1/me/customer';
const identity: AuthenticatedIdentity = { authUserId: 'auth-1', email: 'ana@takeandgo.test' };

function appWith(currentIdentity: AuthenticatedIdentity | null, registerCustomer: RegisterCustomer) {
    return createApp({
        checkDatabase: async () => true,
        resolveIdentity: async () => currentIdentity,
        registerCustomer,
    });
}

const registered: RegisterCustomer = async (id, command) => ({
    id: 'customer-1',
    name: command.name,
    email: id.email ?? '',
    authUserId: id.authUserId,
});

test('sin autenticación el registro responde 401', async () => {
    const response = await request(appWith(null, registered)).post(URL).send({ name: 'Ana' });

    assert.equal(response.status, 401);
});

test('registra al usuario autenticado como cliente', async () => {
    let receivedIdentity: AuthenticatedIdentity | undefined;
    const app = appWith(identity, async (id, command) => {
        receivedIdentity = id;
        return registered(id, command);
    });

    const response = await request(app).post(URL).send({ name: 'Ana' });

    assert.equal(response.status, 201);
    assert.equal(response.body.email, 'ana@takeandgo.test');
    assert.equal(response.body.authUserId, undefined);
    assert.equal(receivedIdentity?.authUserId, 'auth-1');
});

test('el registro sin nombre responde 400', async () => {
    const response = await request(appWith(identity, registered)).post(URL).send({});

    assert.equal(response.status, 400);
});

test('un usuario ya registrado responde 409', async () => {
    const app = appWith(identity, async () => {
        throw new DomainError('CUSTOMER_ALREADY_REGISTERED', 'Error de prueba');
    });

    const response = await request(app).post(URL).send({ name: 'Ana' });

    assert.equal(response.status, 409);
});