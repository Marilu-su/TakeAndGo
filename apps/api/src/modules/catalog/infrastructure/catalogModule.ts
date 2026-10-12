import { getPrisma } from '../../../infrastructure/database/prisma';
import { createPrismaGetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import { makeConfigureProductAdditions } from '../application/configureProductAdditions';
import { makeCreateAddition } from '../application/createAddition';
import { makeCreateCategory } from '../application/createCategory';
import { makeCreateProduct } from '../application/createProduct';
import { makeDeactivateAddition } from '../application/deactivateAddition';
import { makeDeactivateCategory } from '../application/deactivateCategory';
import { makeDeactivateProduct } from '../application/deactivateProduct';
import { makeListAdditions } from '../application/listAdditions';
import { makeListCategories } from '../application/listCategories';
import { makeListProductAdditions } from '../application/listProductAdditions';
import { makeListProducts } from '../application/listProducts';
import { makeUpdateAddition } from '../application/updateAddition';
import { makeUpdateCategory } from '../application/updateCategory';
import { makeUpdateProduct } from '../application/updateProduct';
import { OrganizationStoreScope } from './organizationStoreScope';
import { PrismaAdditionRepository } from './prismaAdditionRepository';
import { PrismaCategoryRepository } from './prismaCategoryRepository';
import { PrismaProductAdditionRepository } from './prismaProductAdditionRepository';
import { PrismaProductRepository } from './prismaProductRepository';

export type CategoryUseCases = {
    createCategory: ReturnType<typeof makeCreateCategory>;
    listCategories: ReturnType<typeof makeListCategories>;
    updateCategory: ReturnType<typeof makeUpdateCategory>;
    deactivateCategory: ReturnType<typeof makeDeactivateCategory>;
};

export type ProductUseCases = {
    createProduct: ReturnType<typeof makeCreateProduct>;
    listProducts: ReturnType<typeof makeListProducts>;
    updateProduct: ReturnType<typeof makeUpdateProduct>;
    deactivateProduct: ReturnType<typeof makeDeactivateProduct>;
    configureProductAdditions: ReturnType<typeof makeConfigureProductAdditions>;
    listProductAdditions: ReturnType<typeof makeListProductAdditions>;
};

export type AdditionUseCases = {
    createAddition: ReturnType<typeof makeCreateAddition>;
    listAdditions: ReturnType<typeof makeListAdditions>;
    updateAddition: ReturnType<typeof makeUpdateAddition>;
    deactivateAddition: ReturnType<typeof makeDeactivateAddition>;
};

function buildRepositories() {
    const prisma = getPrisma();

    return {
        categories: new PrismaCategoryRepository(prisma),
        products: new PrismaProductRepository(prisma),
        additions: new PrismaAdditionRepository(prisma),
        productAdditions: new PrismaProductAdditionRepository(prisma),
        stores: new OrganizationStoreScope(createPrismaGetStoreConfiguration()),
    };
}

function buildCategoryUseCases(): CategoryUseCases {
    const { categories, stores } = buildRepositories();

    return {
        createCategory: makeCreateCategory({ categories, stores }),
        listCategories: makeListCategories({ categories, stores }),
        updateCategory: makeUpdateCategory({ categories }),
        deactivateCategory: makeDeactivateCategory({ categories }),
    };
}

function buildProductUseCases(): ProductUseCases {
    const { categories, products, additions, productAdditions, stores } = buildRepositories();

    return {
        createProduct: makeCreateProduct({ products, categories }),
        listProducts: makeListProducts({ products, stores }),
        updateProduct: makeUpdateProduct({ products, categories }),
        deactivateProduct: makeDeactivateProduct({ products }),
        configureProductAdditions: makeConfigureProductAdditions({ products, additions, productAdditions }),
        listProductAdditions: makeListProductAdditions({ products, additions, productAdditions }),
    };
}

function buildAdditionUseCases(): AdditionUseCases {
    const { additions, stores } = buildRepositories();

    return {
        createAddition: makeCreateAddition({ additions, stores }),
        listAdditions: makeListAdditions({ additions, stores }),
        updateAddition: makeUpdateAddition({ additions }),
        deactivateAddition: makeDeactivateAddition({ additions }),
    };
}

export function createPrismaCategoryUseCases(): CategoryUseCases {
    return {
        createCategory: (actor, command) => buildCategoryUseCases().createCategory(actor, command),
        listCategories: (actor, storeId) => buildCategoryUseCases().listCategories(actor, storeId),
        updateCategory: (actor, command) => buildCategoryUseCases().updateCategory(actor, command),
        deactivateCategory: (actor, command) => buildCategoryUseCases().deactivateCategory(actor, command),
    };
}

export function createPrismaProductUseCases(): ProductUseCases {
    return {
        createProduct: (actor, command) => buildProductUseCases().createProduct(actor, command),
        listProducts: (actor, storeId) => buildProductUseCases().listProducts(actor, storeId),
        updateProduct: (actor, command) => buildProductUseCases().updateProduct(actor, command),
        deactivateProduct: (actor, command) => buildProductUseCases().deactivateProduct(actor, command),
        configureProductAdditions: (actor, command) =>
        buildProductUseCases().configureProductAdditions(actor, command),
        listProductAdditions: (actor, command) => buildProductUseCases().listProductAdditions(actor, command),
    };
}

export function createPrismaAdditionUseCases(): AdditionUseCases {
    return {
        createAddition: (actor, command) => buildAdditionUseCases().createAddition(actor, command),
        listAdditions: (actor, storeId) => buildAdditionUseCases().listAdditions(actor, storeId),
        updateAddition: (actor, command) => buildAdditionUseCases().updateAddition(actor, command),
        deactivateAddition: (actor, command) => buildAdditionUseCases().deactivateAddition(actor, command),
    };
}