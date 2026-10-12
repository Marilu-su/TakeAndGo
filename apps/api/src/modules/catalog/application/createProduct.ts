import type { Actor } from '../../../shared/auth/actor';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { createNewProduct, type Product } from '../domain/product';
import { requireCategoryOfStore } from './categoryScope';
import type { CategoryRepositoryPort, ProductRepositoryPort } from './ports';

export type CreateProductCommand = {
    storeId: string;
    categoryId: string;
    name: string;
    description?: string | null;
    priceCents: number;
    basePreparationSeconds: number;
};

type Dependencies = {
    products: ProductRepositoryPort;
    categories: CategoryRepositoryPort;
};

export function makeCreateProduct({ products, categories }: Dependencies) {
    return async function createProduct(actor: Actor, command: CreateProductCommand): Promise<Product> {
        assertCanManageStoreCatalog(actor, command.storeId);

        await requireCategoryOfStore(categories, command.categoryId, command.storeId);

        const newProduct = createNewProduct(command);

        return products.create(newProduct);
    };
}