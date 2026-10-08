import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageOrganization } from '../domain/organizationAuthorization';
import { deactivateStore as deactivate, type Store } from '../domain/store';
import type { StoreRepositoryPort } from './ports';

type Dependencies = {
    stores: StoreRepositoryPort;
};

export function makeDeactivateStore({ stores }: Dependencies) {
    return async function deactivateStore(actor: Actor, storeId: string): Promise<Store> {
        const store = await stores.findById(storeId);

        if (!store) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        assertCanManageOrganization(actor, store.organizationId);

        const deactivated = deactivate(store);

        if (deactivated.status === store.status) {
        return store;
        }

        return stores.updateStatus(store.id, deactivated.status);
    };
}