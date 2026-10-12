import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateStore } from '../application/createStore';
import { makeGetStoreConfiguration } from '../application/getStoreConfiguration';
import { PrismaOrganizationRepository } from './prismaOrganizationRepository';
import { PrismaStoreRepository } from './prismaStoreRepository';

export type CreateStore = ReturnType<typeof makeCreateStore>;
export type GetStoreConfiguration = ReturnType<typeof makeGetStoreConfiguration>;

function buildRepositories() {
    const prisma = getPrisma();

    return {
        organizations: new PrismaOrganizationRepository(prisma),
        stores: new PrismaStoreRepository(prisma),
    };
}

export function createPrismaCreateStore(): CreateStore {
    return (actor, command) => makeCreateStore(buildRepositories())(actor, command);
}

export function createPrismaGetStoreConfiguration(): GetStoreConfiguration {
    return (storeId) => makeGetStoreConfiguration(buildRepositories())(storeId);
}