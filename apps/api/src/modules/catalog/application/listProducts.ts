import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type { Product } from '../domain/product';
import type { ProductRepositoryPort, StoreScopePort } from './ports';

type Dependencies = {
    products: ProductRepositoryPort;
    stores: StoreScopePort;
};

export function makeListProducts({ products, stores }: Dependencies) {
    return async function listProducts(actor: Actor, storeId: string): Promise<Product[]> {
        assertCanManageStoreCatalog(actor, storeId);

        if (!(await stores.storeExists(storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        return products.listByStore(storeId);
    };
}