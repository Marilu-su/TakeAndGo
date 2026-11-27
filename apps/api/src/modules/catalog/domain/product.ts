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
    dietaryTags?: string[];
    allergens?: string[];
    allergensVerified?: boolean;
};

export type NewProduct = Omit<Product, 'id'>;

export type ProductChanges = Partial<
    Pick<Product, 'categoryId' | 'name' | 'description' | 'priceCents' | 'basePreparationSeconds' | 'dietaryTags' | 'allergens' | 'allergensVerified'>
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
    dietaryTags?: string[];
    allergens?: string[];
    allergensVerified?: boolean;
    }): NewProduct {
    return {
        storeId: input.storeId,
        categoryId: input.categoryId,
        name: requireName(input.name, INVALID_NAME_CODE, INVALID_NAME_MESSAGE),
        description: normalizeDescription(input.description),
        priceCents: validatePriceCents(input.priceCents),
        basePreparationSeconds: validatePreparationSeconds(input.basePreparationSeconds),
        isActive: true,
        dietaryTags: cleanDietaryTags(input.dietaryTags),
        allergens: cleanLabels(input.allergens),
        allergensVerified: input.allergensVerified ?? false,
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
        dietaryTags: changes.dietaryTags === undefined ? product.dietaryTags ?? [] : cleanDietaryTags(changes.dietaryTags),
        allergens: changes.allergens === undefined ? product.allergens ?? [] : cleanLabels(changes.allergens),
        allergensVerified: changes.allergensVerified ?? product.allergensVerified ?? false,
    };
}

function cleanLabels(values?: string[]): string[] {
    if (!values) return [];
    return [...new Map(values.map(value => value.trim()).filter(Boolean).map(value => [value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(), value.slice(0, 80)])).values()].slice(0, 30);
}

function cleanDietaryTags(values?: string[]): string[] {
    const labels = cleanLabels(values?.map(value => value.trim().toUpperCase()));
    if (labels.some(value => !['VEGETARIAN', 'VEGAN', 'GLUTEN_FREE'].includes(value))) {
        throw new DomainError('INVALID_PRODUCT_DIETARY_TAG', 'Las etiquetas dietarias permitidas son vegetariana, vegana y sin TACC.');
    }
    if (labels.includes('VEGAN') && !labels.includes('VEGETARIAN')) labels.push('VEGETARIAN');
    return labels;
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
