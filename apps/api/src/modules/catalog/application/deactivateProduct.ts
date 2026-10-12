import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import { deactivateProduct as deactivate, type Product } from '../domain/product';
import type { ProductRepositoryPort } from './ports';

export type DeactivateProductCommand = {
    storeId: string;
    productId: string;
};

type Dependencies = {
    products: ProductRepositoryPort;
};

export function makeDeactivateProduct({ products }: Dependencies) {
    return async function deactivateProduct(actor: Actor, command: DeactivateProductCommand): Promise<Product> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const product = await products.findById(command.productId);

        if (!product || product.storeId !== command.storeId) {
        throw new DomainError('PRODUCT_NOT_FOUND', 'El producto no existe en este buffet');
        }

        const deactivated = deactivate(product);

        if (deactivated.isActive === product.isActive) {
        return product;
        }

        return products.update(deactivated);
    };
}