import { getPrisma } from '../../../infrastructure/database/prisma';
import { makeCreateStore } from '../application/createStore';
import { makeGetStoreConfiguration } from '../application/getStoreConfiguration';
import { PrismaOrganizationRepository } from './prismaOrganizationRepository';
import { PrismaStoreRepository } from './prismaStoreRepository';
import { makeAssignStaffRole } from '../application/assignStaffRole';
import { PrismaStaffScopeRepository } from './prismaStaffScopeRepository';
import { makeListOrganizationStores } from '../application/listOrganizationStores';
import { makeDeactivateStore } from '../application/deactivateStore';

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

export function createPrismaStoreManagement() {
    return {
        list: (actor: import('../../../shared/auth/actor').Actor, organizationId: string) => makeListOrganizationStores(buildRepositories().stores)(actor, organizationId),
        deactivate: (actor: import('../../../shared/auth/actor').Actor, storeId: string) => makeDeactivateStore(buildRepositories())(actor, storeId),
    };
}

export type AssignStaffRole = ReturnType<typeof makeAssignStaffRole>;

export function createPrismaAssignStaffRole(): AssignStaffRole {
    return (command) => makeAssignStaffRole(buildRepositories())(command);
}
