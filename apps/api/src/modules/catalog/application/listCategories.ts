import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { Category } from '../domain/category';
import type { CategoryRepositoryPort, StoreScopePort } from './ports';

type Dependencies = {
    categories: CategoryRepositoryPort;
    stores: StoreScopePort;
};

export function makeListCategories({ categories, stores }: Dependencies) {
    return async function listCategories(actor: Actor, storeId: string): Promise<Category[]> {
        assertCanManageStoreCatalog(actor, storeId);

        if (!(await stores.storeExists(storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        return categories.listByStore(storeId);
    };
}