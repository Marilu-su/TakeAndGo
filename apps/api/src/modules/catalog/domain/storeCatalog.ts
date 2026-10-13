import type { Addition } from './addition';
import type { Category } from './category';
import type { Product } from './product';

export type ProductAdditionLink = {
    productId: string;
    additionId: string;
};

export type CatalogAddition = {
    id: string;
    name: string;
    priceCents: number;
};

export type CatalogProduct = {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    basePreparationSeconds: number;
    additions: CatalogAddition[];
};

export type CatalogCategory = {
    id: string;
    name: string;
    products: CatalogProduct[];
};

export type StoreCatalog = {
    storeId: string;
    categories: CatalogCategory[];
};

type BuildStoreCatalogInput = {
    storeId: string;
    categories: Category[];
    products: Product[];
    additions: Addition[];
    links: ProductAdditionLink[];
    availableProductIds: ReadonlySet<string>;
    availableAdditionIds: ReadonlySet<string>;
};

export function buildStoreCatalog(input: BuildStoreCatalogInput): StoreCatalog {
    const { storeId, availableProductIds, availableAdditionIds } = input;

    const offeredAdditions = new Map(
        input.additions
        .filter((addition) => addition.storeId === storeId && addition.isActive && availableAdditionIds.has(addition.id))
        .map((addition) => [addition.id, addition]),
    );

    const additionIdsByProduct = new Map<string, string[]>();

    for (const link of input.links) {
        const additionIds = additionIdsByProduct.get(link.productId) ?? [];
        additionIds.push(link.additionId);
        additionIdsByProduct.set(link.productId, additionIds);
    }

    const toCatalogProduct = (product: Product): CatalogProduct => ({
        id: product.id,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        basePreparationSeconds: product.basePreparationSeconds,
        additions: (additionIdsByProduct.get(product.id) ?? [])
        .map((additionId) => offeredAdditions.get(additionId))
        .filter((addition): addition is Addition => addition !== undefined)
        .map((addition) => ({
            id: addition.id,
            name: addition.name,
            priceCents: addition.priceCents,
        })),
    });

    const categories = input.categories
        .filter((category) => category.storeId === storeId && category.isActive)
        .map((category) => ({
        id: category.id,
        name: category.name,
        products: input.products
            .filter(
            (product) =>
                product.storeId === storeId &&
                product.categoryId === category.id &&
                product.isActive &&
                availableProductIds.has(product.id),
            )
            .map(toCatalogProduct),
        }))
        .filter((category) => category.products.length > 0);

    return { storeId, categories };
}