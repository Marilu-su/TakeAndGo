import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import type { Addition } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { AdditionRepositoryPort, StoreScopePort } from './ports';

type Dependencies = {
    additions: AdditionRepositoryPort;
    stores: StoreScopePort;
};

export function makeListAdditions({ additions, stores }: Dependencies) {
    return async function listAdditions(actor: Actor, storeId: string): Promise<Addition[]> {
        assertCanManageStoreCatalog(actor, storeId);

        if (!(await stores.storeExists(storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        return additions.listByStore(storeId);
    };
}