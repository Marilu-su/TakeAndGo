import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createNewCustomer } from '../../../../src/modules/customer/domain/customer';

// Customer

test('crea un customer válido', () => {
    const customer = createNewCustomer({
        name: 'Luana Pérez',
        email: 'luana@test.com',
    });

    assert.equal(customer.name, 'Luana Pérez');
    assert.equal(customer.email, 'luana@test.com');
});

test('normaliza el nombre quitando espacios', () => {
    const customer = createNewCustomer({
        name: '  Luana Pérez  ',
        email: 'luana@test.com',
    });

    assert.equal(customer.name, 'Luana Pérez');
});

test('normaliza el email a minúsculas y quita espacios', () => {
    const customer = createNewCustomer({
        name: 'Luana Pérez',
        email: '  Luana@Test.COM  ',
    });

    assert.equal(customer.email, 'luana@test.com');
});

test('rechaza un customer sin nombre', () => {
    assert.throws(
        () =>
            createNewCustomer({
                name: '   ',
                email: 'luana@test.com',
            }),
        { code: 'INVALID_CUSTOMER_NAME' },
    );
});

test('rechaza un customer sin email', () => {
    assert.throws(
        () =>
            createNewCustomer({
                name: 'Luana Pérez',
                email: '   ',
            }),
        { code: 'INVALID_CUSTOMER_EMAIL' },
    );
});