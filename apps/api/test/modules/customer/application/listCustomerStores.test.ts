import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeListCustomerStores } from '../../../../src/modules/customer/application/listCustomerStores';
import type {
    CustomerRepositoryPort,
    CustomerStoreMembershipRepositoryPort,
} from '../../../../src/modules/customer/application/ports';
import type {
    Customer,
    NewCustomer,
} from '../../../../src/modules/customer/domain/customer';
import type {
    CustomerStoreMembership,
    NewCustomerStoreMembership,
} from '../../../../src/modules/customer/domain/customerStoreMembership';
import type { StoreRepositoryPort } from '../../../../src/modules/organization/application/ports';
import type {
    NewStore,
    Store,
    StoreStatus,
} from '../../../../src/modules/organization/domain/store';
import {
    createStoreCode,
    type StoreCode,
} from '../../../../src/modules/organization/domain/storeCode';

class InMemoryCustomers implements CustomerRepositoryPort {
    constructor(private readonly customers: Customer[] = []) {}

    async findById(id: string): Promise<Customer | null> {
        return this.customers.find((customer) => customer.id === id) ?? null;
    }

    async create(customer: NewCustomer): Promise<Customer> {
        const created = {
            id: `customer-${this.customers.length + 1}`,
            ...customer,
        };

        this.customers.push(created);
        return created;
    }
}

class InMemoryStores implements StoreRepositoryPort {
    constructor(private readonly stores: Store[] = []) {}

    async findById(id: string): Promise<Store | null> {
        return this.stores.find((store) => store.id === id) ?? null;
    }

    async findByCode(code: StoreCode): Promise<Store | null> {
        return this.stores.find((store) => store.code === code) ?? null;
    }

    async create(store: NewStore): Promise<Store> {
        const created = {
            id: `store-${this.stores.length + 1}`,
            ...store,
        };

        this.stores.push(created);
        return created;
    }

    async updateStatus(id: string, status: StoreStatus): Promise<Store> {
        const store = this.stores.find((candidate) => candidate.id === id);

        if (!store) {
            throw new Error('Store inexistente');
        }

        store.status = status;
        return store;
    }
}

class InMemoryMemberships implements CustomerStoreMembershipRepositoryPort {
    constructor(
        private readonly memberships: CustomerStoreMembership[] = [],
    ) {}

    async create(
        membership: NewCustomerStoreMembership,
    ): Promise<CustomerStoreMembership> {
        this.memberships.push(membership);
        return membership;
    }

    async findByCustomerId(
        customerId: string,
    ): Promise<CustomerStoreMembership[]> {
        return this.memberships.filter(
            (membership) => membership.customerId === customerId,
        );
    }
}

const customer: Customer = {
    id: 'customer-1',
    name: 'Luana',
    email: 'luana@test.com',
};

const storeOne: Store = {
    id: 'store-1',
    organizationId: 'organization-1',
    name: 'Buffet Sistemas',
    code: createStoreCode('ABC123'),
    status: 'ACTIVE',
};

const storeTwo: Store = {
    id: 'store-2',
    organizationId: 'organization-2',
    name: 'Buffet Ingeniería',
    code: createStoreCode('DEF456'),
    status: 'ACTIVE',
};

test('lista todos los buffets asociados al customer', async () => {
    const listCustomerStores = makeListCustomerStores({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([storeOne, storeTwo]),
        memberships: new InMemoryMemberships([
            {
                customerId: customer.id,
                storeId: storeOne.id,
            },
            {
                customerId: customer.id,
                storeId: storeTwo.id,
            },
        ]),
    });

    const result = await listCustomerStores(customer.id);

    assert.equal(result.length, 2);
    assert.deepEqual(result, [storeOne, storeTwo]);
});

test('devuelve una lista vacía si el customer no tiene buffets asociados', async () => {
    const listCustomerStores = makeListCustomerStores({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([storeOne]),
        memberships: new InMemoryMemberships(),
    });

    const result = await listCustomerStores(customer.id);

    assert.deepEqual(result, []);
});

test('informa error si el customer no existe', async () => {
    const listCustomerStores = makeListCustomerStores({
        customers: new InMemoryCustomers(),
        stores: new InMemoryStores([storeOne]),
        memberships: new InMemoryMemberships(),
    });

    await assert.rejects(
        listCustomerStores('customer-inexistente'),
        { code: 'CUSTOMER_NOT_FOUND' },
    );
});