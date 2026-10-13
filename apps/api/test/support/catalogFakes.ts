import { randomUUID } from 'node:crypto';

import type { Addition, NewAddition } from '../../src/modules/catalog/domain/addition';
import type { Category, NewCategory } from '../../src/modules/catalog/domain/category';
import type { NewProduct, Product } from '../../src/modules/catalog/domain/product';
import type {
    AdditionRepositoryPort,
    CatalogAvailabilityPort,
    CategoryRepositoryPort,
    CustomerMembershipPort,
    ProductAdditionRepositoryPort,
    ProductRepositoryPort,
    StoreScopePort,
} from '../../src/modules/catalog/application/ports';

export class InMemoryCategories implements CategoryRepositoryPort {
    readonly items = new Map<string, Category>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async listByStore(storeId: string) {
        return [...this.items.values()].filter((item) => item.storeId === storeId);
    }

    async create(category: NewCategory) {
        const created: Category = { ...category, id: randomUUID() };
        this.items.set(created.id, created);
        return created;
    }

    async update(category: Category) {
        this.items.set(category.id, category);
        return category;
    }
    }

export class InMemoryProducts implements ProductRepositoryPort {
    readonly items = new Map<string, Product>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async listByStore(storeId: string) {
        return [...this.items.values()].filter((item) => item.storeId === storeId);
    }

    async create(product: NewProduct) {
        const created: Product = { ...product, id: randomUUID() };
        this.items.set(created.id, created);
        return created;
    }

    async update(product: Product) {
        this.items.set(product.id, product);
        return product;
    }
}

export class InMemoryAdditions implements AdditionRepositoryPort {
    readonly items = new Map<string, Addition>();

    async findById(id: string) {
        return this.items.get(id) ?? null;
    }

    async findManyByIds(ids: string[]) {
        return ids
        .map((id) => this.items.get(id))
        .filter((item): item is Addition => item !== undefined);
    }

    async listByStore(storeId: string) {
        return [...this.items.values()].filter((item) => item.storeId === storeId);
    }

    async create(addition: NewAddition) {
        const created: Addition = { ...addition, id: randomUUID() };
        this.items.set(created.id, created);
        return created;
    }

    async update(addition: Addition) {
        this.items.set(addition.id, addition);
        return addition;
    }
}

export class InMemoryProductAdditions implements ProductAdditionRepositoryPort {
    readonly links = new Map<string, { storeId: string; additionIds: string[] }>();

    async listAdditionIds(productId: string) {
        return this.links.get(productId)?.additionIds ?? [];
    }

    async listLinksByStore(storeId: string) {
        return [...this.links.entries()]
        .filter(([, link]) => link.storeId === storeId)
        .flatMap(([productId, link]) => link.additionIds.map((additionId) => ({ productId, additionId })));
    }

    async replace(productId: string, storeId: string, additionIds: string[]) {
        this.links.set(productId, { storeId, additionIds: [...additionIds] });
    }
}

export class FakeStoreScope implements StoreScopePort {
    private readonly existingStoreIds: string[];

    constructor(existingStoreIds: string[]) {
        this.existingStoreIds = existingStoreIds;
    }

    async storeExists(storeId: string) {
        return this.existingStoreIds.includes(storeId);
    }
}

export class FakeAvailability implements CatalogAvailabilityPort {
    private readonly unavailableIds: Set<string>;

    constructor(unavailableIds: string[] = []) {
        this.unavailableIds = new Set(unavailableIds);
    }

    async getAvailability(_storeId: string, productIds: string[], additionIds: string[]) {
        return {
        availableProductIds: new Set(productIds.filter((id) => !this.unavailableIds.has(id))),
        availableAdditionIds: new Set(additionIds.filter((id) => !this.unavailableIds.has(id))),
        };
    }
}

export class FakeMemberships implements CustomerMembershipPort {
    private readonly memberships: Set<string>;

    constructor(memberships: Array<{ customerId: string; storeId: string }> = []) {
        this.memberships = new Set(memberships.map((m) => `${m.customerId}:${m.storeId}`));
    }

    async isCustomerAssociatedToStore(customerId: string, storeId: string) {
        return this.memberships.has(`${customerId}:${storeId}`);
    }
}