import { getPrisma } from '../../../infrastructure/database/prisma';
import { createPrismaGetStoreConfiguration } from '../../organization/infrastructure/organizationModule';
import { makeCreateCategory } from '../application/createCategory';
import { makeDeactivateCategory } from '../application/deactivateCategory';
import { makeListCategories } from '../application/listCategories';
import { makeUpdateCategory } from '../application/updateCategory';
import { OrganizationStoreScope } from './organizationStoreScope';
import { PrismaCategoryRepository } from './prismaCategoryRepository';

export type CategoryUseCases = {
    createCategory: ReturnType<typeof makeCreateCategory>;
    listCategories: ReturnType<typeof makeListCategories>;
    updateCategory: ReturnType<typeof makeUpdateCategory>;
    deactivateCategory: ReturnType<typeof makeDeactivateCategory>;
};

function buildCategoryUseCases(): CategoryUseCases {
    const categories = new PrismaCategoryRepository(getPrisma());
    const stores = new OrganizationStoreScope(createPrismaGetStoreConfiguration());

    return {
        createCategory: makeCreateCategory({ categories, stores }),
        listCategories: makeListCategories({ categories, stores }),
        updateCategory: makeUpdateCategory({ categories }),
        deactivateCategory: makeDeactivateCategory({ categories }),
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