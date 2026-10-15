import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateStore } from '../application/createStore';
import { makeGetStoreConfiguration } from '../application/getStoreConfiguration';
import { PrismaOrganizationRepository } from './prismaOrganizationRepository';
import { PrismaStoreRepository } from './prismaStoreRepository';
import { makeAssignStaffRole } from '../application/assignStaffRole';
import { PrismaStaffScopeRepository } from './prismaStaffScopeRepository';

export type CreateStore = ReturnType<typeof makeCreateStore>;
export type GetStoreConfiguration = ReturnType<typeof makeGetStoreConfiguration>;

function buildRepositories() {
    const prisma = getPrisma();

    return {
        organizations: new PrismaOrganizationRepository(prisma),
        stores: new PrismaStoreRepository(prisma),
        staffScopes: new PrismaStaffScopeRepository(prisma),
    };
}

export function createPrismaCreateStore(): CreateStore {
    return (actor, command) => makeCreateStore(buildRepositories())(actor, command);
}

export function createPrismaGetStoreConfiguration(): GetStoreConfiguration {
    return (storeId) => makeGetStoreConfiguration(buildRepositories())(storeId);
}

export type AssignStaffRole = ReturnType<typeof makeAssignStaffRole>;

export function createPrismaAssignStaffRole(): AssignStaffRole {
    return (command) => makeAssignStaffRole(buildRepositories())(command);
}