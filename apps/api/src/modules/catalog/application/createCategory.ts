import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { createNewCategory, type Category } from '../domain/category';
import type { CategoryRepositoryPort, StoreScopePort } from './ports';

export type CreateCategoryCommand = {
    storeId: string;
    name: string;
};

type Dependencies = {
    categories: CategoryRepositoryPort;
    stores: StoreScopePort;
};

export function makeCreateCategory({ categories, stores }: Dependencies) {
    return async function createCategory(actor: Actor, command: CreateCategoryCommand): Promise<Category> {
        assertCanManageStoreCatalog(actor, command.storeId);

        if (!(await stores.storeExists(command.storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        const newCategory = createNewCategory(command);

        return categories.create(newCategory);
    };
}