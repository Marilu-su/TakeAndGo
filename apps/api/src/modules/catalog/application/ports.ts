import type { Category, NewCategory } from '../domain/category';

export interface CategoryRepositoryPort {
    findById(id: string): Promise<Category | null>;
    listByStore(storeId: string): Promise<Category[]>;
    create(category: NewCategory): Promise<Category>;
    update(category: Category): Promise<Category>;
}

/**
 * Lo que el catálogo necesita saber de los buffets.
 * Se implementa a partir del módulo de organización, sin acceder a sus tablas.
 */
export interface StoreScopePort {
    storeExists(storeId: string): Promise<boolean>;
}