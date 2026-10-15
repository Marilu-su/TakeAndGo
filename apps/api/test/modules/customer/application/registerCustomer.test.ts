import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { CustomerRepositoryPort } from '../../../../src/modules/customer/application/ports';
import { makeRegisterCustomer } from '../../../../src/modules/customer/application/registerCustomer';
import type { Customer, NewCustomer } from '../../../../src/modules/customer/domain/customer';

class InMemoryCustomers implements CustomerRepositoryPort {
    readonly items = new Map<string, Customer>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async findByAuthUserId(authUserId: string) {
        return [...this.items.values()].find((customer) => customer.authUserId === authUserId) ?? null;
    }

    async create(customer: NewCustomer) {
        const created: Customer = { ...customer, id: randomUUID() };
        this.items.set(created.id, created);
        return created;
    }
}

function setup() {
    const customers = new InMemoryCustomers();

    return { customers, registerCustomer: makeRegisterCustomer({ customers }) };
}

test('registra como cliente a un usuario autenticado, con el email de su cuenta', async () => {
    const { registerCustomer } = setup();

    const customer = await registerCustomer(
        { authUserId: 'user-1', email: 'Cliente@TakeAndGo.test' },
        { name: '  Ana  ' },
    );

    assert.equal(customer.authUserId, 'user-1');
    assert.equal(customer.email, 'cliente@takeandgo.test');
  assert.equal(customer.name, 'Ana');
});

test('un usuario no puede registrarse dos veces como cliente', async () => {
    const { registerCustomer, customers } = setup();

    await registerCustomer({ authUserId: 'user-1', email: 'ana@takeandgo.test' }, { name: 'Ana' });

    await assert.rejects(
        registerCustomer({ authUserId: 'user-1', email: 'ana@takeandgo.test' }, { name: 'Ana' }),
        { code: 'CUSTOMER_ALREADY_REGISTERED' },
    );
    assert.equal(customers.items.size, 1);
});

test('una cuenta sin email no puede registrarse como cliente', async () => {
    const { registerCustomer } = setup();

    await assert.rejects(registerCustomer({ authUserId: 'user-1', email: null }, { name: 'Ana' }), {
        code: 'INVALID_CUSTOMER_EMAIL',
    });
});

test('un nombre inválido no registra al cliente', async () => {
    const { registerCustomer, customers } = setup();

    await assert.rejects(
        registerCustomer({ authUserId: 'user-1', email: 'ana@takeandgo.test' }, { name: '   ' }),
        { code: 'INVALID_CUSTOMER_NAME' },
    );
    assert.equal(customers.items.size, 0);
});