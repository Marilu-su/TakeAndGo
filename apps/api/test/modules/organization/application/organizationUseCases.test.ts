import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import type { Actor } from '../../../../src/shared/auth/actor';
import { DomainError } from '../../../../src/shared/domain/DomainError';
import type { Organization } from '../../../../src/modules/organization/domain/organization';
import type { NewStore, Store, StoreStatus } from '../../../../src/modules/organization/domain/store';
import type {
    OrganizationRepositoryPort,
    StoreRepositoryPort,
} from '../../../../src/modules/organization/application/ports';
import { makeCreateStore } from '../../../../src/modules/organization/application/createStore';
import { makeDeactivateStore } from '../../../../src/modules/organization/application/deactivateStore';
import { makeSetOrganizationMaxAdvanceDays } from '../../../../src/modules/organization/application/setOrganizationMaxAdvanceDays';
import { makeGetStoreConfiguration } from '../../../../src/modules/organization/application/getStoreConfiguration';

// Adaptadores en memoria: implementan los puertos sin base de datos

class InMemoryOrganizations implements OrganizationRepositoryPort {
    readonly items = new Map<string, Organization>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async updateMaxAdvanceDays(id: string, maxAdvanceDays: number) {
        const organization = this.items.get(id);
        if (!organization) throw new Error('Organización inexistente en el test');
        const updated = { ...organization, maxAdvanceDays };
        this.items.set(id, updated);
        return updated;
    }
}

class InMemoryStores implements StoreRepositoryPort {
    readonly items = new Map<string, Store>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async create(store: NewStore) {
        const codeTaken = [...this.items.values()].some((existing) => existing.code === store.code);

        if (codeTaken) {
        throw new DomainError('STORE_CODE_ALREADY_EXISTS', 'El código del buffet ya existe');
        }

        const created: Store = { ...store, id: randomUUID() };
        this.items.set(created.id, created);
        return created;
    }

    async updateStatus(id: string, status: StoreStatus) {
        const store = this.items.get(id);
        if (!store) throw new Error('Buffet inexistente en el test');
        const updated = { ...store, status };
        this.items.set(id, updated);
        return updated;
    }
}

// Datos de prueba

const ORG_A = 'org-a';
const ORG_B = 'org-b';

const adminA: Actor = { userId: 'admin-a', role: 'ORGANIZATION_ADMIN', organizationId: ORG_A };
const adminB: Actor = { userId: 'admin-b', role: 'ORGANIZATION_ADMIN', organizationId: ORG_B };
const storeAdminA: Actor = {
    userId: 'store-admin-a',
    role: 'STORE_ADMIN',
    organizationId: ORG_A,
    storeId: 'store-x',
};

function setup() {
    const organizations = new InMemoryOrganizations();
    const stores = new InMemoryStores();

    organizations.items.set(ORG_A, { id: ORG_A, name: 'UTN FRLP', maxAdvanceDays: 7 });
    organizations.items.set(ORG_B, { id: ORG_B, name: 'Otra organización', maxAdvanceDays: 7 });

    return {
        organizations,
        stores,
        createStore: makeCreateStore({ organizations, stores }),
        deactivateStore: makeDeactivateStore({ stores }),
        setMaxAdvanceDays: makeSetOrganizationMaxAdvanceDays({ organizations }),
        getStoreConfiguration: makeGetStoreConfiguration({ organizations, stores }),
    };
}

// CreateStore (CA-01)

test('un ORGANIZATION_ADMIN crea un buffet en su organización', async () => {
    const { createStore, stores } = setup();

    const store = await createStore(adminA, { organizationId: ORG_A, name: 'Buffet Sistemas', code: 'SIS001' });

    assert.equal(store.organizationId, ORG_A);
    assert.equal(store.status, 'PENDING_SETUP');
    assert.equal(stores.items.size, 1);
});

test('no se puede crear un buffet en otra organización', async () => {
    const { createStore, stores } = setup();

    await assert.rejects(
        createStore(adminB, { organizationId: ORG_A, name: 'Buffet Sistemas', code: 'SIS001' }),
        { code: 'FORBIDDEN' },
    );
    assert.equal(stores.items.size, 0);
});

test('un STORE_ADMIN no puede crear buffets', async () => {
    const { createStore } = setup();

    await assert.rejects(
        createStore(storeAdminA, { organizationId: ORG_A, name: 'Buffet Sistemas', code: 'SIS001' }),
        { code: 'FORBIDDEN' },
    );
});

test('no se puede crear un buffet en una organización inexistente', async () => {
    const { createStore } = setup();
    const adminGhost: Actor = { userId: 'x', role: 'ORGANIZATION_ADMIN', organizationId: 'org-ghost' };

    await assert.rejects(
        createStore(adminGhost, { organizationId: 'org-ghost', name: 'Buffet', code: 'ABC123' }),
        { code: 'ORGANIZATION_NOT_FOUND' },
    );
});

test('rechaza un código de buffet repetido aunque cambien las mayúsculas', async () => {
    const { createStore } = setup();

    await createStore(adminA, { organizationId: ORG_A, name: 'Buffet Sistemas', code: 'SIS001' });

    await assert.rejects(
        createStore(adminA, { organizationId: ORG_A, name: 'Otro buffet', code: 'sis001' }),
        { code: 'STORE_CODE_ALREADY_EXISTS' },
    );
});

test('un código inválido no crea el buffet', async () => {
    const { createStore, stores } = setup();

    await assert.rejects(
        createStore(adminA, { organizationId: ORG_A, name: 'Buffet', code: 'AB12' }),
        { code: 'INVALID_STORE_CODE' },
    );
    assert.equal(stores.items.size, 0);
});

// DeactivateStore

test('un ORGANIZATION_ADMIN da de baja un buffet de su organización', async () => {
    const { createStore, deactivateStore } = setup();
    const store = await createStore(adminA, { organizationId: ORG_A, name: 'Buffet', code: 'SIS001' });

    const result = await deactivateStore(adminA, store.id);

    assert.equal(result.status, 'INACTIVE');
});

test('no se puede dar de baja un buffet de otra organización', async () => {
    const { createStore, deactivateStore } = setup();
    const store = await createStore(adminA, { organizationId: ORG_A, name: 'Buffet', code: 'SIS001' });

    await assert.rejects(deactivateStore(adminB, store.id), { code: 'FORBIDDEN' });
});

test('dar de baja un buffet inexistente informa que no existe', async () => {
    const { deactivateStore } = setup();

    await assert.rejects(deactivateStore(adminA, 'store-inexistente'), { code: 'STORE_NOT_FOUND' });
});

// SetOrganizationMaxAdvanceDays (CA-04)

test('un ORGANIZATION_ADMIN configura la anticipación máxima de su organización', async () => {
    const { setMaxAdvanceDays } = setup();

    const organization = await setMaxAdvanceDays(adminA, ORG_A, 14);

    assert.equal(organization.maxAdvanceDays, 14);
});

test('una anticipación máxima inválida no se guarda', async () => {
    const { setMaxAdvanceDays, organizations } = setup();

    await assert.rejects(setMaxAdvanceDays(adminA, ORG_A, 0), { code: 'INVALID_MAX_ADVANCE_DAYS' });
    assert.equal(organizations.items.get(ORG_A)?.maxAdvanceDays, 7);
});

test('no se puede configurar la anticipación de otra organización', async () => {
    const { setMaxAdvanceDays } = setup();

    await assert.rejects(setMaxAdvanceDays(adminB, ORG_A, 14), { code: 'FORBIDDEN' });
});

// GetStoreConfiguration (contrato para otros módulos)

test('la configuración del buffet incluye la anticipación de su organización', async () => {
    const { createStore, getStoreConfiguration } = setup();
    const store = await createStore(adminA, { organizationId: ORG_A, name: 'Buffet', code: 'SIS001' });

    const configuration = await getStoreConfiguration(store.id);

    assert.equal(configuration.store.id, store.id);
    assert.equal(configuration.maxAdvanceDays, 7);
});

test('la configuración de un buffet inexistente informa que no existe', async () => {
    const { getStoreConfiguration } = setup();

    await assert.rejects(getStoreConfiguration('store-inexistente'), { code: 'STORE_NOT_FOUND' });
});