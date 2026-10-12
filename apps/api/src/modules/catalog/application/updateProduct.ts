import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { updateProduct as applyChanges, type Product, type ProductChanges } from '../domain/product';
import { requireCategoryOfStore } from './categoryScope';
import type { CategoryRepositoryPort, ProductRepositoryPort } from './ports';

export type UpdateProductCommand = {
    storeId: string;
    productId: string;
    changes: ProductChanges;
};

type Dependencies = {
    products: ProductRepositoryPort;
    categories: CategoryRepositoryPort;
};

export function makeUpdateProduct({ products, categories }: Dependencies) {
    return async function updateProduct(actor: Actor, command: UpdateProductCommand): Promise<Product> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const product = await products.findById(command.productId);

        if (!product || product.storeId !== command.storeId) {
        throw new DomainError('PRODUCT_NOT_FOUND', 'El producto no existe en este buffet');
        }

        if (command.changes.categoryId !== undefined) {
        await requireCategoryOfStore(categories, command.changes.categoryId, command.storeId);
        }

        const updated = applyChanges(product, command.changes);

        return products.update(updated);
    };
}