import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Customer, NewCustomer } from '../../../../src/modules/customer/domain/customer';
import type { CustomerRepositoryPort } from '../../../../src/modules/customer/application/ports';
import { makeGetCustomer } from '../../../../src/modules/customer/application/getCustomer';

class InMemoryCustomers implements CustomerRepositoryPort {
    readonly items = new Map<string, Customer>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async create(customer: NewCustomer) {
        const created: Customer = {
            ...customer,
            id: 'customer-1',
        };

        this.items.set(created.id, created);

        return created;
    }
}

function setup() {
    const customers = new InMemoryCustomers();

    return {
        customers,
        getCustomer: makeGetCustomer({ customers }),
    };
}

test('devuelve un customer existente', async () => {
    const { customers, getCustomer } = setup();

    customers.items.set('customer-1', {
        id: 'customer-1',
        name: 'Luana Pérez',
        email: 'luana@test.com',
    });

    const customer = await getCustomer('customer-1');

    assert.equal(customer.id, 'customer-1');
    assert.equal(customer.name, 'Luana Pérez');
    assert.equal(customer.email, 'luana@test.com');
});

test('informa error si el customer no existe', async () => {
    const { getCustomer } = setup();

    await assert.rejects(
        getCustomer('customer-inexistente'),
        { code: 'CUSTOMER_NOT_FOUND' },
    );
});