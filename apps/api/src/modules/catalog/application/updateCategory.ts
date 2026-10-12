import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { renameCategory, type Category } from '../domain/category';
import type { CategoryRepositoryPort } from './ports';

export type UpdateCategoryCommand = {
    storeId: string;
    categoryId: string;
    name: string;
};

type Dependencies = {
    categories: CategoryRepositoryPort;
};

export function makeUpdateCategory({ categories }: Dependencies) {
    return async function updateCategory(actor: Actor, command: UpdateCategoryCommand): Promise<Category> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const category = await categories.findById(command.categoryId);

        if (!category || category.storeId !== command.storeId) {
        throw new DomainError('CATEGORY_NOT_FOUND', 'La categoría no existe en este buffet');
        }

        const renamed = renameCategory(category, command.name);

        return categories.update(renamed);
    };
}