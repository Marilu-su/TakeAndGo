import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DomainError } from '../../../../src/shared/domain/DomainError';
import { makeAssociateCustomerToStore } from '../../../../src/modules/customer/application/associateCustomerToStore';
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
    readonly memberships: CustomerStoreMembership[] = [];

    async create(
        membership: NewCustomerStoreMembership,
    ): Promise<CustomerStoreMembership> {
        const exists = this.memberships.some(
            (current) =>
                current.customerId === membership.customerId &&
                current.storeId === membership.storeId,
        );

        if (exists) {
            throw new DomainError(
                'CUSTOMER_ALREADY_ASSOCIATED_TO_STORE',
                'El customer ya está asociado al buffet',
            );
        }

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

const store: Store = {
    id: 'store-1',
    organizationId: 'organization-1',
    name: 'Buffet Sistemas',
    code: createStoreCode('ABC123'),
    status: 'ACTIVE',
};

test('asocia un customer a un buffet mediante su código', async () => {
    const memberships = new InMemoryMemberships();

    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([store]),
        memberships,
    });

    const result = await associate({
        customerId: customer.id,
        storeCode: 'ABC123',
    });

    assert.deepEqual(result, {
        customerId: customer.id,
        storeId: store.id,
    });
});

test('normaliza el código del buffet antes de buscarlo', async () => {
    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([store]),
        memberships: new InMemoryMemberships(),
    });

    const result = await associate({
        customerId: customer.id,
        storeCode: ' abc123 ',
    });

    assert.equal(result.storeId, store.id);
});

test('informa error si el customer no existe', async () => {
    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers(),
        stores: new InMemoryStores([store]),
        memberships: new InMemoryMemberships(),
    });

    await assert.rejects(
        associate({
            customerId: 'customer-inexistente',
            storeCode: 'ABC123',
        }),
        { code: 'CUSTOMER_NOT_FOUND' },
    );
});

test('informa error si el buffet no existe', async () => {
    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores(),
        memberships: new InMemoryMemberships(),
    });

    await assert.rejects(
        associate({
            customerId: customer.id,
            storeCode: 'ABC123',
        }),
        { code: 'STORE_NOT_FOUND' },
    );
});

test('rechaza un código de buffet inválido', async () => {
    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([store]),
        memberships: new InMemoryMemberships(),
    });

    await assert.rejects(
        associate({
            customerId: customer.id,
            storeCode: 'codigo-invalido',
        }),
        { code: 'INVALID_STORE_CODE' },
    );
});

test('rechaza asociar dos veces el mismo customer al mismo buffet', async () => {
    const memberships = new InMemoryMemberships();

    const associate = makeAssociateCustomerToStore({
        customers: new InMemoryCustomers([customer]),
        stores: new InMemoryStores([store]),
        memberships,
    });

    await associate({
        customerId: customer.id,
        storeCode: 'ABC123',
    });

    await assert.rejects(
        associate({
            customerId: customer.id,
            storeCode: 'ABC123',
        }),
        { code: 'CUSTOMER_ALREADY_ASSOCIATED_TO_STORE' },
    );
});