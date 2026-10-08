import { DomainError } from '../../../shared/domain/DomainError';
import type { Store } from '../domain/store';
import type { OrganizationRepositoryPort, StoreRepositoryPort } from './ports';

export type StoreConfiguration = {
    store: Store;
    maxAdvanceDays: number;
};

type Dependencies = {
    organizations: OrganizationRepositoryPort;
    stores: StoreRepositoryPort;
};

export function makeGetStoreConfiguration({ organizations, stores }: Dependencies) {
    return async function getStoreConfiguration(storeId: string): Promise<StoreConfiguration> {
        const store = await stores.findById(storeId);

        if (!store) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        const organization = await organizations.findById(store.organizationId);

        if (!organization) {
        throw new DomainError('ORGANIZATION_NOT_FOUND', 'La organización no existe');
        }

        return {
        store,
        maxAdvanceDays: organization.maxAdvanceDays,
        };
    };
}