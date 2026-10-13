import type { Addition, NewAddition } from '../domain/addition';
import type { Category, NewCategory } from '../domain/category';
import type { NewProduct, Product } from '../domain/product';
import type { ProductAdditionLink } from '../domain/storeCatalog';

export interface CategoryRepositoryPort {
    findById(id: string): Promise<Category | null>;
    listByStore(storeId: string): Promise<Category[]>;
    create(category: NewCategory): Promise<Category>;
    update(category: Category): Promise<Category>;
}

export interface ProductRepositoryPort {
    findById(id: string): Promise<Product | null>;
    listByStore(storeId: string): Promise<Product[]>;
    create(product: NewProduct): Promise<Product>;
    update(product: Product): Promise<Product>;
}

export interface AdditionRepositoryPort {
    findById(id: string): Promise<Addition | null>;
    findManyByIds(ids: string[]): Promise<Addition[]>;
    listByStore(storeId: string): Promise<Addition[]>;
    create(addition: NewAddition): Promise<Addition>;
    update(addition: Addition): Promise<Addition>;
}

export interface ProductAdditionRepositoryPort {
    listAdditionIds(productId: string): Promise<string[]>;
    listLinksByStore(storeId: string): Promise<ProductAdditionLink[]>;
    /**
     * Reemplaza los adicionales de un producto por la lista indicada.
     * Debe ser atómico: o se guardan todos, o no cambia nada.
     */
    replace(productId: string, storeId: string, additionIds: string[]): Promise<void>;
}

/**
 * Lo que el catálogo necesita saber de los buffets.
 * Se implementa a partir del módulo de organización, sin acceder a sus tablas.
 */
export interface StoreScopePort {
    storeExists(storeId: string): Promise<boolean>;
}

export type CatalogAvailability = {
    availableProductIds: ReadonlySet<string>;
    availableAdditionIds: ReadonlySet<string>;
};

/**
 * Indica qué productos y adicionales tienen disponibilidad para ofrecerse.
 * Lo implementará el módulo de stock; mientras tanto se usa una implementación provisoria.
 */
export interface CatalogAvailabilityPort {
    getAvailability(storeId: string, productIds: string[], additionIds: string[]): Promise<CatalogAvailability>;
}

/**
 * Lo que el catálogo necesita saber de las asociaciones entre clientes y buffets.
 * Se implementa a partir del módulo de Customer, sin acceder a sus tablas.
 */
export interface CustomerMembershipPort {
    isCustomerAssociatedToStore(customerId: string, storeId: string): Promise<boolean>;
}