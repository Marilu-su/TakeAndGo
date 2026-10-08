import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateStore } from '../application/createStore';
import { PrismaOrganizationRepository } from './prismaOrganizationRepository';
import { PrismaStoreRepository } from './prismaStoreRepository';

export type CreateStore = ReturnType<typeof makeCreateStore>;

export function createPrismaCreateStore(): CreateStore {
    return (actor, command) => {
        const prisma = getPrisma();

        const createStore = makeCreateStore({
        organizations: new PrismaOrganizationRepository(prisma),
        stores: new PrismaStoreRepository(prisma),
        });

        return createStore(actor, command);
    };
}