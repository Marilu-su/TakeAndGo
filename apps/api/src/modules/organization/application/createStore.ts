import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageOrganization } from '../domain/organizationAuthorization';
import { createNewStore, type Store } from '../domain/store';
import type { OrganizationRepositoryPort, StoreRepositoryPort } from './ports';

export type CreateStoreCommand = {
    organizationId: string;
    name: string;
    code: string;
};

type Dependencies = {
    organizations: OrganizationRepositoryPort;
    stores: StoreRepositoryPort;
};

export function makeCreateStore({ organizations, stores }: Dependencies) {
    return async function createStore(actor: Actor, command: CreateStoreCommand): Promise<Store> {
        assertCanManageOrganization(actor, command.organizationId);

        const organization = await organizations.findById(command.organizationId);

        if (!organization) {
        throw new DomainError('ORGANIZATION_NOT_FOUND', 'La organización no existe');
        }

        const newStore = createNewStore(command);

        return stores.create(newStore);
    };
}