import { DomainError } from '../../../shared/domain/DomainError';
import type { Category } from '../domain/category';
import { assertCategoryBelongsToStore } from '../domain/product';
import type { CategoryRepositoryPort } from './ports';

export async function requireCategoryOfStore(
    categories: CategoryRepositoryPort,
    categoryId: string,
    storeId: string,
    ): Promise<Category> {
    const category = await categories.findById(categoryId);

    if (!category) {
        throw new DomainError('INVALID_CATEGORY_SCOPE', 'La categoría no pertenece a este buffet');
    }

    assertCategoryBelongsToStore(category, storeId);

    return category;
}