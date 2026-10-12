import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { deactivateCategory as deactivate, type Category } from '../domain/category';
import type { CategoryRepositoryPort } from './ports';

export type DeactivateCategoryCommand = {
    storeId: string;
    categoryId: string;
};

type Dependencies = {
    categories: CategoryRepositoryPort;
};

export function makeDeactivateCategory({ categories }: Dependencies) {
    return async function deactivateCategory(
        actor: Actor,
        command: DeactivateCategoryCommand,
    ): Promise<Category> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const category = await categories.findById(command.categoryId);

        if (!category || category.storeId !== command.storeId) {
        throw new DomainError('CATEGORY_NOT_FOUND', 'La categoría no existe en este buffet');
        }

        const deactivated = deactivate(category);

        if (deactivated.isActive === category.isActive) {
        return category;
        }

        return categories.update(deactivated);
    };
}