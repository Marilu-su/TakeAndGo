import { DomainError } from '../../../shared/domain/DomainError';
import type { Category } from './category';
import {
    normalizeDescription,
    requireName,
    validatePreparationSeconds,
    validatePriceCents,
} from './catalogValues';

export type Product = {
    id: string;
    storeId: string;
    categoryId: string;
    name: string;
    description: string | null;
    priceCents: number;
    basePreparationSeconds: number;
    isActive: boolean;
};

export type NewProduct = Omit<Product, 'id'>;

export type ProductChanges = Partial<
    Pick<Product, 'categoryId' | 'name' | 'description' | 'priceCents' | 'basePreparationSeconds'>
>;

const INVALID_NAME_CODE = 'INVALID_PRODUCT_NAME';
const INVALID_NAME_MESSAGE = 'El nombre del producto es obligatorio';

export function createNewProduct(input: {
    storeId: string;
    categoryId: string;
    name: string;
    description?: string | null;
    priceCents: number;
    basePreparationSeconds: number;
    }): NewProduct {
    return {
        storeId: input.storeId,
        categoryId: input.categoryId,
        name: requireName(input.name, INVALID_NAME_CODE, INVALID_NAME_MESSAGE),
        description: normalizeDescription(input.description),
        priceCents: validatePriceCents(input.priceCents),
        basePreparationSeconds: validatePreparationSeconds(input.basePreparationSeconds),
        isActive: true,
    };
}

export function updateProduct(product: Product, changes: ProductChanges): Product {
    return {
        ...product,
        categoryId: changes.categoryId ?? product.categoryId,
        name:
        changes.name === undefined
            ? product.name
            : requireName(changes.name, INVALID_NAME_CODE, INVALID_NAME_MESSAGE),
        description:
        changes.description === undefined ? product.description : normalizeDescription(changes.description),
        priceCents: changes.priceCents === undefined ? product.priceCents : validatePriceCents(changes.priceCents),
        basePreparationSeconds:
        changes.basePreparationSeconds === undefined
            ? product.basePreparationSeconds
            : validatePreparationSeconds(changes.basePreparationSeconds),
    };
}

export function deactivateProduct(product: Product): Product {
    return {
        ...product,
        isActive: false,
    };
}

export function assertCategoryBelongsToStore(category: Category, storeId: string): void {
    if (category.storeId !== storeId) {
        throw new DomainError('INVALID_CATEGORY_SCOPE', 'La categoría no pertenece a este buffet');
    }
}