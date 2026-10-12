import { DomainError } from '../../../shared/domain/DomainError';

export type Category = {
    id: string;
    storeId: string;
    name: string;
    isActive: boolean;
};

export type NewCategory = Omit<Category, 'id'>;

function normalizeCategoryName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
        throw new DomainError('INVALID_CATEGORY_NAME', 'El nombre de la categoría es obligatorio');
    }

    return normalized;
}

export function createNewCategory(input: { storeId: string; name: string }): NewCategory {
    return {
        storeId: input.storeId,
        name: normalizeCategoryName(input.name),
        isActive: true,
    };
}

export function renameCategory(category: Category, name: string): Category {
    return {
        ...category,
        name: normalizeCategoryName(name),
    };
}

export function deactivateCategory(category: Category): Category {
    return {
        ...category,
        isActive: false,
    };
}