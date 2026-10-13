import { DomainError } from '../../../shared/domain/DomainError';
import { buildStoreCatalog, type StoreCatalog } from '../domain/storeCatalog';
import type {
    AdditionRepositoryPort,
    CatalogAvailabilityPort,
    CategoryRepositoryPort,
    ProductAdditionRepositoryPort,
    ProductRepositoryPort,
    StoreScopePort,
} from './ports';

type Dependencies = {
    stores: StoreScopePort;
    categories: CategoryRepositoryPort;
    products: ProductRepositoryPort;
    additions: AdditionRepositoryPort;
    productAdditions: ProductAdditionRepositoryPort;
    availability: CatalogAvailabilityPort;
};

export function makeGetStoreCatalog(dependencies: Dependencies) {
    const { stores, categories, products, additions, productAdditions, availability } = dependencies;

    return async function getStoreCatalog(storeId: string): Promise<StoreCatalog> {
        if (!(await stores.storeExists(storeId))) {
        throw new DomainError('STORE_NOT_FOUND', 'El buffet no existe');
        }

        const [storeCategories, storeProducts, storeAdditions, links] = await Promise.all([
        categories.listByStore(storeId),
        products.listByStore(storeId),
        additions.listByStore(storeId),
        productAdditions.listLinksByStore(storeId),
        ]);

        const { availableProductIds, availableAdditionIds } = await availability.getAvailability(
        storeId,
        storeProducts.map((product) => product.id),
        storeAdditions.map((addition) => addition.id),
        );

        return buildStoreCatalog({
        storeId,
        categories: storeCategories,
        products: storeProducts,
        additions: storeAdditions,
        links,
        availableProductIds,
        availableAdditionIds,
        });
    };
}