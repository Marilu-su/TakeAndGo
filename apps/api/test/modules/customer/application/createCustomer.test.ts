import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { Customer, NewCustomer } from '../../../../src/modules/customer/domain/customer';
import type { CustomerRepositoryPort } from '../../../../src/modules/customer/application/ports';
import { makeCreateCustomer } from '../../../../src/modules/customer/application/createCustomer';

// Adaptador en memoria: implementa el puerto sin base de datos

class InMemoryCustomers implements CustomerRepositoryPort {
    readonly items = new Map<string, Customer>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async create(customer: NewCustomer) {
        const created: Customer = {
            ...customer,
            id: randomUUID(),
        };

        this.items.set(created.id, created);

        return created;
    }
}

function setup() {
    const customers = new InMemoryCustomers();

    return {
        customers,
        createCustomer: makeCreateCustomer({ customers }),
    };
}

// CreateCustomer

test('crea un customer válido', async () => {
    const { createCustomer, customers } = setup();

    const customer = await createCustomer({
        name: 'Luana Pérez',
        email: 'luana@test.com',
    });

    assert.equal(customer.name, 'Luana Pérez');
    assert.equal(customer.email, 'luana@test.com');
    assert.equal(customers.items.size, 1);
});

test('normaliza los datos antes de guardarlos', async () => {
    const { createCustomer } = setup();

    const customer = await createCustomer({
        name: '  Luana Pérez  ',
        email: '  Luana@Test.COM  ',
    });

    assert.equal(customer.name, 'Luana Pérez');
    assert.equal(customer.email, 'luana@test.com');
});

test('un customer inválido no se guarda', async () => {
    const { createCustomer, customers } = setup();

    await assert.rejects(
        createCustomer({
            name: '   ',
            email: 'luana@test.com',
        }),
        { code: 'INVALID_CUSTOMER_NAME' },
    );

    assert.equal(customers.items.size, 0);
});
